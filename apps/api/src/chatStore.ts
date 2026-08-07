import { query } from './db.js'

// ── Types ──────────────────────────────────────────────────

export interface StoredChatMessage {
  id: string
  chatId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

export interface StoredChat {
  id: string
  userId: string
  title: string
  createdAt: Date
  updatedAt: Date
  messages?: StoredChatMessage[]
}

// ── Chat CRUD ──────────────────────────────────────────────

export async function listChats(userId: string): Promise<StoredChat[]> {
  const { rows } = await query<{ id: string; user_id: string; title: string; created_at: Date; updated_at: Date }>(
    `SELECT id, user_id, title, created_at, updated_at
     FROM chats
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT 50`,
    [userId],
  )
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    title: r.title,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}

export async function getChat(chatId: string, userId: string): Promise<StoredChat | null> {
  const { rows } = await query<{ id: string; user_id: string; title: string; created_at: Date; updated_at: Date }>(
    `SELECT id, user_id, title, created_at, updated_at
     FROM chats
     WHERE id = $1 AND user_id = $2`,
    [chatId, userId],
  )
  if (rows.length === 0) return null
  const r = rows[0]
  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export async function getChatWithMessages(chatId: string, userId: string): Promise<StoredChat | null> {
  const chat = await getChat(chatId, userId)
  if (!chat) return null

  const { rows } = await query<{ id: string; chat_id: string; role: 'user' | 'assistant'; content: string; created_at: Date }>(
    `SELECT id, chat_id, role, content, created_at
     FROM chat_messages
     WHERE chat_id = $1
     ORDER BY created_at ASC`,
    [chatId],
  )

  chat.messages = rows.map((r) => ({
    id: r.id,
    chatId: r.chat_id,
    role: r.role,
    content: r.content,
    createdAt: r.created_at,
  }))

  return chat
}

export async function createChat(userId: string, title?: string): Promise<StoredChat> {
  const id = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const now = new Date()

  await query(
    `INSERT INTO chats (id, user_id, title, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, userId, title ?? 'Nova conversa', now, now],
  )

  return { id, userId, title: title ?? 'Nova conversa', createdAt: now, updatedAt: now }
}

export async function updateChatTitle(chatId: string, userId: string, title: string): Promise<void> {
  await query(
    `UPDATE chats SET title = $3, updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [chatId, userId, title],
  )
}

export async function touchChat(chatId: string): Promise<void> {
  await query(
    `UPDATE chats SET updated_at = NOW() WHERE id = $1`,
    [chatId],
  )
}

export async function deleteChat(chatId: string, userId: string): Promise<void> {
  await query(
    `DELETE FROM chats WHERE id = $1 AND user_id = $2`,
    [chatId, userId],
  )
}

// ── Message CRUD ───────────────────────────────────────────

export async function addMessage(
  chatId: string,
  role: 'user' | 'assistant',
  content: string,
): Promise<StoredChatMessage> {
  const id = `${role === 'user' ? 'u' : 'a'}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
  const now = new Date()

  await query(
    `INSERT INTO chat_messages (id, chat_id, role, content, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, chatId, role, content, now],
  )

  // Touch the parent chat's updated_at
  await touchChat(chatId)

  return { id, chatId, role, content, createdAt: now }
}

export async function getMessages(chatId: string): Promise<StoredChatMessage[]> {
  const { rows } = await query<{ id: string; chat_id: string; role: 'user' | 'assistant'; content: string; created_at: Date }>(
    `SELECT id, chat_id, role, content, created_at
     FROM chat_messages
     WHERE chat_id = $1
     ORDER BY created_at ASC`,
    [chatId],
  )
  return rows.map((r) => ({
    id: r.id,
    chatId: r.chat_id,
    role: r.role,
    content: r.content,
    createdAt: r.created_at,
  }))
}
