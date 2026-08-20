import type { Server as HttpServer } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { verifyUserToken } from '../auth.js'
import { findById } from '../userStore.js'
import { setConsultantStatus } from '../consultantStore.js'
import {
  getConversationById,
  isParticipant,
  getPeerId,
  addMessage,
  markMessageDelivered,
  markDeliveredForUserEverywhere,
  markRead,
  type ConversationMessage,
} from '../conversationStore.js'

// ── Signaling / presence WebSocket server ──────────────────
// Módulo 1: autenticação + presença + ping/pong.
// Módulo 2: chat de texto (chat:send / chat:read) reaproveitando esta mesma conexão.
// Módulo 3 (chamadas) vai adicionar novos `type` de mensagem aqui dentro.

interface ConnectedSocket {
  ws: WebSocket
  userId: string
  role: 'user' | 'consultant'
}

// userId -> conjunto de sockets (permite múltiplos dispositivos/abas)
const connections = new Map<string, Set<ConnectedSocket>>()
// Timers de "debounce" para evitar marcar offline durante reconexões rápidas
const offlineTimers = new Map<string, NodeJS.Timeout>()
const OFFLINE_DEBOUNCE_MS = 5000

/** Formato de mensagem enviado ao cliente (datas como ISO string). */
interface ChatMessageWire {
  id: string
  conversationId: string
  senderId: string
  content: string
  status: string
  createdAt: string
}

function toWire(message: ConversationMessage): ChatMessageWire {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: message.content,
    status: message.status,
    createdAt: message.createdAt.toISOString(),
  }
}

type ServerMessage =
  | { type: 'connected'; userId: string; role: string }
  | { type: 'pong'; ts: number }
  | { type: 'presence'; userId: string; role: 'consultant'; status: 'online' | 'offline' }
  | { type: 'chat:message'; message: ChatMessageWire }
  | { type: 'chat:ack'; clientId?: string; message: ChatMessageWire }
  | { type: 'chat:status'; conversationId: string; messageIds: string[]; status: 'delivered' | 'read' }
  | { type: 'error'; message: string }

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message))
  }
}

/** Envia uma mensagem para todas as conexões ativas (usado para presença de consultores). */
function broadcast(message: ServerMessage): void {
  for (const sockets of connections.values()) {
    for (const { ws } of sockets) {
      send(ws, message)
    }
  }
}

/** Envia uma mensagem para todas as conexões de um usuário específico (múltiplos dispositivos). */
export function sendToUser(userId: string, message: ServerMessage): void {
  const sockets = connections.get(userId)
  if (!sockets) return
  for (const { ws } of sockets) {
    send(ws, message)
  }
}

export function isUserOnline(userId: string): boolean {
  return (connections.get(userId)?.size ?? 0) > 0
}

/** Notifica o(s) remetente(s) de que suas mensagens foram entregues (chamado pela rota REST de histórico). */
export function notifyDelivered(conversationId: string, delivered: { id: string; senderId: string }[]): void {
  const bySender = new Map<string, string[]>()
  for (const { id, senderId } of delivered) {
    if (!bySender.has(senderId)) bySender.set(senderId, [])
    bySender.get(senderId)!.push(id)
  }
  for (const [senderId, messageIds] of bySender) {
    sendToUser(senderId, { type: 'chat:status', conversationId, messageIds, status: 'delivered' })
  }
}

/** Notifica o(s) remetente(s) de que suas mensagens foram lidas (chamado pela rota REST de leitura). */
export function notifyRead(conversationId: string, readMessages: { id: string; senderId: string }[]): void {
  const bySender = new Map<string, string[]>()
  for (const { id, senderId } of readMessages) {
    if (!bySender.has(senderId)) bySender.set(senderId, [])
    bySender.get(senderId)!.push(id)
  }
  for (const [senderId, messageIds] of bySender) {
    sendToUser(senderId, { type: 'chat:status', conversationId, messageIds, status: 'read' })
  }
}

async function handleConsultantOnline(userId: string): Promise<void> {
  const existingTimer = offlineTimers.get(userId)
  if (existingTimer) {
    clearTimeout(existingTimer)
    offlineTimers.delete(userId)
  }
  await setConsultantStatus(userId, 'online')
  broadcast({ type: 'presence', userId, role: 'consultant', status: 'online' })
}

function scheduleConsultantOffline(userId: string): void {
  const timer = setTimeout(async () => {
    offlineTimers.delete(userId)
    // Só marca offline se realmente não há mais nenhuma conexão desse usuário
    if (isUserOnline(userId)) return
    try {
      await setConsultantStatus(userId, 'offline')
      broadcast({ type: 'presence', userId, role: 'consultant', status: 'offline' })
    } catch (err) {
      console.error('[WS] Erro ao marcar consultor offline:', err)
    }
  }, OFFLINE_DEBOUNCE_MS)
  offlineTimers.set(userId, timer)
}

