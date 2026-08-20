import { randomUUID } from 'node:crypto'
import { query } from './db.js'

// ── Chat humano ↔ humano (usuário ↔ consultor) ─────────────
// Tabelas próprias (conversations / conversation_messages) — NÃO confundir
// com `chats`/`chat_messages`, que são exclusivas do chat com a IA (MeuGuardião).

export type MessageStatus = 'sent' | 'delivered' | 'read'

export interface Conversation {
  id: string
  userId: string
  consultantId: string
  createdAt: Date
  updatedAt: Date
  lastMessagePreview: string
  lastMessageAt: Date | null
}

export interface ConversationWithPeer extends Conversation {
  peerId: string
  peerName: string
  peerPhotoUrl: string
  peerRole: 'user' | 'consultant'
  peerSpecialty: string | null
  peerStatus: string | null
  unreadCount: number
}

export interface ConversationMessage {
  id: string
  conversationId: string
  senderId: string
  content: string
  status: MessageStatus
  createdAt: Date
  deliveredAt: Date | null
  readAt: Date | null
}

interface ConversationRow {
  id: string
  user_id: string
  consultant_id: string
  created_at: Date
  updated_at: Date
  last_message_preview: string
  last_message_at: Date | null
}

interface MessageRow {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  status: MessageStatus
  created_at: Date
  delivered_at: Date | null
  read_at: Date | null
}

function rowToConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    userId: row.user_id,
    consultantId: row.consultant_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessagePreview: row.last_message_preview ?? '',
    lastMessageAt: row.last_message_at,
  }
}

function rowToMessage(row: MessageRow): ConversationMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
    deliveredAt: row.delivered_at,
    readAt: row.read_at,
  }
}

/** Verdadeiro se `userId` for um dos dois participantes da conversa. */
export function isParticipant(conversation: Conversation, userId: string): boolean {
  return conversation.userId === userId || conversation.consultantId === userId
}

/** Retorna o id do "outro lado" da conversa em relação a `selfId`. */
export function getPeerId(conversation: Conversation, selfId: string): string {
  return conversation.userId === selfId ? conversation.consultantId : conversation.userId
}

export async function getConversationById(id: string): Promise<Conversation | null> {
  const { rows } = await query<ConversationRow>('SELECT * FROM conversations WHERE id = $1 LIMIT 1', [id])
  return rows.length > 0 ? rowToConversation(rows[0]) : null
}

/** Cria a conversa entre um usuário e um consultor, ou retorna a já existente. */
export async function getOrCreateConversation(userId: string, consultantId: string): Promise<Conversation> {
  const existing = await query<ConversationRow>(
    'SELECT * FROM conversations WHERE user_id = $1 AND consultant_id = $2 LIMIT 1',
    [userId, consultantId],
  )
  if (existing.rows.length > 0) return rowToConversation(existing.rows[0])

  const id = randomUUID()
  const { rows } = await query<ConversationRow>(
    `INSERT INTO conversations (id, user_id, consultant_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, consultant_id) DO UPDATE SET updated_at = conversations.updated_at
     RETURNING *`,
    [id, userId, consultantId],
  )
  return rowToConversation(rows[0])
}

/** Lista as conversas do usuário logado (funciona tanto para papel 'user' quanto 'consultant'). */
export async function listConversationsForUser(selfId: string): Promise<ConversationWithPeer[]> {
  const { rows } = await query<
    ConversationRow & {
      peer_id: string
      peer_name: string
      peer_photo: string
      peer_role: 'user' | 'consultant'
      peer_specialty: string | null
      peer_status: string | null
      unread_count: string
    }
  >(
    `SELECT c.*,
            CASE WHEN c.user_id = $1 THEN c.consultant_id ELSE c.user_id END AS peer_id,
            u.full_name AS peer_name,
            u.photo_url AS peer_photo,
            u.role AS peer_role,
            cp.specialty AS peer_specialty,
            cp.status AS peer_status,
            (SELECT COUNT(*) FROM conversation_messages m
              WHERE m.conversation_id = c.id AND m.sender_id != $1 AND m.status != 'read') AS unread_count
     FROM conversations c
     JOIN users u ON u.id = CASE WHEN c.user_id = $1 THEN c.consultant_id ELSE c.user_id END
     LEFT JOIN consultant_profiles cp ON cp.user_id = u.id
     WHERE c.user_id = $1 OR c.consultant_id = $1
     ORDER BY c.last_message_at DESC NULLS LAST, c.updated_at DESC`,
    [selfId],
  )

  return rows.map((row) => ({
    ...rowToConversation(row),
    peerId: row.peer_id,
    peerName: row.peer_name ?? '',
    peerPhotoUrl: row.peer_photo ?? '',
    peerRole: row.peer_role ?? 'user',
    peerSpecialty: row.peer_specialty,
    peerStatus: row.peer_status,
    unreadCount: Number(row.unread_count ?? 0),
  }))
}

