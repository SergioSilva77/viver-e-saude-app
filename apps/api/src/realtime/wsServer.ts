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
import {
  createCall,
  getCallById,
  markCallOngoing,
  endCall,
  isCallParticipant,
  getOtherParty,
  getCallLimitInfo,
  CALL_LIMIT_WARNING_SECONDS,
  type Call,
  type CallType,
} from '../callStore.js'
import {
  createNotification,
  getDeviceTokensForUser,
  removeDeviceTokens,
  type NotificationType,
} from '../notificationStore.js'
import { sendPushToTokens } from '../fcmService.js'

// ── Signaling / presence WebSocket server ──────────────────
// Módulo 1: autenticação + presença + ping/pong.
// Módulo 2: chat de texto (chat:send / chat:read) reaproveitando esta mesma conexão.
// Módulo 3: chamadas de voz/vídeo (call:* / webrtc:*) reaproveitando a mesma conexão.

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

// callId -> chamada + timer de "não atendeu" (só existe enquanto 'ringing')
const activeCalls = new Map<string, { call: Call; ringTimer?: NodeJS.Timeout; limitWarnTimer?: NodeJS.Timeout; limitEndTimer?: NodeJS.Timeout }>()
const RING_TIMEOUT_MS = 30_000
// userId -> callId da chamada em andamento (ringing ou ongoing) — usado para
// impedir uma segunda chamada simultânea e para encerrar chamadas ao desconectar.
const userActiveCall = new Map<string, string>()

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
  | { type: 'presence'; userId: string; role: 'consultant'; status: 'online' | 'offline' | 'in_call' }
  | { type: 'chat:message'; message: ChatMessageWire }
  | { type: 'chat:ack'; clientId?: string; message: ChatMessageWire }
  | { type: 'chat:status'; conversationId: string; messageIds: string[]; status: 'delivered' | 'read' }
  | { type: 'call:incoming'; callId: string; callerId: string; callerName: string; callerPhotoUrl: string; callType: CallType }
  | { type: 'call:ringing'; callId: string }
  | { type: 'call:accepted'; callId: string }
  | { type: 'call:rejected'; callId: string }
  | { type: 'call:cancelled'; callId: string }
  | { type: 'call:missed'; callId: string }
  | { type: 'call:busy'; callId?: string }
  | { type: 'call:ended'; callId: string; durationSeconds: number; reason?: 'limit_reached' }
  | { type: 'call:limit_warning'; callId: string; remainingSeconds: number }
  | { type: 'webrtc:offer'; callId: string; sdp: unknown }
  | { type: 'webrtc:answer'; callId: string; sdp: unknown }
  | { type: 'webrtc:ice'; callId: string; candidate: unknown }
  | { type: 'notification'; notification: { id: string; type: string; title: string; body: string; data: Record<string, unknown>; createdAt: string } }
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

/**
 * Ponto único de notificação (Módulo 4): sempre grava no banco (in-app,
 * "sininho"); se o usuário estiver com o app aberto (WS conectado) empurra
 * em tempo real; caso contrário, tenta push via FCM (se configurado) para
 * acordar o dispositivo. Nunca lança erro — notificação é best-effort e
 * não pode derrubar o fluxo principal (enviar mensagem, ligar, etc).
 */
