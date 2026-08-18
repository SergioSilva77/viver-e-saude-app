import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  createChat,
  deleteChat,
  generateTitle,
  getContextWindow,
  loadActiveChatId,
  loadChatMessages,
  loadChats,
  saveActiveChatId,
  type ChatMessage,
  type StoredChat,
} from './chatHistory'

// ── Types ──────────────────────────────────────────────────

export type { ChatMessage }

export interface UserProfile {
  name?: string
  age?: number
  weightKg?: number
  heightCm?: number
  bloodType?: string
  goals?: string[]
  familyHistory?: { relation: string; notes: string }[]
}

interface Props {
  userProfile?: UserProfile
  /** Authenticated user ID for token usage tracking. */
  userId?: string
  /** Authenticated user email for token usage tracking. */
  userEmail?: string
  /** Timestamp until guardiao is fully unlocked (null = always show limited UI) */
  guardiao24hUntil?: number | null
  onViewPlans?: () => void
}

// ── Constants ──────────────────────────────────────────────

const API_URL = ''

// ── Sub-components ─────────────────────────────────────────

function ThinkingDots() {
  return (
    <div className="chat-message ai chat-thinking" aria-label="IA está pensando">
      <span className="thinking-dot" />
      <span className="thinking-dot" />
      <span className="thinking-dot" />
    </div>
  )
}

function formatChatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  if (isToday) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ── Chat list view ──────────────────────────────────────────

interface ChatListProps {
  chats: StoredChat[]
  activeChatId: string | null
  onSelect: (chat: StoredChat) => void
  onNew: () => void
  onDelete: (chatId: string) => void
}

