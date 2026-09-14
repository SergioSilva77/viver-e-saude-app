import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/adminApi'

interface WeeklyMeetConfig {
  meetUrl: string
  consultantEmail: string
  consultantName: string
  weekday: number
  time: string
  durationMinutes: number
  emailHour: string
  lastEmailSentOn?: string
  preview?: {
    isOpen: boolean
    nextLabel: string
    dateLabel: string
    timeLabel: string
  }
}

const EMPTY: WeeklyMeetConfig = {
  meetUrl: '',
  consultantEmail: '',
  consultantName: '',
  weekday: 1,
  time: '19:00',
  durationMinutes: 60,
  emailHour: '08:00',
}

export function WeeklyMeetSettingsPage() {
  const [cfg, setCfg] = useState<WeeklyMeetConfig>(EMPTY)
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle')
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    adminFetch('/api/admin/weekly-meet')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: WeeklyMeetConfig | null) => {
        if (data) setCfg({ ...EMPTY, ...data })
      })
      .catch(() => {})
  }, [])

  function set<K extends keyof WeeklyMeetConfig>(field: K, value: WeeklyMeetConfig[K]) {
    setCfg((c) => ({ ...c, [field]: value }))
  }

  async function handleSave() {
    setSyncState('syncing')
    setMessage('')
    try {
      const res = await adminFetch('/api/admin/weekly-meet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetUrl: cfg.meetUrl.trim(),
          consultantEmail: cfg.consultantEmail.trim(),
          consultantName: cfg.consultantName.trim(),
          weekday: cfg.weekday,
          time: cfg.time,
          durationMinutes: cfg.durationMinutes,
          emailHour: cfg.emailHour,
        }),
      })
      const data = await res.json() as WeeklyMeetConfig & { message?: string }
      if (!res.ok) throw new Error(data.message ?? 'Falha ao salvar.')
      setCfg({ ...EMPTY, ...data })
      setSyncState('synced')
      setMessage('Sala semanal salva. O mesmo link será reutilizado todas as segundas.')
    } catch (err) {
      setSyncState('error')
      setMessage(err instanceof Error ? err.message : 'Falha ao salvar.')
    }
    setTimeout(() => setSyncState('idle'), 4000)
  }

  async function handleSend() {
    if (!cfg.meetUrl) {
      setMessage('Salve um link permanente do Meet antes de enviar.')
      return
    }
    setSendState('sending')
    setMessage('')
    try {
      const res = await adminFetch('/api/admin/weekly-meet/send', { method: 'POST' })
      const data = await res.json() as { message?: string; sent?: number }
      if (!res.ok) throw new Error(data.message ?? 'Falha ao enviar.')
      setSendState('sent')
      setMessage(data.message ?? `E-mails enviados: ${data.sent ?? 0}.`)
    } catch (err) {
      setSendState('error')
      setMessage(err instanceof Error ? err.message : 'Falha ao enviar e-mails.')
    }
    setTimeout(() => setSendState('idle'), 6000)
  }

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <div>
          <h1 className="settings-page-title">Bate-papo semanal</h1>
          <p className="settings-page-sub">
            Um único link do Google Meet, reutilizado toda segunda. O consultor informado é o anfitrião e recebe o convite por e-mail.
          </p>
        </div>
      </div>

      <div className="settings-sections">
        <section className="settings-group">
          <div className="settings-group-header">
            <div className="settings-group-icon stripe-icon">
              <i className="bi bi-camera-video-fill" />
            </div>
            <div>
              <h2 className="settings-group-title">Sala permanente</h2>
              <p className="settings-group-desc">
                Crie um evento recorrente no Google Calendar da conta do consultor (toda segunda, com Meet),
                copie o link <code>meet.google.com/xxx-yyyy-zzz</code> e cole aqui. Assim o consultor é o organizador de fato.
                Todas as pessoas entram no mesmo link.
              </p>
            </div>
          </div>

          <div className="settings-fields">
            <div className="settings-field">
              <label className="settings-label">Nome do consultor (anfitrião)</label>
              <input
                type="text"
                className="settings-input"
                placeholder="Ana Consultora"
                value={cfg.consultantName}
                onChange={(e) => set('consultantName', e.target.value)}
              />
            </div>
            <div className="settings-field">
              <label className="settings-label">E-mail do consultor</label>
              <input
                type="email"
                className="settings-input"
                placeholder="consultor@viveresaude.com"
                value={cfg.consultantEmail}
                onChange={(e) => set('consultantEmail', e.target.value)}
              />
            </div>
            <div className="settings-field">
              <label className="settings-label">Link permanente do Google Meet</label>
              <input
                type="url"
                className="settings-input"
                placeholder="https://meet.google.com/abc-defg-hij"
                value={cfg.meetUrl}
                onChange={(e) => set('meetUrl', e.target.value)}
              />
            </div>
            <div className="settings-field">
              <label className="settings-label">Horário (Brasília)</label>
              <input
                type="time"
                className="settings-input"
                value={cfg.time}
                onChange={(e) => set('time', e.target.value)}
              />
            </div>
            <div className="settings-field">
              <label className="settings-label">Enviar e-mail às (no dia da reunião)</label>
              <input
                type="time"
                className="settings-input"
                value={cfg.emailHour}
                onChange={(e) => set('emailHour', e.target.value)}
              />
            </div>
            {cfg.preview && (
              <p className="settings-group-desc">
                Próxima sessão: {cfg.preview.dateLabel} às {cfg.preview.timeLabel}.
                {cfg.lastEmailSentOn ? ` Último e-mail: ${cfg.lastEmailSentOn}.` : ''}
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="settings-footer">
        {message && (
          <span className={`sync-status ${syncState === 'error' || sendState === 'error' ? 'sync-error' : 'synced'}`}>
            {message}
          </span>
        )}
        <button
          type="button"
          className="btn-settings-save"
          onClick={() => void handleSend()}
          disabled={sendState === 'sending'}
        >
          <i className="bi bi-send-fill" />
          {sendState === 'sending' ? ' Enviando…' : ' Enviar e-mail agora'}
        </button>
        <button type="button" className="btn-settings-save" onClick={() => void handleSave()}>
          <i className="bi bi-floppy2-fill" />
          {syncState === 'syncing' ? ' Salvando…' : ' Salvar'}
        </button>
      </div>
    </div>
  )
}
