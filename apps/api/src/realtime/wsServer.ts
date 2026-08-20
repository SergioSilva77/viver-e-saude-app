import type { Server as HttpServer } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { verifyUserToken } from '../auth.js'
import { findById } from '../userStore.js'
import { setConsultantStatus } from '../consultantStore.js'

// ── Signaling / presence WebSocket server ──────────────────
// Módulo 1: só autenticação + presença + ping/pong (walking skeleton).
// Módulos futuros (chat, chamadas) vão adicionar novos `type` de mensagem
// aqui dentro, reaproveitando a mesma conexão/autenticação.

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

type ServerMessage =
  | { type: 'connected'; userId: string; role: string }
  | { type: 'pong'; ts: number }
  | { type: 'presence'; userId: string; role: 'consultant'; status: 'online' | 'offline' }
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

      ws.on('message', (raw) => {
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
          // Módulo 2 (chat) e Módulo 3 (chamadas) vão adicionar novos cases aqui.
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
