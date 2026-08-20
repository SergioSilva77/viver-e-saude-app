import type { Consultant, ConversationMessage, ConversationSummary } from './types'

// ── API do módulo de comunicação — todas exigem o token JWT (Módulo 1) ──

function authHeaders(token: string): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

async function unwrap<T>(res: Response, key: string): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message ?? `Erro ${res.status}`)
  }
  const data = await res.json()
  return (data[key] ?? data) as T
}

export async function fetchConsultants(token: string): Promise<Consultant[]> {
  const res = await fetch('/api/consultants', { headers: authHeaders(token) })
  return unwrap<Consultant[]>(res, 'consultants')
}

export async function fetchConversations(token: string): Promise<ConversationSummary[]> {
  const res = await fetch('/api/conversations', { headers: authHeaders(token) })
  return unwrap<ConversationSummary[]>(res, 'conversations')
}

export async function createConversation(token: string, peerId: string): Promise<ConversationSummary> {
  const res = await fetch('/api/conversations', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ peerId }),
  })
  return unwrap<ConversationSummary>(res, 'conversation')
}

export async function fetchMessages(token: string, conversationId: string): Promise<ConversationMessage[]> {
  const res = await fetch(`/api/conversations/${conversationId}/messages`, { headers: authHeaders(token) })
  return unwrap<ConversationMessage[]>(res, 'messages')
}

export async function markConversationRead(token: string, conversationId: string): Promise<void> {
  await fetch(`/api/conversations/${conversationId}/read`, { method: 'POST', headers: authHeaders(token) })
}
