import {
  SESSION_DURATION_OPTIONS,
  type SessionConfig,
  type SessionDurationDays,
} from './settingsTypes'

interface Props {
  config: SessionConfig
  onChange: (config: SessionConfig) => void
}

export function SessionSettings({ config, onChange }: Props) {
  function setDuration(durationDays: SessionDurationDays) {
    onChange({ ...config, durationDays })
  }

  return (
    <section className="settings-group">
      <div className="settings-group-header">
        <div className="settings-group-icon session-icon">
          <i className="bi bi-shield-lock-fill" />
        </div>
        <div>
          <h2 className="settings-group-title">Sessão e Segurança</h2>
          <p className="settings-group-desc">
            Define por quanto tempo os usuários permanecem logados antes de precisar autenticar novamente.
          </p>
        </div>
      </div>

      <div className="settings-fields">
        <div className="settings-field">
          <label className="settings-label">Duração da sessão</label>
          <div className="session-duration-grid">
            {SESSION_DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`session-duration-btn ${config.durationDays === opt.value ? 'session-duration-btn-active' : ''}`}
                onClick={() => setDuration(opt.value)}
              >
                {opt.label}
                {config.durationDays === opt.value && (
                  <i className="bi bi-check-circle-fill session-duration-check" />
                )}
              </button>
            ))}
          </div>
          <p className="settings-hint">
            <i className="bi bi-info-circle" />
            Usuários serão redirecionados para o login após este período de inatividade.
            Sessões ativas não são interrompidas — a expiração ocorre na próxima abertura do app.
          </p>
        </div>
      </div>
    </section>
  )
}