/** Histórico paginado (mais recentes primeiro na query, ordem cronológica no retorno). */
export async function getMessages(
  conversationId: string,
  opts: { before?: string; limit?: number } = {},
): Promise<ConversationMessage[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100)
  const { rows } = opts.before
    ? await query<MessageRow>(
        `SELECT * FROM conversation_messages
         WHERE conversation_id = $1 AND created_at < (SELECT created_at FROM conversation_messages WHERE id = $2)
         ORDER BY created_at DESC LIMIT $3`,
        [conversationId, opts.before, limit],
      )
    : await query<MessageRow>(
        `SELECT * FROM conversation_messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [conversationId, limit],
      )
  return rows.map(rowToMessage).reverse()
}

export async function addMessage(conversationId: string, senderId: string, content: string): Promise<ConversationMessage> {
  const id = randomUUID()
  const { rows } = await query<MessageRow>(
    `INSERT INTO conversation_messages (id, conversation_id, sender_id, content)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [id, conversationId, senderId, content],
  )

  const preview = content.length > 120 ? `${content.slice(0, 117)}...` : content
  await query(
    `UPDATE conversations SET last_message_preview = $1, last_message_at = NOW(), updated_at = NOW() WHERE id = $2`,
    [preview, conversationId],
  )

  return rowToMessage(rows[0])
}

export async function markMessageDelivered(messageId: string): Promise<void> {
  await query(
    `UPDATE conversation_messages SET status = 'delivered', delivered_at = NOW() WHERE id = $1 AND status = 'sent'`,
    [messageId],
  )
}

/** Marca como entregues as mensagens pendentes de uma conversa endereçadas a `recipientId`. */
export async function markDeliveredInConversation(
  conversationId: string,
  recipientId: string,
): Promise<{ id: string; senderId: string }[]> {
  const { rows } = await query<{ id: string; sender_id: string }>(
    `UPDATE conversation_messages
     SET status = 'delivered', delivered_at = NOW()
     WHERE conversation_id = $1 AND sender_id != $2 AND status = 'sent'
     RETURNING id, sender_id`,
    [conversationId, recipientId],
  )
  return rows.map((r) => ({ id: r.id, senderId: r.sender_id }))
}

/**
 * Marca como entregues TODAS as mensagens pendentes endereçadas a `userId`,
 * em qualquer conversa dele — chamado quando o usuário conecta no WebSocket.
 * Retorna os afetados agrupados por conversa, para notificar os remetentes.
 */
export async function markDeliveredForUserEverywhere(
  userId: string,
): Promise<{ conversationId: string; messageIds: string[]; senderId: string }[]> {
  const { rows } = await query<{ id: string; conversation_id: string; sender_id: string }>(
    `UPDATE conversation_messages cm
     SET status = 'delivered', delivered_at = NOW()
     FROM conversations c
     WHERE cm.conversation_id = c.id
       AND (c.user_id = $1 OR c.consultant_id = $1)
       AND cm.sender_id != $1
       AND cm.status = 'sent'
     RETURNING cm.id, cm.conversation_id, cm.sender_id`,
    [userId],
  )

  const grouped = new Map<string, { conversationId: string; messageIds: string[]; senderId: string }>()
  for (const row of rows) {
    const key = `${row.conversation_id}:${row.sender_id}`
    if (!grouped.has(key)) grouped.set(key, { conversationId: row.conversation_id, messageIds: [], senderId: row.sender_id })
    grouped.get(key)!.messageIds.push(row.id)
  }
  return Array.from(grouped.values())
}

/** Marca como lidas as mensagens de uma conversa não enviadas por `readerId`. Retorna ids afetados + remetente. */
export async function markRead(
  conversationId: string,
  readerId: string,
): Promise<{ id: string; senderId: string }[]> {
  const { rows } = await query<{ id: string; sender_id: string }>(
    `UPDATE conversation_messages
     SET status = 'read', read_at = NOW()
     WHERE conversation_id = $1 AND sender_id != $2 AND status != 'read'
     RETURNING id, sender_id`,
    [conversationId, readerId],
  )
  return rows.map((r) => ({ id: r.id, senderId: r.sender_id }))
}
