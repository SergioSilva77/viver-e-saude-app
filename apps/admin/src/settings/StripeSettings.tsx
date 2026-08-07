import { useState } from 'react'
import { StripeGuideModal } from './StripeGuideModal'
import type { StripeConfig } from './settingsTypes'

interface Props {
  config: StripeConfig
  onChange: (config: StripeConfig) => void
}

export function StripeSettings({ config, onChange }: Props) {
  const [showGuide, setShowGuide] = useState(false)

  function set(field: keyof StripeConfig, value: string) {
    onChange({ ...config, [field]: value })
  }

  return (
    <>
      {showGuide && <StripeGuideModal onClose={() => setShowGuide(false)} />}

    <section className="settings-group">
      <div className="settings-group-header">
        <div className="settings-group-icon stripe-icon">
          <i className="bi bi-credit-card-2-front-fill" />
        </div>
        <div>
          <h2 className="settings-group-title">Stripe — Pagamentos</h2>
          <p className="settings-group-desc">
            Chaves da API e IDs de preço para cada nível de assinatura.
          </p>
        </div>
        <button
          type="button"
          className="btn-stripe-guide"
          onClick={() => setShowGuide(true)}
        >
          <i className="bi bi-question-circle" />
          Como configurar?
        </button>
      </div>

      <div className="settings-fields">
        <SecretField
          label="Chave secreta"
          hint="sk_live_… ou sk_test_…"
          value={config.secretKey}
          onChange={(v) => set('secretKey', v)}
        />
        <SecretField
          label="Webhook secret"
          hint="whsec_…"
          value={config.webhookSecret}
          onChange={(v) => set('webhookSecret', v)}
        />

        <div className="settings-divider">IDs de preço (Price IDs)</div>

        <TextField
          label="Nível 1"
          hint="price_…"
          value={config.priceIdNivel1}
          onChange={(v) => set('priceIdNivel1', v)}
        />
        <TextField
          label="Nível 2"
          hint="price_…"
          value={config.priceIdNivel2}
          onChange={(v) => set('priceIdNivel2', v)}
        />
        <TextField
          label="Nível 3"
          hint="price_…"
          value={config.priceIdNivel3}
          onChange={(v) => set('priceIdNivel3', v)}
        />
      </div>
    </section>
    </>
  )
}

// ── Internal field components ──────────────────────────────

interface FieldProps {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
}

function SecretField({ label, hint, value, onChange }: FieldProps) {
  return (
    <div className="settings-field">
      <label className="settings-label">{label}</label>
      <input
        type="password"
        className="settings-input"
        placeholder={hint}
        value={value}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function TextField({ label, hint, value, onChange }: FieldProps) {
  return (
    <div className="settings-field">
      <label className="settings-label">{label}</label>
      <input
        type="text"
        className="settings-input"
        placeholder={hint}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