export async function notifyUser(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  try {
    const notification = await createNotification(userId, type, title, body, data)

    if (isUserOnline(userId)) {
      sendToUser(userId, {
        type: 'notification',
        notification: {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          createdAt: notification.createdAt.toISOString(),
        },
      })
      return
    }

    const tokens = await getDeviceTokensForUser(userId)
    if (tokens.length === 0) return
    const dataAsStrings = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
    const { invalidTokens } = await sendPushToTokens(tokens, { title, body, data: dataAsStrings })
    if (invalidTokens.length > 0) await removeDeviceTokens(invalidTokens)
  } catch (err) {
    console.error('[Notify] Falha ao notificar usuário:', err)
  }
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

/**
 * Encerra uma chamada (por qualquer motivo) e limpa todo o estado em memória:
 * timer de "não atendeu", mapa de chamada ativa dos dois participantes, e —
 * se um dos lados era consultor em atendimento — devolve o status para
 * "online" e avisa a presença.
 */
async function finalizeCall(callId: string, status: 'ended' | 'rejected' | 'cancelled' | 'missed'): Promise<Call | null> {
  const active = activeCalls.get(callId)
  if (active?.ringTimer) clearTimeout(active.ringTimer)
  if (active?.limitWarnTimer) clearTimeout(active.limitWarnTimer)
  if (active?.limitEndTimer) clearTimeout(active.limitEndTimer)
  activeCalls.delete(callId)

  const updated = await endCall(callId, status)
  if (!updated) return null

  for (const participantId of [updated.callerId, updated.calleeId]) {
    if (userActiveCall.get(participantId) === callId) {
      userActiveCall.delete(participantId)
    }
  }

  // Se algum dos participantes é consultor "em chamada", libera para online.
  for (const participantId of [updated.callerId, updated.calleeId]) {
    const participant = await findById(participantId)
    if (participant?.role === 'consultant') {
      await setConsultantStatus(participantId, 'online')
      broadcast({ type: 'presence', userId: participantId, role: 'consultant', status: 'online' })
    }
  }

  return updated
}

/**
 * Agenda o aviso de "faltam 5 minutos" e o encerramento automático da
 * chamada quando o usuário Nível 1 atinge o limite mensal (30 min).
 */
function scheduleCallLimitTimers(callId: string, remainingSeconds: number): void {
  const active = activeCalls.get(callId)
  if (!active) return

  const warnDelayMs = Math.max(0, remainingSeconds - CALL_LIMIT_WARNING_SECONDS) * 1000
  active.limitWarnTimer = setTimeout(() => {
    const current = activeCalls.get(callId)
    if (!current) return
    sendToUser(current.call.callerId, { type: 'call:limit_warning', callId, remainingSeconds: CALL_LIMIT_WARNING_SECONDS })
    sendToUser(current.call.calleeId, { type: 'call:limit_warning', callId, remainingSeconds: CALL_LIMIT_WARNING_SECONDS })
  }, warnDelayMs)

  active.limitEndTimer = setTimeout(async () => {
    const finalized = await finalizeCall(callId, 'ended')
    if (finalized) {
      sendToUser(finalized.callerId, { type: 'call:ended', callId, durationSeconds: finalized.durationSeconds ?? 0, reason: 'limit_reached' })
      sendToUser(finalized.calleeId, { type: 'call:ended', callId, durationSeconds: finalized.durationSeconds ?? 0, reason: 'limit_reached' })
    }
  }, remainingSeconds * 1000)
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
              } else {
                const preview = content.length > 80 ? `${content.slice(0, 77)}...` : content
                void notifyUser(peerId, 'new_message', user.fullName || 'Nova mensagem', preview, { conversationId })
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

          case 'call:invite': {
            const body = msg as { calleeId?: unknown; callType?: unknown }
            const calleeId = typeof body.calleeId === 'string' ? body.calleeId : ''
            const callType: CallType = body.callType === 'video' ? 'video' : 'voice'

            if (!calleeId) {
              send(ws, { type: 'error', message: 'call:invite requer calleeId.' })
              break
            }
            if (userActiveCall.has(user.id)) {
              send(ws, { type: 'call:busy' })
              break
            }
            try {
              const callee = await findById(calleeId)
              if (!callee || callee.role === user.role) {
                send(ws, { type: 'error', message: 'Só é possível ligar entre um usuário e um consultor.' })
                break
              }
              // "Atende somente um usuário por vez": consultor já ocupado (em
              // chamada ou já chamando/sendo chamado) não pode receber outra.
              if (userActiveCall.has(calleeId)) {
                send(ws, { type: 'call:busy' })
                break
              }
              if (!isUserOnline(calleeId)) {
                send(ws, { type: 'error', message: 'Este contato está offline agora.' })
                break
              }

              // Limite mensal do Nível 1 (30 min/mês) — verifica quem dos dois é o usuário
              // (o outro é sempre o consultor, que não tem limite de plano).
              const levelUser = user.role === 'user' ? user : callee
              const limitInfo = await getCallLimitInfo(levelUser.id, levelUser.planIds as import('@viver-saude/shared').PlanId[])
              if (limitInfo.limited && limitInfo.remainingSeconds <= 0) {
                send(ws, {
                  type: 'error',
                  message: 'Limite mensal de chamadas do Nível 1 atingido (30 min/mês). Assine o Nível 2 para chamadas ilimitadas.',
                })
                break
              }

              const call = await createCall(user.id, calleeId, callType)
              userActiveCall.set(user.id, call.id)
              userActiveCall.set(calleeId, call.id)

              const ringTimer = setTimeout(async () => {
                const finalized = await finalizeCall(call.id, 'missed')
                if (finalized) {
                  sendToUser(finalized.callerId, { type: 'call:missed', callId: call.id })
                  sendToUser(finalized.calleeId, { type: 'call:missed', callId: call.id })
                }
              }, RING_TIMEOUT_MS)
              activeCalls.set(call.id, { call, ringTimer })

              send(ws, { type: 'call:ringing', callId: call.id })
              sendToUser(calleeId, {
                type: 'call:incoming',
                callId: call.id,
                callerId: user.id,
                callerName: user.fullName ?? '',
                callerPhotoUrl: user.photoUrl ?? '',
                callType,
              })
              void notifyUser(
                calleeId,
                'incoming_call',
                'Chamada recebida',
                `${user.fullName || 'Alguém'} está te ligando (${callType === 'video' ? 'videochamada' : 'chamada de voz'}).`,
                { callId: call.id },
              )
            } catch (err) {
              console.error('[WS] Erro ao processar call:invite:', err)
              send(ws, { type: 'error', message: 'Falha ao iniciar chamada.' })
            }
            break
          }

          case 'call:accept': {
            const callId = typeof (msg as { callId?: unknown }).callId === 'string' ? (msg as { callId: string }).callId : ''
            if (!callId) { send(ws, { type: 'error', message: 'call:accept requer callId.' }); break }
            try {
              const call = await getCallById(callId)
              if (!call || call.calleeId !== user.id || call.status !== 'ringing') {
                send(ws, { type: 'error', message: 'Chamada não encontrada ou já finalizada.' })
                break
              }
              const active = activeCalls.get(callId)
              if (active?.ringTimer) clearTimeout(active.ringTimer)
              await markCallOngoing(callId)
              if (user.role === 'consultant') {
                await setConsultantStatus(user.id, 'in_call')
                broadcast({ type: 'presence', userId: user.id, role: 'consultant', status: 'in_call' })
              }
              sendToUser(call.callerId, { type: 'call:accepted', callId })
              send(ws, { type: 'call:accepted', callId })

              // Limite mensal do Nível 1 — agenda aviso (5 min antes) e encerramento
              // automático quando o tempo acabar. Não se aplica a Nível 2/3.
              const levelUser = user.role === 'user' ? user : await findById(call.callerId)
              if (levelUser) {
                const limitInfo = await getCallLimitInfo(levelUser.id, levelUser.planIds as import('@viver-saude/shared').PlanId[])
                if (limitInfo.limited && Number.isFinite(limitInfo.remainingSeconds)) {
                  scheduleCallLimitTimers(callId, limitInfo.remainingSeconds)
                }
              }
            } catch (err) {
              console.error('[WS] Erro ao processar call:accept:', err)
              send(ws, { type: 'error', message: 'Falha ao aceitar chamada.' })
            }
            break
          }

          case 'call:reject':
          case 'call:cancel':
          case 'call:end': {
            const callId = typeof (msg as { callId?: unknown }).callId === 'string' ? (msg as { callId: string }).callId : ''
            if (!callId) { send(ws, { type: 'error', message: `${type} requer callId.` }); break }
            try {
              const call = await getCallById(callId)
              if (!call || !isCallParticipant(call, user.id)) {
                send(ws, { type: 'error', message: 'Chamada não encontrada.' })
                break
              }
              const finalStatus = type === 'call:reject' ? 'rejected' : type === 'call:cancel' ? 'cancelled' : 'ended'
              const finalized = await finalizeCall(callId, finalStatus)
              if (!finalized) break // já tinha sido finalizada por outro motivo (ex: timeout)

              const otherParty = getOtherParty(finalized, user.id)
              const eventType = finalStatus === 'rejected' ? 'call:rejected'
                : finalStatus === 'cancelled' ? 'call:cancelled'
                : 'call:ended'
              sendToUser(otherParty, { type: eventType, callId, durationSeconds: finalized.durationSeconds ?? 0 } as ServerMessage)
              send(ws, { type: eventType, callId, durationSeconds: finalized.durationSeconds ?? 0 } as ServerMessage)
            } catch (err) {
              console.error(`[WS] Erro ao processar ${type}:`, err)
              send(ws, { type: 'error', message: 'Falha ao encerrar chamada.' })
            }
            break
          }

          case 'webrtc:offer':
          case 'webrtc:answer':
          case 'webrtc:ice': {
            const body = msg as { callId?: unknown; sdp?: unknown; candidate?: unknown }
            const callId = typeof body.callId === 'string' ? body.callId : ''
            if (!callId) { send(ws, { type: 'error', message: `${type} requer callId.` }); break }
            const active = activeCalls.get(callId)
            if (!active || !isCallParticipant(active.call, user.id)) {
              send(ws, { type: 'error', message: 'Chamada não encontrada ou já finalizada.' })
              break
            }
            const otherParty = getOtherParty(active.call, user.id)
            if (type === 'webrtc:offer') sendToUser(otherParty, { type: 'webrtc:offer', callId, sdp: body.sdp })
            else if (type === 'webrtc:answer') sendToUser(otherParty, { type: 'webrtc:answer', callId, sdp: body.sdp })
            else sendToUser(otherParty, { type: 'webrtc:ice', callId, candidate: body.candidate })
            break
          }

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
        // Se o usuário caiu no meio de uma chamada e não há outra conexão dele
        // ativa (multi-dispositivo), encerra a chamada como se tivesse desligado.
        const activeCallId = userActiveCall.get(user.id)
        if (activeCallId && !isUserOnline(user.id)) {
          finalizeCall(activeCallId, 'ended').then((finalized) => {
            if (finalized) {
              const otherParty = getOtherParty(finalized, user.id)
              sendToUser(otherParty, { type: 'call:ended', callId: activeCallId, durationSeconds: finalized.durationSeconds ?? 0 })
            }
          }).catch((err) => console.error('[WS] Erro ao finalizar chamada após desconexão:', err))
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
