import { randomUUID } from 'node:crypto'
import { query } from './db.js'

// ── Notificações in-app (sininho) + tokens de dispositivo (push) ──

export type NotificationType =
  | 'new_message'
  | 'incoming_call'
  | 'appointment_confirmed'
  | 'appointment_reminder'
  | 'appointment_declined'
  | 'appointment_cancelled'

export interface AppNotification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  data: Record<string, unknown>
  readAt: Date | null
  createdAt: Date
}

interface NotificationRow {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  data: Record<string, unknown>
  read_at: Date | null
  created_at: Date
}

function rowToNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data ?? {},
    readAt: row.read_at,
    createdAt: row.created_at,
  }
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<AppNotification> {
  const id = randomUUID()
  const { rows } = await query<NotificationRow>(
    `INSERT INTO notifications (id, user_id, type, title, body, data)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, userId, type, title, body, JSON.stringify(data)],
  )
  return rowToNotification(rows[0])
}

export async function listNotifications(userId: string, limit = 30): Promise<AppNotification[]> {
  const { rows } = await query<NotificationRow>(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit],
  )
  return rows.map(rowToNotification)
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  )
  return Number(rows[0]?.count ?? 0)
}

export async function markNotificationRead(id: string, userId: string): Promise<void> {
  await query(
    `UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
    [id, userId],
  )
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await query(
    `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  )
}

// ── Tokens de dispositivo (FCM) ─────────────────────────────

export async function registerDeviceToken(userId: string, token: string, platform: string): Promise<void> {
  await query(
    `INSERT INTO device_tokens (token, user_id, platform)
     VALUES ($1, $2, $3)
     ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, updated_at = NOW()`,
    [token, userId, platform],
  )
}

export async function unregisterDeviceToken(token: string): Promise<void> {
  await query(`DELETE FROM device_tokens WHERE token = $1`, [token])
}

export async function removeDeviceTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return
  await query(`DELETE FROM device_tokens WHERE token = ANY($1)`, [tokens])
}

export async function getDeviceTokensForUser(userId: string): Promise<string[]> {
  const { rows } = await query<{ token: string }>(
    `SELECT token FROM device_tokens WHERE user_id = $1`,
    [userId],
  )
  return rows.map((r) => r.token)
}
