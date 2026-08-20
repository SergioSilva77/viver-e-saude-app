import { realtimeService } from '../realtime/realtimeService'
import { fetchNotifications, markNotificationRead, markAllNotificationsRead, type AppNotification } from './api'

type Listener = () => void

/**
 * Estado global das notificações in-app (sininho + bolinha vermelha) no
 * web — mesmo padrão do Flutter: carrega via REST e atualiza em tempo
 * real via WebSocket (Módulo 1), sem depender de push do navegador.
 */
class NotificationCenterImpl {
  private token = ''
  notifications: AppNotification[] = []
  unreadCount = 0
  loading = false

  private listeners = new Set<Listener>()

  constructor() {
    realtimeService.onMessage((msg) => {
      if (msg.type !== 'notification') return
      const notification = msg.notification as unknown as AppNotification
      if (!notification) return
      this.notifications = [notification, ...this.notifications]
      this.unreadCount += 1
      this.emit()
    })
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    this.listeners.forEach((l) => l())
  }

  setToken(token: string): void {
    this.token = token
  }

  reset(): void {
    this.notifications = []
    this.unreadCount = 0
    this.emit()
  }

  async load(): Promise<void> {
    if (!this.token) return
    this.loading = true
    this.emit()
    try {
      const result = await fetchNotifications(this.token)
      this.notifications = result.notifications
      this.unreadCount = result.unreadCount
    } catch {
      // mantém lista atual se a API falhar
    } finally {
      this.loading = false
      this.emit()
    }
  }

  async markRead(id: string): Promise<void> {
    const idx = this.notifications.findIndex((n) => n.id === id)
    if (idx !== -1 && !this.notifications[idx].readAt) {
      this.notifications[idx] = { ...this.notifications[idx], readAt: new Date().toISOString() }
      this.unreadCount = Math.max(0, this.unreadCount - 1)
      this.emit()
    }
    try {
      await markNotificationRead(this.token, id)
    } catch {
      // já refletido localmente
    }
  }

  async markAllRead(): Promise<void> {
    this.notifications = this.notifications.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() }))
    this.unreadCount = 0
    this.emit()
    try {
      await markAllNotificationsRead(this.token)
    } catch {
      // idem
    }
  }
}

export const notificationCenter = new NotificationCenterImpl()
export type { AppNotification }
