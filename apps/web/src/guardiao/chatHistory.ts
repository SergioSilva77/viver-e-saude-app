// ── Types ──────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export interface StoredChat {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
}

// ── Constants ──────────────────────────────────────────────

const API_URL = ''

// ── Active chat pointer (localStorage is fine for this) ────

function activeChatKey(userId?: string): string {
  return userId ? `vs_guardiao_active_chat_${userId}` : 'vs_guardiao_active_chat'
}

export function loadActiveChatId(userId?: string): string | null {
  return localStorage.getItem(activeChatKey(userId))
}

export function saveActiveChatId(chatId: string | null, userId?: string): void {
  if (chatId === null) {
    localStorage.removeItem(activeChatKey(userId))
  } else {
    localStorage.setItem(activeChatKey(userId), chatId)
  }
}

// ── API-backed CRUD ────────────────────────────────────────

export async function loadChats(userId?: string): Promise<StoredChat[]> {
  if (!userId) return []
  try {
    const res = await fetch(`${API_URL}/api/ai/chats?userId=${encodeURIComponent(userId)}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.map((c: any) => ({
      id: c.id,
      title: c.title,
      createdAt: new Date(c.createdAt).getTime(),
      updatedAt: new Date(c.updatedAt).getTime(),
      messages: [], // messages loaded separately
    }))
  } catch {
    return []
  }
}

export async function loadChatMessages(chatId: string, userId?: string): Promise<ChatMessage[]> {
  if (!userId) return []
  try {
    const res = await fetch(`${API_URL}/api/ai/chats/${chatId}?userId=${encodeURIComponent(userId)}`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.messages ?? []).map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content,
    }))
  } catch {
    return []
  }
}

export async function createChat(userId?: string, title?: string): Promise<StoredChat> {
  const now = Date.now()
  if (!userId) {
    // Fallback for anonymous: local only
    return { id: `chat-${now}`, title: title ?? 'Nova conversa', createdAt: now, updatedAt: now, messages: [] }
  }
  try {
    const res = await fetch(`${API_URL}/api/ai/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, title }),
    })
    if (!res.ok) throw new Error('Failed')
    const data = await res.json()
    return {
      id: data.id,
      title: data.title,
      createdAt: new Date(data.createdAt).getTime(),
      updatedAt: new Date(data.updatedAt).getTime(),
      messages: [],
    }
  } catch {
    return { id: `chat-${now}`, title: title ?? 'Nova conversa', createdAt: now, updatedAt: now, messages: [] }
  }
}

export async function deleteChat(chatId: string, userId?: string): Promise<void> {
  if (!userId) return
  try {
    await fetch(`${API_URL}/api/ai/chats/${chatId}?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    })
  } catch { /* best effort */ }
}

export async function generateTitle(chatId: string, firstMessage: string, userId?: string): Promise<string> {
  if (!userId) return firstMessage.slice(0, 50)
  try {
    const res = await fetch(`${API_URL}/api/ai/chats/${chatId}/title`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, firstMessage }),
    })
    if (!res.ok) return firstMessage.slice(0, 50)
    const data = await res.json()
    return data.title || firstMessage.slice(0, 50)
  } catch {
    return firstMessage.slice(0, 50)
  }
}

export function clearChats(_userId?: string): void {
  // Nothing to clear server-side; just remove the active chat pointer
  localStorage.removeItem(activeChatKey(_userId))
}

// ── Context window ──────────────────────────────────────────

/** Returns the last N messages to send to the API, keeping context bounded. */
export function getContextWindow(messages: ChatMessage[], limit = 10): ChatMessage[] {
  return messages.slice(-limit)
}
