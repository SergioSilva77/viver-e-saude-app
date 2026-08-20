import { useEffect, useRef, useState } from 'react'
import { useNotificationCenter } from './useNotificationCenter'
import type { AppNotification } from './notificationCenter'

const typeIcons: Record<string, string> = {
  new_message: 'bi-chat-dots',
  incoming_call: 'bi-telephone',
  appointment_confirmed: 'bi-calendar-check',
  appointment_reminder: 'bi-alarm',
  appointment_declined: 'bi-calendar-x',
  appointment_cancelled: 'bi-calendar-x',
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin} min`
  if (diffMin < 24 * 60) return `${Math.floor(diffMin / 60)} h`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/** Sininho da topbar (já existia visualmente) + painel dropdown de notificações. */
export function NotificationBell() {
  const center = useNotificationCenter()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    center.load()
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="topbar-bell"
        aria-label="Notificações"
        onClick={() => setOpen((v) => !v)}
        style={{ position: 'relative' }}
      >
        <i className="bi bi-bell"></i>
        {center.unreadCount > 0 && (
          <span
            style={{
              position: 'absolute', top: 2, right: 2, width: 10, height: 10,
              borderRadius: '50%', background: '#e04444', border: '2px solid #fff',
            }}
          />
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 48, right: 0, width: 340, maxHeight: 420,
            background: '#fff', borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            overflow: 'hidden', zIndex: 200, display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #ece6d8' }}>
            <strong style={{ fontSize: 15 }}>Notificações</strong>
            <button
              type="button"
              onClick={() => center.markAllRead()}
              style={{ background: 'none', border: 'none', color: '#2e7d5e', fontSize: 12, cursor: 'pointer' }}
            >
              Marcar tudo como lido
            </button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {center.notifications.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#8fad9c', fontSize: 13 }}>
                Nenhuma notificação ainda.
              </div>
            ) : (
              center.notifications.map((n: AppNotification) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => center.markRead(n.id)}
                  style={{
                    display: 'flex', gap: 10, width: '100%', textAlign: 'left', padding: '10px 16px',
                    border: 'none', borderBottom: '1px solid #f4f9f6', cursor: 'pointer',
                    background: n.readAt ? 'transparent' : 'rgba(46,125,94,0.06)',
                  }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(46,125,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`bi ${typeIcons[n.type] ?? 'bi-bell'}`} style={{ color: '#2e7d5e', fontSize: 14 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#213830' }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: '#5c7268', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {n.body}
                    </div>
                    <div style={{ fontSize: 11, color: '#8fad9c', marginTop: 2 }}>{formatTime(n.createdAt)}</div>
                  </div>
                  {!n.readAt && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2e7d5e', flexShrink: 0, marginTop: 4 }} />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
