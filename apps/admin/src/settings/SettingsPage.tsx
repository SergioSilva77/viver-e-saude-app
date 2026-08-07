import { useState } from 'react'
import { SessionSettings } from './SessionSettings'
import { StripeSettings } from './StripeSettings'
import { AiSettings } from './AiSettings'
import {
  loadSettings,
  saveSettings,
  type AppSettings,
} from './settingsTypes'

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [saved, setSaved] = useState(false)

  function handleSave() {
    saveSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function handleReset() {
    if (!confirm('Tem certeza? Isso apagará todas as configurações salvas.')) return
    localStorage.removeItem('vs_admin_settings')
    setSettings(loadSettings())
  }

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <div>
          <h1 className="settings-page-title">Configurações</h1>
          <p className="settings-page-sub">
            Chaves de API e parâmetros de integração. Salvo localmente no navegador.{' '}
            <span className="settings-page-warning">
              <i className="bi bi-exclamation-triangle-fill" /> Não compartilhe esta tela.
            </span>
          </p>
        </div>
      </div>

      <div className="settings-sections">
        <SessionSettings
          config={settings.session}
          onChange={(session) => setSettings((s) => ({ ...s, session }))}
        />

        <StripeSettings
          config={settings.stripe}
          onChange={(stripe) => setSettings((s) => ({ ...s, stripe }))}
        />

        <AiSettings
          config={settings.ai}
          onChange={(ai) => setSettings((s) => ({ ...s, ai }))}
        />
      </div>

      <div className="settings-footer">
        <button type="button" className="btn-settings-reset" onClick={handleReset}>
          <i className="bi bi-trash3" />
          Limpar tudo
        </button>
        <button type="button" className="btn-settings-save" onClick={handleSave}>
          {saved ? (
            <>
              <i className="bi bi-check-lg" />
              Salvo!
            </>
          ) : (
            <>
              <i className="bi bi-floppy2-fill" />
              Salvar configurações
            </>
          )}
        </button>
      </div>
    </div>
  )
}
