import type {
  AiConfig,
  AiProvider,
  ClaudeModelId,
  GeminiModelId,
  MiMoModelId,
  MiMoFreeModelId,
} from './settingsTypes'
import {
  CLAUDE_MODELS,
  GEMINI_MODELS,
  MIMO_MODELS,
  MIMO_FREE_MODELS,
  TIER_ICON,
  TIER_LABEL,
} from './settingsTypes'

interface Props {
  config: AiConfig
  onChange: (config: AiConfig) => void
}

export function AiSettings({ config, onChange }: Props) {
  function setProvider(provider: AiProvider) {
    onChange({ ...config, activeProvider: provider })
  }

  function setClaudeKey(apiKey: string) {
    onChange({ ...config, claude: { ...config.claude, apiKey } })
  }

  function setClaudeModel(activeModel: ClaudeModelId) {
    onChange({ ...config, claude: { ...config.claude, activeModel } })
  }

  function setGeminiKey(apiKey: string) {
    onChange({ ...config, gemini: { ...config.gemini, apiKey } })
  }

  function setGeminiModel(activeModel: GeminiModelId) {
    onChange({ ...config, gemini: { ...config.gemini, activeModel } })
  }

  function setMiMoKey(apiKey: string) {
    onChange({ ...config, mimo: { ...config.mimo, apiKey } })
  }

  function setMiMoModel(activeModel: MiMoModelId) {
    onChange({ ...config, mimo: { ...config.mimo, activeModel } })
  }

  function setMiMoFreeKey(apiKey: string) {
    onChange({ ...config, mimoFree: { ...config.mimoFree, apiKey } })
  }

  function setMiMoFreeModel(activeModel: MiMoFreeModelId) {
    onChange({ ...config, mimoFree: { ...config.mimoFree, activeModel } })
  }

  return (
    <section className="settings-group">
      <div className="settings-group-header">
        <div className="settings-group-icon ai-icon">
          <i className="bi bi-robot" />
        </div>
        <div>
          <h2 className="settings-group-title">Inteligência Artificial</h2>
          <p className="settings-group-desc">
            Escolha o provedor ativo e o modelo que os usuários irão utilizar.
          </p>
        </div>
      </div>

      {/* Provider toggle */}
      <div className="settings-fields">
        <div className="settings-field">
          <label className="settings-label">Provedor ativo</label>
          <div className="provider-toggle">
            <ProviderTab
              active={config.activeProvider === 'claude'}
              icon="bi-cpu"
              label="Anthropic Claude"
              onClick={() => setProvider('claude')}
            />
            <ProviderTab
              active={config.activeProvider === 'gemini'}
              icon="bi-google"
              label="Google Gemini"
              onClick={() => setProvider('gemini')}
            />
            <ProviderTab
              active={config.activeProvider === 'mimo'}
              icon="bi-phone"
              label="Xiaomi MiMo Pro"
              onClick={() => setProvider('mimo')}
            />
            <ProviderTab
              active={config.activeProvider === 'mimo-free'}
              icon="bi-gift"
              label="Xiaomi MiMo Free"
              onClick={() => setProvider('mimo-free')}
            />
          </div>
        </div>
      </div>

      {/* Claude section */}
      <div className={`provider-section ${config.activeProvider !== 'claude' ? 'provider-section-inactive' : ''}`}>
        <div className="provider-section-label">
          <i className="bi bi-cpu" />
          Anthropic Claude
          {config.activeProvider === 'claude' && (
            <span className="provider-active-badge">ativo</span>
          )}
        </div>

        <div className="settings-fields">
          <div className="settings-field">
            <label className="settings-label">Chave de API</label>
            <input
              type="password"
              className="settings-input"
              placeholder="sk-ant-…"
              value={config.claude.apiKey}
              autoComplete="off"
              onChange={(e) => setClaudeKey(e.target.value)}
            />
          </div>

          <div className="settings-field">
            <label className="settings-label">Modelo para os usuários</label>
            <div className="model-grid">
              {CLAUDE_MODELS.map((model) => (
                <ModelCard
                  key={model.id}
                  label={model.label}
                  description={model.description}
                  tier={model.tier}
                  selected={config.claude.activeModel === model.id}
                  onClick={() => setClaudeModel(model.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Gemini section */}
      <div className={`provider-section ${config.activeProvider !== 'gemini' ? 'provider-section-inactive' : ''}`}>
        <div className="provider-section-label">
          <i className="bi bi-google" />
          Google Gemini
          {config.activeProvider === 'gemini' && (
            <span className="provider-active-badge">ativo</span>
          )}
        </div>

        <div className="settings-fields">
          <div className="settings-field">
            <label className="settings-label">Chave de API</label>
            <input
              type="password"
              className="settings-input"
              placeholder="AIza…"
              value={config.gemini.apiKey}
              autoComplete="off"
              onChange={(e) => setGeminiKey(e.target.value)}
            />
          </div>

          <div className="settings-field">
            <label className="settings-label">Modelo para os usuários</label>
            <div className="model-grid">
              {GEMINI_MODELS.map((model) => (
                <ModelCard
                  key={model.id}
                  label={model.label}
                  description={model.description}
                  tier={model.tier}
                  selected={config.gemini.activeModel === model.id}
                  onClick={() => setGeminiModel(model.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MiMo section */}
      <div className={`provider-section ${config.activeProvider !== 'mimo' ? 'provider-section-inactive' : ''}`}>
        <div className="provider-section-label">
          <i className="bi bi-phone" />
          Xiaomi MiMo Pro (Pago)
          {config.activeProvider === 'mimo' && (
            <span className="provider-active-badge">ativo</span>
          )}
        </div>

        <div className="settings-fields">
          <div className="settings-field">
            <label className="settings-label">Chave de API (OpenRouter)</label>
            <input
              type="password"
              className="settings-input"
              placeholder="sk-or-v1-…"
              value={config.mimo.apiKey}
              autoComplete="off"
              onChange={(e) => setMiMoKey(e.target.value)}
            />
          </div>

          <div className="settings-field">
            <label className="settings-label">Modelo para os usuários</label>
            <div className="model-grid">
              {MIMO_MODELS.map((model) => (
                <ModelCard
                  key={model.id}
                  label={model.label}
                  description={model.description}
                  tier={model.tier}
                  selected={config.mimo.activeModel === model.id}
                  onClick={() => setMiMoModel(model.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MiMo Free section */}
      <div className={`provider-section ${config.activeProvider !== 'mimo-free' ? 'provider-section-inactive' : ''}`}>
        <div className="provider-section-label">
          <i className="bi bi-gift" />
          Xiaomi MiMo Free (Gratuito)
          {config.activeProvider === 'mimo-free' && (
            <span className="provider-active-badge">ativo</span>
          )}
        </div>

        <div className="settings-fields">
          <div className="settings-field">
            <label className="settings-label">Chave de API (OpenRouter — mesmo que o Pro)</label>
            <input
              type="password"
              className="settings-input"
              placeholder="sk-or-v1-…"
              value={config.mimoFree.apiKey}
              autoComplete="off"
              onChange={(e) => setMiMoFreeKey(e.target.value)}
            />
          </div>

          <div className="settings-field">
            <label className="settings-label">Modelo para os usuários</label>
            <div className="model-grid">
              {MIMO_FREE_MODELS.map((model) => (
                <ModelCard
                  key={model.id}
                  label={model.label}
                  description={model.description}
                  tier={model.tier}
                  selected={config.mimoFree.activeModel === model.id}
                  onClick={() => setMiMoFreeModel(model.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Memory settings */}
      <div className="provider-section">
        <div className="provider-section-label">
          <i className="bi bi-brain" />
          Memória do MeuGuardião
        </div>

        <div className="settings-fields">
          <div className="settings-field">
            <label className="settings-label">Lembrar contexto da pessoa</label>
            <p className="settings-hint">
              Quando ativado, a IA vai conhecendo a pessoa ao longo das conversas — nome, idade, peso,
              objetivos, condições de saúde. Ela pergunta naturalmente, sem interrogatório,
              e usa esse contexto para orientar melhor nas próximas conversas.
            </p>
            <button
              type="button"
              className={`toggle-btn ${config.rememberPersonSummary ? 'toggle-btn-on' : ''}`}
              onClick={() => onChange({ ...config, rememberPersonSummary: !config.rememberPersonSummary })}
            >
              <span className="toggle-slider" />
              <span className="toggle-label">{config.rememberPersonSummary ? 'Ativado' : 'Desativado'}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Internal sub-components ────────────────────────────────

interface ProviderTabProps {
  active: boolean
  icon: string
  label: string
  onClick: () => void
}

function ProviderTab({ active, icon, label, onClick }: ProviderTabProps) {
  return (
    <button
      type="button"
      className={`provider-tab ${active ? 'provider-tab-active' : ''}`}
      onClick={onClick}
    >
      <i className={`bi ${icon}`} />
      {label}
    </button>
  )
}

interface ModelCardProps {
  label: string
  description: string
  tier: string
  selected: boolean
  onClick: () => void
}

function ModelCard({ label, description, tier, selected, onClick }: ModelCardProps) {
  return (
    <button
      type="button"
      className={`model-card ${selected ? 'model-card-selected' : ''}`}
      onClick={onClick}
    >
      <div className="model-card-header">
        <span className="model-card-name">{label}</span>
        <span className={`model-tier model-tier-${tier}`}>
          <i className={`bi ${TIER_ICON[tier]}`} />
          {TIER_LABEL[tier]}
        </span>
      </div>
      <p className="model-card-desc">{description}</p>
      {selected && (
        <div className="model-card-check">
          <i className="bi bi-check-circle-fill" />
          Selecionado
        </div>
      )}
    </button>
  )
}
