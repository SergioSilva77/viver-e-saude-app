import { useEffect, useState } from 'react'
import { StripeSettings } from './StripeSettings'
import { adminFetch } from '../lib/adminApi'
import { loadSettings, saveSettings, type AppSettings } from './settingsTypes'

type SyncState = 'idle' | 'syncing' | 'synced' | 'error'

async function fetchStripeFromBackend(): Promise<Partial<AppSettings['stripe']> | null> {
  try {
    const res = await adminFetch('/api/admin/stripe-settings')
    if (!res.ok) return null
    return (await res.json()) as Partial<AppSettings['stripe']>
  } catch {
    return null
  }
}

async function syncStripeSettingsToBackend(settings: AppSettings): Promise<void> {
  const { stripe } = settings
  const res = await adminFetch('/api/admin/stripe-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secretKey:     stripe.secretKey,
      webhookSecret: stripe.webhookSecret,
      priceIdNivel1: stripe.priceIdNivel1,
      priceIdNivel2: stripe.priceIdNivel2,
      priceIdNivel3: stripe.priceIdNivel3,
    }),
  })
  if (!res.ok) throw new Error('Falha ao salvar no servidor.')
}

export function StripeSettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [syncState, setSyncState] = useState<SyncState>('idle')

  // Carrega a config atual do servidor (com secrets mascarados) ao abrir a página
  useEffect(() => {
    fetchStripeFromBackend().then((serverCfg) => {
      if (serverCfg) {
        setSettings((s) => ({
          ...s,
          stripe: { ...s.stripe, ...serverCfg },
        }))
      }
    })
  }, [])

  async function handleSave() {
    saveSettings(settings)

    if (!settings.stripe.secretKey) return

    setSyncState('syncing')
    try {
      await syncStripeSettingsToBackend(settings)
      setSyncState('synced')
      setTimeout(() => setSyncState('idle'), 3000)
    } catch {
      setSyncState('error')
      setTimeout(() => setSyncState('idle'), 4000)
    }
  }

  function handleReset() {
    if (!confirm('Tem certeza? Isso apagará todas as configurações do Stripe.')) return
    const resetted: AppSettings = {
      ...settings,
      stripe: {
        secretKey:     '',
        webhookSecret: '',
        priceIdNivel1: '',
        priceIdNivel2: '',
        priceIdNivel3: '',
      },
    }
    saveSettings(resetted)
    setSettings(resetted)
  }

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <div>
          <h1 className="settings-page-title">Stripe — Pagamentos</h1>
          <p className="settings-page-sub">
            Chaves de API e Price IDs para integração com Stripe.{' '}
            <span className="settings-page-warning">
              <i className="bi bi-exclamation-triangle-fill" /> Não compartilhe esta tela.
            </span>
          </p>
        </div>
      </div>

      <div className="settings-sections">
        <StripeSettings
          config={settings.stripe}
          onChange={(stripe) => setSettings((s) => ({ ...s, stripe }))}
        />
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
          Limpar chaves
        </button>
        <button type="button" className="btn-settings-save" onClick={handleSave}>
          <i className="bi bi-floppy2-fill" />
          Salvar configurações
        </button>
      </div>
    </div>
  )
}