export function attachWebSocketServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

  wss.on('connection', async (ws, req) => {
    // Pausa o processamento de frames entrantes até terminarmos a autenticação
    // (assíncrona) e registrarmos os listeners — sem isso, uma mensagem enviada
    // pelo cliente logo após abrir a conexão pode ser perdida, porque o `ws`
    // começa a processar frames antes do listener 'message' existir.
    ws.pause()

    try {
      const url = new URL(req.url ?? '', 'http://localhost')
      const token = url.searchParams.get('token') ?? ''
      if (!token) {
        ws.close(4001, 'Token ausente')
        return
      }

      const payload = verifyUserToken(token)
      const user = await findById(payload.sub)
      if (!user || (user.tokenVersion ?? 0) !== payload.tokenVersion) {
        ws.close(4001, 'Token inválido')
        return
      }

      const socket: ConnectedSocket = { ws, userId: user.id, role: payload.role }
      if (!connections.has(user.id)) connections.set(user.id, new Set())
      connections.get(user.id)!.add(socket)

      console.log(`[WS] Conectado: userId=${user.id} role=${payload.role} (total ${connections.get(user.id)!.size} conexões)`)

      if (payload.role === 'consultant') {
        await handleConsultantOnline(user.id)
      }

      // Mensagens que chegaram enquanto este usuário estava offline agora
      // podem ser marcadas como "entregues" — e os remetentes avisados.
      try {
        const deliveredBatches = await markDeliveredForUserEverywhere(user.id)
        for (const batch of deliveredBatches) {
          notifyDelivered(batch.conversationId, batch.messageIds.map((id) => ({ id, senderId: batch.senderId })))
        }
      } catch (err) {
        console.error('[WS] Erro ao marcar mensagens como entregues na conexão:', err)
      }

      ws.on('message', async (raw) => {
        let msg: unknown
        try {
          msg = JSON.parse(raw.toString())
        } catch {
          send(ws, { type: 'error', message: 'Mensagem inválida (JSON esperado).' })
          return
        }

        if (typeof msg !== 'object' || msg === null || typeof (msg as { type?: unknown }).type !== 'string') {
          send(ws, { type: 'error', message: 'Campo "type" é obrigatório.' })
          return
        }

        const type = (msg as { type: string }).type

        switch (type) {
          case 'ping':
            send(ws, { type: 'pong', ts: Date.now() })
            break

          case 'chat:send': {
            const body = msg as { conversationId?: unknown; content?: unknown; clientId?: unknown }
            const conversationId = typeof body.conversationId === 'string' ? body.conversationId : ''
            const content = typeof body.content === 'string' ? body.content.trim() : ''
            const clientId = typeof body.clientId === 'string' ? body.clientId : undefined

            if (!conversationId || !content) {
              send(ws, { type: 'error', message: 'chat:send requer conversationId e content.' })
              break
            }
            if (content.length > 4000) {
              send(ws, { type: 'error', message: 'Mensagem muito longa (máx. 4000 caracteres).' })
              break
            }

            try {
              const conversation = await getConversationById(conversationId)
              if (!conversation || !isParticipant(conversation, user.id)) {
                send(ws, { type: 'error', message: 'Conversa não encontrada.' })
                break
              }

              const message = await addMessage(conversationId, user.id, content)
              send(ws, { type: 'chat:ack', clientId, message: toWire(message) })

              const peerId = getPeerId(conversation, user.id)
              if (isUserOnline(peerId)) {
                sendToUser(peerId, { type: 'chat:message', message: toWire(message) })
                await markMessageDelivered(message.id)
                send(ws, { type: 'chat:status', conversationId, messageIds: [message.id], status: 'delivered' })
              }
            } catch (err) {
              console.error('[WS] Erro ao processar chat:send:', err)
              send(ws, { type: 'error', message: 'Falha ao enviar mensagem.' })
            }
            break
          }

          case 'chat:read': {
            const body = msg as { conversationId?: unknown }
            const conversationId = typeof body.conversationId === 'string' ? body.conversationId : ''
            if (!conversationId) {
              send(ws, { type: 'error', message: 'chat:read requer conversationId.' })
              break
            }
            try {
              const conversation = await getConversationById(conversationId)
              if (!conversation || !isParticipant(conversation, user.id)) {
                send(ws, { type: 'error', message: 'Conversa não encontrada.' })
                break
              }
              const readMessages = await markRead(conversationId, user.id)
              if (readMessages.length > 0) notifyRead(conversationId, readMessages)
            } catch (err) {
              console.error('[WS] Erro ao processar chat:read:', err)
              send(ws, { type: 'error', message: 'Falha ao marcar como lida.' })
            }
            break
          }

          // Módulo 3 (chamadas) vai adicionar novos cases aqui.
          default:
            send(ws, { type: 'error', message: `Tipo de mensagem desconhecido: ${type}` })
        }
      })

      ws.on('close', () => {
        const set = connections.get(user.id)
        if (set) {
          set.delete(socket)
          if (set.size === 0) connections.delete(user.id)
        }
        console.log(`[WS] Desconectado: userId=${user.id} role=${payload.role}`)
        if (payload.role === 'consultant' && !isUserOnline(user.id)) {
          scheduleConsultantOffline(user.id)
        }
      })

      ws.on('error', (err) => {
        console.error(`[WS] Erro na conexão userId=${user.id}:`, err.message)
      })

      // Só agora os listeners estão prontos — libera o processamento de frames
      // que possam ter chegado durante a autenticação, e então avisa o cliente.
      ws.resume()
      send(ws, { type: 'connected', userId: user.id, role: payload.role })
    } catch (err) {
      console.error('[WS] Falha ao autenticar conexão:', err instanceof Error ? err.message : err)
      ws.close(4001, 'Falha de autenticação')
    }
  })

  console.log('[WS] Signaling server pronto em /ws')
  return wss
}
