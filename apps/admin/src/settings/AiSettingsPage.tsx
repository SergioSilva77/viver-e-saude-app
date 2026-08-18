import { useEffect, useState } from 'react'
import { AiSettings } from './AiSettings'
import { SessionSettings } from './SessionSettings'
import { KnowledgeUpload } from './KnowledgeUpload'
import { adminFetch } from '../lib/adminApi'
import { getAdminToken } from '../auth/adminSession'
import { loadSettings, saveSettings, type AppSettings, type AiProvider } from './settingsTypes'

const API_URL = ''

type SyncState = 'idle' | 'syncing' | 'synced' | 'error'

async function syncAiSettingsToBackend(settings: AppSettings): Promise<void> {
  const { activeProvider, claude, gemini, mimo, mimoFree, rememberPersonSummary } = settings.ai
  const activeConfig =
    activeProvider === 'claude' ? claude :
    activeProvider === 'gemini' ? gemini :
    activeProvider === 'mimo' ? mimo :
    mimoFree
  const res = await adminFetch(`${API_URL}/api/admin/ai-settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: activeProvider,
      apiKey: activeConfig.apiKey,
      model: activeConfig.activeModel,
      rememberPersonSummary,
    }),
  })
  if (!res.ok) throw new Error('Falha ao salvar no servidor.')
}

export function AiSettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle')
  const [syncState, setSyncState] = useState<SyncState>('idle')

  // Carrega a config atual do servidor (apiKey mascarada) ao abrir a página
  useEffect(() => {
    adminFetch('/api/admin/ai-settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((serverCfg: { provider?: AiProvider; apiKey?: string; model?: string; rememberPersonSummary?: boolean } | null) => {
        if (!serverCfg?.provider) return
        setSettings((s) => {
          const ai = structuredClone(s.ai)
          ai.activeProvider = serverCfg.provider!
          ai.rememberPersonSummary = serverCfg.rememberPersonSummary ?? false
          const cfg =
            ai.activeProvider === 'claude' ? ai.claude :
            ai.activeProvider === 'gemini' ? ai.gemini :
            ai.activeProvider === 'mimo' ? ai.mimo :
            ai.mimoFree
          if (serverCfg.apiKey) cfg.apiKey = serverCfg.apiKey
          if (serverCfg.model) cfg.activeModel = serverCfg.model as typeof cfg.activeModel
          return { ...s, ai }
        })
      })
      .catch(() => {})
  }, [])

  async function handleSave() {
    // 1. Persist locally (secrets são removidos antes de gravar — ver settingsTypes)
    saveSettings(settings)
    setSaveState('saved')
    setTimeout(() => setSaveState('idle'), 2500)

    // 2. Sync to backend (sempre — o servidor mantém a chave atual se vier mascarada)
    const { activeProvider, claude, gemini, mimo, mimoFree } = settings.ai
    const apiKey =
      activeProvider === 'claude' ? claude.apiKey :
      activeProvider === 'gemini' ? gemini.apiKey :
      activeProvider === 'mimo' ? mimo.apiKey :
      mimoFree.apiKey
    if (!apiKey) return

    setSyncState('syncing')
    try {
      await syncAiSettingsToBackend(settings)
      setSyncState('synced')
      setTimeout(() => setSyncState('idle'), 3000)
    } catch {
      setSyncState('error')
      setTimeout(() => setSyncState('idle'), 4000)
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <div>
          <h1 className="settings-page-title">Inteligência Artificial</h1>
          <p className="settings-page-sub">
            Provedor, modelo e sessão dos usuários.{' '}
            <span className="settings-page-warning">
              <i className="bi bi-exclamation-triangle-fill" /> Não compartilhe esta tela.
            </span>
          </p>
        </div>
      </div>

      <div className="settings-sections">
        <AiSettings
          config={settings.ai}
          onChange={(ai) => setSettings((s) => ({ ...s, ai }))}
        />
        <SessionSettings
          config={settings.session}
          onChange={(session) => setSettings((s) => ({ ...s, session }))}
        />
        <KnowledgeUpload apiUrl={API_URL} adminToken={getAdminToken() ?? ''} />
      </div>

      <div className="settings-footer">
        {/* Backend sync status */}
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

        <button type="button" className="btn-settings-save" onClick={handleSave}>
          {saveState === 'saved' ? (
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
