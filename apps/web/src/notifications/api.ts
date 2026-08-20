export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

function authHeaders(token: string): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

export async function fetchNotifications(token: string): Promise<{ notifications: AppNotification[]; unreadCount: number }> {
  const res = await fetch('/api/notifications', { headers: authHeaders(token) })
  if (!res.ok) throw new Error('Falha ao buscar notificações.')
  return res.json()
}

export async function markNotificationRead(token: string, id: string): Promise<void> {
  await fetch(`/api/notifications/${id}/read`, { method: 'POST', headers: authHeaders(token) })
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  await fetch('/api/notifications/read-all', { method: 'POST', headers: authHeaders(token) })
}
