/**
 * Cliente do WebSocket de sinalização (Módulo 1: só conexão + presença).
 *
 * Módulos futuros (chat, chamadas) vão usar `subscribe()` para receber mais
 * tipos de evento — não é necessário criar outro serviço, só reagir a mais
 * `type`s no listener.
 */

export type RealtimeStatus = 'disconnected' | 'connecting' | 'connected'

export interface RealtimeMessage {
  type: string
  [key: string]: unknown
}

type StatusListener = (status: RealtimeStatus) => void
type MessageListener = (message: RealtimeMessage) => void

class RealtimeServiceImpl {
  private socket: WebSocket | null = null
  private status: RealtimeStatus = 'disconnected'
  private currentToken: string | null = null
  private manuallyClosed = true
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private statusListeners = new Set<StatusListener>()
  private messageListeners = new Set<MessageListener>()
  private pendingQueue: RealtimeMessage[] = []

  getStatus(): RealtimeStatus {
    return this.status
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener)
    return () => this.messageListeners.delete(listener)
  }

  private wsUrlFor(token: string): string {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
    return `${scheme}://${window.location.host}/ws?token=${encodeURIComponent(token)}`
  }

  /** Conecta (ou reconecta) usando o token JWT do usuário logado. */
  connect(token: string | undefined | null): void {
    if (!token) return
    this.manuallyClosed = false
    this.currentToken = token
    this.open()
  }

  private open(): void {
    this.setStatus('connecting')
    try {
      const socket = new WebSocket(this.wsUrlFor(this.currentToken!))
      this.socket = socket

      socket.onmessage = (event) => {
        this.setStatus('connected')
        this.flushQueue()
        try {
          const decoded = JSON.parse(event.data as string)
          if (decoded && typeof decoded === 'object') {
            this.messageListeners.forEach((listener) => listener(decoded as RealtimeMessage))
          }
        } catch {
          // Mensagem não-JSON — ignora silenciosamente (protocolo é sempre JSON).
        }
      }

      socket.onclose = () => this.handleClosed()
      socket.onerror = () => { /* onclose é disparado em seguida */ }
    } catch {
      this.handleClosed()
    }
  }

  private handleClosed(): void {
    this.setStatus('disconnected')
    this.socket = null
    if (!this.manuallyClosed) this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => {
      if (!this.manuallyClosed && this.currentToken) this.open()
    }, 4000)
  }

  /** Envia uma mensagem já estruturada (ex.: {type: 'ping'}). Fica em fila se offline. */
  send(message: RealtimeMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message))
    } else {
      this.pendingQueue.push(message)
    }
  }

  private flushQueue(): void {
    if (this.pendingQueue.length === 0 || this.socket?.readyState !== WebSocket.OPEN) return
    const pending = [...this.pendingQueue]
    this.pendingQueue = []
    for (const message of pending) {
      this.socket.send(JSON.stringify(message))
    }
  }

  disconnect(): void {
    this.manuallyClosed = true
    this.currentToken = null
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.socket?.close()
    this.socket = null
    this.pendingQueue = []
    this.setStatus('disconnected')
  }

  private setStatus(value: RealtimeStatus): void {
    if (this.status === value) return
    this.status = value
    this.statusListeners.forEach((listener) => listener(value))
  }
}

/** Singleton — uma única conexão WS por aba do navegador. */
export const realtimeService = new RealtimeServiceImpl()
