// ── Tipos do módulo de comunicação (chat usuário ↔ consultor) ─────────

export interface Consultant {
  id: string
  fullName: string
  photoUrl: string
  specialty: string
  bio: string
  status: 'offline' | 'online' | 'in_call'
}

export interface ConversationSummary {
  id: string
  userId: string
  consultantId: string
  peerId: string
  peerName: string
  peerPhotoUrl: string
  peerRole: 'user' | 'consultant'
  peerSpecialty: string | null
  peerStatus: string | null
  lastMessagePreview: string
  lastMessageAt: string | null
  unreadCount: number
}

export type MessageDeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read'

export interface ConversationMessage {
  id: string
  conversationId: string
  senderId: string
  content: string
  status: MessageDeliveryStatus
  createdAt: string
  /** Id temporário usado para casar a mensagem otimista com a confirmação do servidor. */
  clientId?: string
}
