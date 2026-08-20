import { useEffect, useRef, useState } from 'react'
import { realtimeService } from '../realtime/realtimeService'
import { callManager } from './callManager'
import { fetchConsultants, fetchConversations, fetchMessages, createConversation, markConversationRead } from './api'
import { AppointmentsPanel } from '../appointments/AppointmentsPanel'
import type { Consultant, ConversationMessage, ConversationSummary, MessageDeliveryStatus } from './types'

interface Props {
  token: string
  selfId: string
  role: 'user' | 'consultant'
}

function timeLabel(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  return sameDay
    ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function ConsultorSection({ token, selfId, role }: Props) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ConversationSummary | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [appointmentsOpen, setAppointmentsOpen] = useState(false)

  async function loadConversations() {
    try {
      const list = await fetchConversations(token)
      setConversations(list)
    } catch {
      // mantém lista atual em caso de falha temporária
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    fetchConversations(token)
      .then((list) => { if (active) setConversations(list) })
      .catch(() => { /* mantém lista atual em caso de falha temporária */ })
      .finally(() => { if (active) setLoading(false) })

    const unsubscribe = realtimeService.onMessage((msg) => {
      if (msg.type === 'chat:message' || msg.type === 'chat:status') {
        loadConversations()
      }
      if (msg.type === 'presence') {
        setConversations((prev) =>
          prev.map((c) => (c.peerId === msg.userId ? { ...c, peerStatus: String(msg.status) } : c)),
        )
      }
    })
    return () => { active = false; unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function openPicker() {
    setPickerOpen(true)
    try {
      const list = await fetchConsultants(token)
      setConsultants(list)
    } catch {
      setConsultants([])
    }
  }

  async function startConversation(peerId: string) {
    setPickerOpen(false)
    try {
      const conversation = await createConversation(token, peerId)
      setSelected(conversation)
      loadConversations()
    } catch {
      // silencioso — usuário pode tentar novamente pela lista
    }
  }

  if (selected) {
    return (
      <ChatThread
        token={token}
        selfId={selfId}
        conversation={selected}
        onBack={() => { setSelected(null); loadConversations() }}
      />
    )
  }

  return (
    <div className="chat-list-view">
      <div className="chat-list-header">
        <span className="chat-list-title">Consultor</span>
        <button type="button" className="chat-toolbar-btn" onClick={() => setAppointmentsOpen(true)} title={role === 'consultant' ? 'Minha agenda' : 'Minhas consultas'}>
          <i className="bi bi-calendar3" />
        </button>
        {role === 'user' && (
          <button type="button" className="chat-toolbar-btn" onClick={openPicker} title="Nova conversa">
            <i className="bi bi-plus-circle" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="chat-list-empty">Carregando…</div>
      ) : conversations.length === 0 ? (
        <div className="chat-list-empty">
          {role === 'user'
            ? 'Nenhuma conversa ainda. Toque em "+" para falar com um consultor.'
            : 'Nenhuma conversa ainda.'}
        </div>
      ) : (
        <ul className="chat-list">
          {conversations.map((c) => (
            <li key={c.id}>
              <button type="button" className="chat-list-item-btn" onClick={() => setSelected(c)}>
                <div className="consultor-avatar-wrap">
                  {c.peerPhotoUrl ? (
                    <img src={c.peerPhotoUrl} alt={c.peerName} className="consultor-avatar-img" />
                  ) : (
                    <div className="consultor-avatar-fallback">{(c.peerName || '?').charAt(0).toUpperCase()}</div>
                  )}
                  {c.peerRole === 'consultant' && (
                    <span className={`consultor-status-dot ${c.peerStatus === 'online' ? 'online' : 'offline'}`} />
                  )}
                </div>
                <div className="chat-list-item-info">
                  <span className="chat-list-item-title">{c.peerName || 'Usuário'}</span>
                  <span className="chat-list-item-meta">
                    {c.lastMessagePreview || c.peerSpecialty || ''}
                  </span>
                </div>
                <div className="consultor-list-trailing">
                  <span className="chat-list-item-meta">{timeLabel(c.lastMessageAt)}</span>
                  {c.unreadCount > 0 && <span className="consultor-unread-badge">{c.unreadCount}</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {pickerOpen && (
        <div className="plans-backdrop plans-backdrop-entered" onClick={() => setPickerOpen(false)}>
          <div
            className="plans-overlay plans-overlay-entered"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Escolha um consultor"
          >
            <div className="plans-overlay-handle" onClick={() => setPickerOpen(false)} />
            <div className="plans-overlay-header">
              <h2 className="plans-overlay-title">Escolha um consultor</h2>
              <button type="button" className="plans-overlay-close" onClick={() => setPickerOpen(false)} aria-label="Fechar">
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="plans-overlay-body">
              {consultants.length === 0 ? (
                <p className="drawer-section-sub">Nenhum consultor disponível no momento.</p>
              ) : (
                <ul className="chat-list">
                  {consultants.map((c) => (
                    <li key={c.id}>
                      <button type="button" className="chat-list-item-btn" onClick={() => startConversation(c.id)}>
                        <div className="consultor-avatar-wrap">
                          {c.photoUrl ? (
                            <img src={c.photoUrl} alt={c.fullName} className="consultor-avatar-img" />
                          ) : (
                            <div className="consultor-avatar-fallback">{c.fullName.charAt(0).toUpperCase()}</div>
                          )}
                          <span className={`consultor-status-dot ${c.status === 'online' ? 'online' : 'offline'}`} />
                        </div>
                        <div className="chat-list-item-info">
                          <span className="chat-list-item-title">{c.fullName}</span>
                          <span className="chat-list-item-meta">{c.specialty || 'Consultor'}</span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {appointmentsOpen && (
        <AppointmentsPanel token={token} role={role} onClose={() => setAppointmentsOpen(false)} />
      )}
    </div>
  )
}

// ── Thread de mensagens ─────────────────────────────────────

function statusIcon(status: MessageDeliveryStatus): string {
  switch (status) {
    case 'sending': return 'bi-clock'
    case 'sent': return 'bi-check'
    case 'delivered': return 'bi-check2-all'
    case 'read': return 'bi-check2-all text-info'
    default: return 'bi-check'
  }
}

function ChatThread({
  token,
  selfId,
  conversation,
  onBack,
}: {
  token: string
  selfId: string
  conversation: ConversationSummary
  onBack: () => void
}) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function markRead() {
    try {
      await markConversationRead(token, conversation.id)
    } catch {
      // não crítico
    }
  }

  useEffect(() => {
    let active = true
    fetchMessages(token, conversation.id).then((list) => {
      if (!active) return
      setMessages(list)
      setLoading(false)
      markRead()
    }).catch(() => { if (active) setLoading(false) })

    const unsubscribe = realtimeService.onMessage((msg) => {
      if (msg.type === 'chat:ack') {
        const clientId = msg.clientId as string | undefined
        const message = msg.message as ConversationMessage
        if (message.conversationId !== conversation.id) return
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.clientId === clientId)
          if (idx !== -1) {
            const copy = [...prev]
            copy[idx] = message
            return copy
          }
          return [...prev, message]
        })
      }
      if (msg.type === 'chat:message') {
        const message = msg.message as ConversationMessage
        if (message.conversationId !== conversation.id) return
        setMessages((prev) => [...prev, message])
        markRead()
      }
      if (msg.type === 'chat:status' && msg.conversationId === conversation.id) {
        const ids = new Set((msg.messageIds as string[]) ?? [])
        const status = msg.status as MessageDeliveryStatus
        setMessages((prev) => prev.map((m) => (ids.has(m.id) ? { ...m, status } : m)))
      }
    })
    return () => { active = false; unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  function send() {
    const content = text.trim()
    if (!content) return
    const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setMessages((prev) => [
      ...prev,
      {
        id: clientId,
        conversationId: conversation.id,
        senderId: selfId,
        content,
        status: 'sending',
        createdAt: new Date().toISOString(),
        clientId,
      },
    ])
    setText('')
    realtimeService.send({ type: 'chat:send', conversationId: conversation.id, content, clientId })
  }

  return (
    <div className="guardiao-wrapper">
      <div className="chat-toolbar">
        <button type="button" className="chat-toolbar-btn" onClick={onBack} aria-label="Voltar">
          <i className="bi bi-arrow-left" />
        </button>
        <span className="chat-toolbar-title">
          {conversation.peerName || 'Usuário'}
          {conversation.peerRole === 'consultant' && (
            <span style={{ marginLeft: 8, fontSize: 12, color: conversation.peerStatus === 'online' ? '#2e7d5e' : '#8a9a92' }}>
              {conversation.peerStatus === 'online' ? '● online' : '● offline'}
            </span>
          )}
        </span>
        <button
          type="button"
          className="chat-toolbar-btn"
          onClick={() => callManager.startCall(conversation.peerId, conversation.peerName, conversation.peerPhotoUrl, 'voice')}
          aria-label="Chamada de voz"
          title="Chamada de voz"
        >
          <i className="bi bi-telephone" />
        </button>
        <button
          type="button"
          className="chat-toolbar-btn"
          onClick={() => callManager.startCall(conversation.peerId, conversation.peerName, conversation.peerPhotoUrl, 'video')}
          aria-label="Videochamada"
          title="Videochamada"
        >
          <i className="bi bi-camera-video" />
        </button>
      </div>

      <div className="guardiao-messages">
        {loading ? (
          <div className="chat-list-empty">Carregando…</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`chat-message ${m.senderId === selfId ? 'user' : 'ai'}`}>
              <div>{m.content}</div>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 4, opacity: 0.75, fontSize: 11 }}>
                <span>{new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                {m.senderId === selfId && <i className={`bi ${statusIcon(m.status)}`} />}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <input
          type="text"
          className="chat-input"
          placeholder="Digite uma mensagem..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send() }}
        />
        <button type="button" className="chat-toolbar-btn" onClick={send} aria-label="Enviar">
          <i className="bi bi-send-fill" />
        </button>
      </div>
    </div>
  )
}