function ChatListView({ chats, activeChatId, onSelect, onNew, onDelete }: ChatListProps) {
  return (
    <div className="chat-list-view">
      <div className="chat-list-header">
        <span className="chat-list-title">Conversas</span>
        <button type="button" className="btn-new-chat" onClick={onNew} aria-label="Nova conversa">
          <i className="bi bi-plus-lg" />
          Nova conversa
        </button>
      </div>

      {chats.length === 0 ? (
        <div className="chat-list-empty">
          <i className="bi bi-chat-heart" />
          <p>Nenhuma conversa ainda.<br />Toque em "Nova conversa" para começar.</p>
        </div>
      ) : (
        <ul className="chat-list">
          {chats.map((chat) => (
            <li key={chat.id} className={`chat-list-item ${chat.id === activeChatId ? 'chat-list-item-active' : ''}`}>
              <button
                type="button"
                className="chat-list-item-btn"
                onClick={() => onSelect(chat)}
              >
                <div className="chat-list-item-info">
                  <span className="chat-list-item-title">{chat.title}</span>
                  <span className="chat-list-item-meta">
                    {formatChatDate(chat.updatedAt)}
                  </span>
                </div>
              </button>
              <button
                type="button"
                className="chat-list-item-delete"
                onClick={(e) => { e.stopPropagation(); onDelete(chat.id) }}
                aria-label="Excluir conversa"
              >
                <i className="bi bi-trash3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────

export function MeuGuardiao({ userProfile, userId, userEmail, guardiao24hUntil, onViewPlans }: Props) {
  const [chats, setChats] = useState<StoredChat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([])
  const [view, setView] = useState<'chat' | 'list'>('chat')
  const [inputText, setInputText] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // The title currently shown in the toolbar
  const [activeTitle, setActiveTitle] = useState('Nova conversa')

  // Load chats from API on mount
  useEffect(() => {
    let cancelled = false
    async function init() {
      setIsLoading(true)
      const loaded = await loadChats(userId)
      if (cancelled) return

      if (loaded.length === 0) {
        const fresh = await createChat(userId)
        if (cancelled) return
        setChats([fresh])
        setActiveChatId(fresh.id)
        setActiveTitle(fresh.title)
        saveActiveChatId(fresh.id, userId)
      } else {
        setChats(loaded)
        const savedId = loadActiveChatId(userId)
        const found = savedId ? loaded.find((c) => c.id === savedId) : null
        const activeId = found ? found.id : loaded[0].id
        setActiveChatId(activeId)
        setActiveTitle(found?.title ?? loaded[0].title)
        saveActiveChatId(activeId, userId)

        // Load messages for the active chat
        const msgs = await loadChatMessages(activeId, userId)
        if (!cancelled) setActiveMessages(msgs)
      }
      setIsLoading(false)
    }
    init()
    return () => { cancelled = true }
  }, [userId])

  // Scroll to bottom when messages or thinking state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages, isThinking])

  // Focus input when switching to chat view
  useEffect(() => {
    if (view === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [activeChatId, view])

  async function selectChat(chat: StoredChat) {
    setActiveChatId(chat.id)
    setActiveTitle(chat.title)
    saveActiveChatId(chat.id, userId)
    setView('chat')
    setChatError(null)
    const msgs = await loadChatMessages(chat.id, userId)
    setActiveMessages(msgs)
  }

  async function handleNewChat() {
    const fresh = await createChat(userId)
    setChats((prev) => [fresh, ...prev])
    setActiveChatId(fresh.id)
    setActiveTitle(fresh.title)
    saveActiveChatId(fresh.id, userId)
    setView('chat')
    setChatError(null)
    setActiveMessages([])
    setInputText('')
  }

  async function handleDeleteChat(chatId: string) {
    await deleteChat(chatId, userId)
    const remaining = await loadChats(userId)
    setChats(remaining)

    if (activeChatId === chatId) {
      if (remaining.length > 0) {
        const next = remaining[0]
        setActiveChatId(next.id)
        setActiveTitle(next.title)
        saveActiveChatId(next.id, userId)
        const msgs = await loadChatMessages(next.id, userId)
        setActiveMessages(msgs)
      } else {
        const fresh = await createChat(userId)
        setChats([fresh])
        setActiveChatId(fresh.id)
        setActiveTitle(fresh.title)
        saveActiveChatId(fresh.id, userId)
        setActiveMessages([])
        setView('chat')
      }
    }
  }

  async function sendMessage() {
    const text = inputText.trim()
    if (!text || isThinking || !activeChatId) return

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
    }

    const updatedMessages = [...activeMessages, userMsg]

    // Optimistically update local state
    setActiveMessages(updatedMessages)
    setInputText('')
    setIsThinking(true)
    setChatError(null)

    // Check if this is the first user message (for title generation)
    const isFirstMessage = activeMessages.filter((m) => m.role === 'user').length === 0

    try {
      const res = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: getContextWindow(updatedMessages).map(({ role, content }) => ({ role, content })),
          userProfile,
          userId,
          userEmail,
          chatId: activeChatId,
        }),
      })

      const data = (await res.json()) as { reply?: string; message?: string }

      if (!res.ok) {
        setChatError(data.message ?? 'Erro ao obter resposta. Tente novamente.')
        return
      }

      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.reply ?? '',
      }

      const finalMessages = [...updatedMessages, aiMsg]
      setActiveMessages(finalMessages)

      // Update chat in the list
      setChats((prev) =>
        prev.map((c) =>
          c.id === activeChatId
            ? { ...c, messages: finalMessages, updatedAt: Date.now() }
            : c
        )
      )

      // Generate title via AI if this was the first user message
      if (isFirstMessage) {
        generateTitle(activeChatId, text, userId).then((title) => {
          setActiveTitle(title)
          setChats((prev) =>
            prev.map((c) =>
              c.id === activeChatId ? { ...c, title } : c
            )
          )
        })
      }
    } catch {
      setChatError('Não foi possível conectar ao servidor. Verifique se a API está rodando.')
    } finally {
      setIsThinking(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const isGuardiao24hActive =
    guardiao24hUntil !== null &&
    guardiao24hUntil !== undefined &&
    guardiao24hUntil > Date.now()

  // ── Render: loading ────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="guardiao-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ThinkingDots />
      </div>
    )
  }

  // ── Render: chat list ──────────────────────────────────────

  if (view === 'list') {
    return (
      <ChatListView
        chats={chats}
        activeChatId={activeChatId}
        onSelect={selectChat}
        onNew={handleNewChat}
        onDelete={handleDeleteChat}
      />
    )
  }

  // ── Render: active chat ────────────────────────────────────

  return (
    <div className="guardiao-wrapper">
      {/* Toolbar */}
      <div className="chat-toolbar">
        <button
          type="button"
          className="chat-toolbar-btn"
          onClick={() => setView('list')}
          aria-label="Ver conversas"
        >
          <i className="bi bi-chat-left-text" />
          <span>Conversas</span>
        </button>
        <span className="chat-toolbar-title">
          {activeTitle !== 'Nova conversa' ? activeTitle : 'MeuGuardião'}
        </span>
        <button
          type="button"
          className="chat-toolbar-btn"
          onClick={handleNewChat}
          aria-label="Nova conversa"
        >
          <i className="bi bi-plus-lg" />
          <span>Novo</span>
        </button>
      </div>

      {/* Welcome / intro */}
      {activeMessages.length === 0 && (
        <div className="guardiao-intro">
          <div className="guardiao-intro-icon">
            <i className="bi bi-chat-heart-fill" />
          </div>
          <h3 className="guardiao-intro-title">Olá! Sou o MeuGuardião</h3>
          <p className="guardiao-intro-sub">
            Seu assistente de saúde e bem-estar. Pergunte sobre alimentação, hábitos saudáveis,
            receitas naturais ou orientações personalizadas.
          </p>
          <div className="guardiao-intro-suggestions" data-tour="guardiao-chips">
            {[
              'Como melhorar meu sono?',
              'Alimentos anti-inflamatórios',
              'Rotina matinal saudável',
              'Como reduzir o estresse?',
            ].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="guardiao-suggestion-chip"
                onClick={() => {
                  setInputText(suggestion)
                  setTimeout(() => inputRef.current?.focus(), 50)
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="guardiao-messages">
        {activeMessages.map((msg) => (
          <div key={msg.id} className={`chat-message ${msg.role === 'user' ? 'user' : 'ai'}`}>
            {msg.role === 'assistant' ? (
              <div className="chat-markdown">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ) : (
              msg.content
            )}
          </div>
        ))}

        {isThinking && <ThinkingDots />}

        {chatError && (
          <div className="chat-error-banner">
            <i className="bi bi-exclamation-triangle-fill" />
            {chatError}
            <button
              type="button"
              className="chat-error-dismiss"
              onClick={() => setChatError(null)}
              aria-label="Fechar erro"
            >
              <i className="bi bi-x" />
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="chat-input-area" data-tour="guardiao-input">
        <input
          ref={inputRef}
          type="text"
          className="chat-input"
          placeholder={isThinking ? 'MeuGuardião está pensando...' : 'Digite sua mensagem...'}
          value={inputText}
          disabled={isThinking}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={2000}
        />
        <button
          type="button"
          className={`chat-send-btn ${isThinking || !inputText.trim() ? 'chat-send-btn-disabled' : ''}`}
          onClick={sendMessage}
          disabled={isThinking || !inputText.trim()}
          aria-label="Enviar"
        >
          {isThinking ? (
            <span className="chat-send-spinner" />
          ) : (
            <i className="bi bi-send-fill" />
          )}
        </button>
      </div>

      {/* Upsell hint for 24h window users */}
      {isGuardiao24hActive && onViewPlans && (
        <div className="guardiao-upsell-hint">
          <i className="bi bi-stars" />
          Gostou? Assine o Nível 2 para acesso permanente ao MeuGuardião.
          <button type="button" className="btn-upsell-inline" onClick={onViewPlans}>
            Ver planos
          </button>
        </div>
      )}
    </div>
  )
}
