import { useEffect, useState } from 'react'
import { SmtpSettings } from './SmtpSettings'
import { adminFetch } from '../lib/adminApi'
import { loadSettings, saveSettings, type AppSettings } from './settingsTypes'

type SyncState = 'idle' | 'syncing' | 'synced' | 'error'
type TestState = 'idle' | 'sending' | 'sent' | 'error'

async function fetchSmtpFromBackend(): Promise<Partial<AppSettings['smtp']> | null> {
  try {
    const res = await adminFetch('/api/admin/smtp-settings')
    if (!res.ok) return null
    return (await res.json()) as Partial<AppSettings['smtp']>
  } catch {
    return null
  }
}

async function syncSmtpToBackend(settings: AppSettings): Promise<void> {
  const { smtp } = settings
  const res = await adminFetch('/api/admin/smtp-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host:   smtp.host,
      port:   smtp.port,
      secure: smtp.secure,
      user:   smtp.user,
      pass:   smtp.pass,
      from:   smtp.from,
    }),
  })
  if (!res.ok) throw new Error('Falha ao salvar no servidor.')
}

export function SmtpSettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [testState, setTestState] = useState<TestState>('idle')
  const [testEmail, setTestEmail] = useState('')
  const [testMsg, setTestMsg] = useState('')

  // Carrega a config atual do servidor ao abrir a página
  useEffect(() => {
    fetchSmtpFromBackend().then((serverCfg) => {
      if (serverCfg && serverCfg.host) {
        setSettings((s) => ({
          ...s,
          smtp: { ...s.smtp, ...serverCfg },
        }))
      }
    })
  }, [])

  async function handleSave() {
    saveSettings(settings)
    if (!settings.smtp.host) return
    setSyncState('syncing')
    try {
      await syncSmtpToBackend(settings)
      setSyncState('synced')
      setTimeout(() => setSyncState('idle'), 3000)
    } catch {
      setSyncState('error')
      setTimeout(() => setSyncState('idle'), 4000)
    }
  }

  async function handleTest() {
    if (!testEmail) {
      setTestMsg('Informe um e-mail para teste.')
      return
    }
    setTestState('sending')
    setTestMsg('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      })
      if (!res.ok) throw new Error()
      setTestState('sent')
      setTestMsg('Solicitação enviada. Se o e-mail existir, a mensagem chegará em instantes.')
    } catch {
      setTestState('error')
      setTestMsg('Falha ao enviar teste — verifique se a API está rodando.')
    }
    setTimeout(() => setTestState('idle'), 6000)
  }

  function handleReset() {
    if (!confirm('Tem certeza? Isso apagará as configurações de e-mail salvas localmente.')) return
    const resetted: AppSettings = {
      ...settings,
      smtp: { host: '', port: 587, secure: false, user: '', pass: '', from: '' },
    }
    saveSettings(resetted)
    setSettings(resetted)
  }

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <div>
          <h1 className="settings-page-title">E-mail (SMTP)</h1>
          <p className="settings-page-sub">
            Configuração do servidor de envio — ativação de conta e redefinição de senha.{' '}
            <span className="settings-page-warning">
              <i className="bi bi-exclamation-triangle-fill" /> Não compartilhe esta tela.
            </span>
          </p>
        </div>
      </div>

      <div className="settings-sections">
        <SmtpSettings
          config={settings.smtp}
          onChange={(smtp) => setSettings((s) => ({ ...s, smtp }))}
        />

        <section className="settings-group">
          <div className="settings-group-header">
            <div className="settings-group-icon stripe-icon">
              <i className="bi bi-send-check-fill" />
            </div>
            <div>
              <h2 className="settings-group-title">Testar envio</h2>
              <p className="settings-group-desc">
                Envia um e-mail de redefinição de senha para validar a configuração.
              </p>
            </div>
          </div>
          <div className="settings-fields">
            <div className="settings-field">
              <label className="settings-label">E-mail de destino</label>
              <input
                type="email"
                className="settings-input"
                placeholder="seu@email.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>
            <div className="settings-field">
              <button
                type="button"
                className="btn-settings-save"
                onClick={handleTest}
                disabled={testState === 'sending'}
              >
                <i className="bi bi-send-fill" />
                {testState === 'sending' ? ' Enviando…' : ' Enviar teste'}
              </button>
              {testMsg && (
                <p className={`sync-status ${testState === 'error' ? 'sync-error' : 'synced'}`} style={{ marginTop: 8 }}>
                  <i className={`bi ${testState === 'error' ? 'bi-exclamation-circle-fill' : 'bi-check-circle-fill'}`} />
                  {' '}{testMsg}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="settings-footer">
        {syncState === 'syncing' && (
          <span className="sync-status syncing">
            <span className="sync-spinner" />
            Sincronizando com o servidor...
          </span>
        )}
        {syncState === 'synced' && (
          <span className="sync-status synced">
            <i className="bi bi-check-circle-fill" />
            Sincronizado com o servidor
          </span>
        )}
        {syncState === 'error' && (
          <span className="sync-status sync-error">
            <i className="bi bi-exclamation-circle-fill" />
            Falha ao sincronizar — API rodando?
          </span>
        )}

        <button type="button" className="btn-settings-reset" onClick={handleReset}>
          <i className="bi bi-trash3" />
          Limpar configurações
        </button>
        <button type="button" className="btn-settings-save" onClick={handleSave}>
          <i className="bi bi-floppy2-fill" />
          Salvar configurações
        </button>
      </div>
    </div>
  )
}
