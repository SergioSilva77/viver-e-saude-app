import type { SmtpConfig } from './settingsTypes'

interface Props {
  config: SmtpConfig
  onChange: (config: SmtpConfig) => void
}

export function SmtpSettings({ config, onChange }: Props) {
  function set(field: keyof SmtpConfig, value: string | number | boolean) {
    onChange({ ...config, [field]: value })
  }

  return (
    <section className="settings-group">
      <div className="settings-group-header">
        <div className="settings-group-icon stripe-icon">
          <i className="bi bi-envelope-fill" />
        </div>
        <div>
          <h2 className="settings-group-title">E-mail (SMTP)</h2>
          <p className="settings-group-desc">
            Servidor de envio de e-mails — ativação de conta e redefinição de senha.
          </p>
        </div>
      </div>

      <div className="settings-fields">
        <div className="settings-field">
          <label className="settings-label">Host SMTP</label>
          <input
            type="text"
            className="settings-input"
            placeholder="smtp.hostinger.com"
            value={config.host}
            onChange={(e) => set('host', e.target.value)}
          />
        </div>

        <div className="settings-field">
          <label className="settings-label">Porta</label>
          <input
            type="number"
            className="settings-input"
            placeholder="465 (SSL) ou 587 (TLS)"
            value={config.port}
            onChange={(e) => set('port', Number(e.target.value))}
          />
        </div>

        <div className="settings-field">
          <label className="settings-label">Conexão segura (SSL)</label>
          <select
            className="settings-input"
            value={config.secure ? 'true' : 'false'}
            onChange={(e) => set('secure', e.target.value === 'true')}
          >
            <option value="true">Sim — porta 465 (SSL)</option>
            <option value="false">Não — porta 587 (STARTTLS)</option>
          </select>
        </div>

        <div className="settings-divider">Credenciais</div>

        <div className="settings-field">
          <label className="settings-label">Usuário (e-mail da conta)</label>
          <input
            type="text"
            className="settings-input"
            placeholder="conta@seudominio.com"
            value={config.user}
            autoComplete="off"
            onChange={(e) => set('user', e.target.value)}
          />
        </div>

        <div className="settings-field">
          <label className="settings-label">Senha</label>
          <input
            type="password"
            className="settings-input"
            placeholder="••••••••"
            value={config.pass}
            autoComplete="new-password"
            onChange={(e) => set('pass', e.target.value)}
          />
        </div>

        <div className="settings-field">
          <label className="settings-label">Remetente (From)</label>
          <input
            type="text"
            className="settings-input"
            placeholder="contato@seudominio.com — vazio usa o usuário"
            value={config.from}
            onChange={(e) => set('from', e.target.value)}
          />
        </div>
      </div>
    </section>
  )
}
