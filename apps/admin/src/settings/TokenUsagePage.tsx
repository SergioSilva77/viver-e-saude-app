import { useEffect, useState } from 'react'

// ── Types ──────────────────────────────────────────────────

interface ModelStats {
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  requestCount: number
  lastUsedAt: string
}

interface UserTokenStats {
  userId: string
  userEmail: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  requestCount: number
  lastUsedAt: string
  byModel: ModelStats[]
}

interface TokenRecord {
  userId: string
  userEmail: string
  date: string
  inputTokens: number
  outputTokens: number
  provider: string
  model: string
}

interface TokenUsageStats {
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  quota: number | null
  remainingTokens: number | null
  requestCount: number
  byUser: UserTokenStats[]
  byModel: ModelStats[]
  recentRecords: TokenRecord[]
}

interface Props {
  apiUrl: string
  adminToken: string
}

// ── Helpers ────────────────────────────────────────────────

function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR')
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function percentUsed(used: number, quota: number): number {
  return Math.min(100, Math.round((used / quota) * 100))
}

function providerLabel(provider: string): string {
  if (provider === 'claude') return 'Claude'
  if (provider === 'gemini') return 'Gemini'
  return provider
}

function providerIcon(provider: string): string {
  if (provider === 'claude') return 'bi-cpu'
  if (provider === 'gemini') return 'bi-stars'
  return 'bi-robot'
}

function providerClass(provider: string): string {
  if (provider === 'claude') return 'provider-claude'
  if (provider === 'gemini') return 'provider-gemini'
  return ''
}

// ── Sub-components ─────────────────────────────────────────

function ModelBadge({ provider, model }: { provider: string; model: string }) {
  return (
    <span className={`model-badge ${providerClass(provider)}`}>
      <i className={`bi ${providerIcon(provider)}`} />
      {providerLabel(provider)} · {model}
    </span>
  )
}

function ModelStatsRow({ m, indent }: { m: ModelStats; indent?: boolean }) {
  return (
    <tr className={`token-model-row ${indent ? 'token-model-row-indent' : ''}`}>
      <td>
        <ModelBadge provider={m.provider} model={m.model} />
      </td>
      <td className="token-col-num">{formatNumber(m.inputTokens)}</td>
      <td className="token-col-num">{formatNumber(m.outputTokens)}</td>
      <td className="token-col-num token-total">{formatNumber(m.totalTokens)}</td>
      <td className="token-col-num">{m.requestCount}</td>
      <td className="token-col-date">{formatDateShort(m.lastUsedAt)}</td>
    </tr>
  )
}

// ── Component ──────────────────────────────────────────────

export function TokenUsagePage({ apiUrl, adminToken }: Props) {
  const [stats, setStats] = useState<TokenUsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())

  const [quotaInput, setQuotaInput] = useState('')
  const [savingQuota, setSavingQuota] = useState(false)
  const [quotaMsg, setQuotaMsg] = useState<string | null>(null)

  const headers = { 'x-admin-token': adminToken, 'Content-Type': 'application/json' }

  async function fetchStats() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/admin/token-usage`, {
        headers: { 'x-admin-token': adminToken },
      })
      if (!res.ok) throw new Error('Falha ao carregar dados.')
      const data = (await res.json()) as TokenUsageStats
      setStats(data)
      setQuotaInput(data.quota !== null ? String(data.quota) : '')
    } catch {
      setError('Não foi possível carregar as estatísticas. A API está rodando?')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStats() }, [])

  async function handleSaveQuota() {
    setSavingQuota(true)
    setQuotaMsg(null)
    try {
      const quota = quotaInput.trim() === '' ? null : parseInt(quotaInput, 10)
      if (quota !== null && isNaN(quota)) throw new Error('Valor inválido.')

      const res = await fetch(`${apiUrl}/api/admin/token-quota`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ quota }),
      })
      const data = (await res.json()) as { ok?: boolean; message?: string }
      if (!res.ok) throw new Error(data.message ?? 'Falha ao salvar.')
      setQuotaMsg('Quota salva com sucesso.')
      await fetchStats()
      setTimeout(() => setQuotaMsg(null), 3000)
    } catch (err) {
      setQuotaMsg(err instanceof Error ? err.message : 'Erro ao salvar quota.')
    } finally {
      setSavingQuota(false)
    }
  }

  function toggleUser(userId: string) {
    setExpandedUsers((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  // ── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page-container">
        <div className="token-loading">
          <span className="token-spinner" />
          Carregando estatísticas…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="settings-feedback settings-feedback-error">
          <i className="bi bi-exclamation-triangle-fill" />
          {error}
          <button type="button" onClick={fetchStats} className="btn-token-retry">
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  const used = stats?.totalTokens ?? 0
  const quota = stats?.quota ?? null
  const pct = quota !== null ? percentUsed(used, quota) : null

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">Consumo de Tokens IA</h2>
        <button type="button" className="btn-icon-refresh" onClick={fetchStats} title="Atualizar">
          <i className="bi bi-arrow-clockwise" />
        </button>
      </div>

      {/* ── Overview cards ──────────────────────────────── */}
      <div className="token-overview">
        <div className="token-card">
          <div className="token-card-label">Total consumido</div>
          <div className="token-card-value">{formatNumber(used)}</div>
          <div className="token-card-sub">tokens</div>
        </div>
        <div className="token-card">
          <div className="token-card-label">Entrada (input)</div>
          <div className="token-card-value">{formatNumber(stats?.totalInputTokens ?? 0)}</div>
          <div className="token-card-sub">tokens</div>
        </div>
        <div className="token-card">
          <div className="token-card-label">Saída (output)</div>
          <div className="token-card-value">{formatNumber(stats?.totalOutputTokens ?? 0)}</div>
          <div className="token-card-sub">tokens</div>
        </div>
        <div className="token-card">
          <div className="token-card-label">Requisições</div>
          <div className="token-card-value">{formatNumber(stats?.requestCount ?? 0)}</div>
          <div className="token-card-sub">mensagens</div>
        </div>
      </div>

      {/* ── Quota bar ───────────────────────────────────── */}
      {quota !== null && pct !== null && (
        <div className="token-quota-section">
          <div className="token-quota-header">
            <span>Quota total configurada: <strong>{formatNumber(quota)}</strong> tokens</span>
            <span className={`token-quota-pct ${pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : ''}`}>
              {pct}% usado
            </span>
          </div>
          <div className="token-quota-bar-track">
            <div
              className={`token-quota-bar-fill ${pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="token-quota-remaining">
            {stats?.remainingTokens !== null
              ? `${formatNumber(stats!.remainingTokens!)} tokens restantes`
              : '—'}
          </div>
        </div>
      )}

      {/* ── Global model breakdown ───────────────────────── */}
      {(stats?.byModel.length ?? 0) > 0 && (
        <div className="settings-group">
          <div className="settings-group-header">
            <h3 className="settings-group-title">Por IA e modelo</h3>
          </div>
          <div className="token-table-wrapper">
            <table className="token-table">
              <thead>
                <tr>
                  <th>IA / Modelo</th>
                  <th className="token-col-num">Entrada</th>
                  <th className="token-col-num">Saída</th>
                  <th className="token-col-num">Total</th>
                  <th className="token-col-num">Msgs</th>
                  <th className="token-col-date">Último uso</th>
                </tr>
              </thead>
              <tbody>
                {stats?.byModel.map((m) => (
                  <ModelStatsRow key={`${m.provider}::${m.model}`} m={m} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Per-user table ──────────────────────────────── */}
      <div className="settings-group">
        <div className="settings-group-header">
          <h3 className="settings-group-title">Por usuário</h3>
          <p className="settings-group-desc">Clique em um usuário para ver o detalhamento por IA e modelo.</p>
        </div>

        {stats?.byUser.length === 0 ? (
          <p className="token-empty">Nenhum dado de consumo registrado ainda.</p>
        ) : (
          <div className="token-table-wrapper">
            <table className="token-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th className="token-col-num">Entrada</th>
                  <th className="token-col-num">Saída</th>
                  <th className="token-col-num">Total</th>
                  <th className="token-col-num">Msgs</th>
                  <th className="token-col-date">Último uso</th>
                </tr>
              </thead>
              <tbody>
                {stats?.byUser.map((u) => {
                  const expanded = expandedUsers.has(u.userId)
                  return (
                    <>
                      {/* User row */}
                      <tr
                        key={u.userId}
                        className="token-user-row"
                        onClick={() => toggleUser(u.userId)}
                      >
                        <td>
                          <div className="token-user-cell">
                            <div className="token-user-expand">
                              <i className={`bi ${expanded ? 'bi-chevron-down' : 'bi-chevron-right'} token-expand-icon`} />
                              <div>
                                <span className="token-user-email">{u.userEmail}</span>
                                {u.userId !== 'anonymous' && (
                                  <span className="token-user-id">{u.userId.slice(0, 8)}…</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="token-col-num">{formatNumber(u.inputTokens)}</td>
                        <td className="token-col-num">{formatNumber(u.outputTokens)}</td>
                        <td className="token-col-num token-total">{formatNumber(u.totalTokens)}</td>
                        <td className="token-col-num">{u.requestCount}</td>
                        <td className="token-col-date">{formatDateShort(u.lastUsedAt)}</td>
                      </tr>

                      {/* Per-user model breakdown (expandable) */}
                      {expanded && u.byModel.map((m) => (
                        <ModelStatsRow
                          key={`${u.userId}::${m.provider}::${m.model}`}
                          m={m}
                          indent
                        />
                      ))}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Activity log ────────────────────────────────── */}
      {(stats?.recentRecords.length ?? 0) > 0 && (
        <div className="settings-group">
          <div className="settings-group-header">
            <h3 className="settings-group-title">Últimas atividades</h3>
            <p className="settings-group-desc">As {stats?.recentRecords.length} mensagens mais recentes.</p>
          </div>
          <div className="token-table-wrapper">
            <table className="token-table">
              <thead>
                <tr>
                  <th>Data / Hora</th>
                  <th>Usuário</th>
                  <th>IA / Modelo</th>
                  <th className="token-col-num">Entrada</th>
                  <th className="token-col-num">Saída</th>
                  <th className="token-col-num">Total</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recentRecords.map((r, i) => (
                  <tr key={i}>
                    <td className="token-col-date">{formatDateTime(r.date)}</td>
                    <td>
                      <div className="token-user-cell">
                        <span className="token-user-email">{r.userEmail}</span>
                      </div>
                    </td>
                    <td>
                      <ModelBadge provider={r.provider} model={r.model} />
                    </td>
                    <td className="token-col-num">{formatNumber(r.inputTokens)}</td>
                    <td className="token-col-num">{formatNumber(r.outputTokens)}</td>
                    <td className="token-col-num token-total">{formatNumber(r.inputTokens + r.outputTokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Quota config ────────────────────────────────── */}
      <div className="settings-group">
        <div className="settings-group-header">
          <h3 className="settings-group-title">Configurar quota</h3>
          <p className="settings-group-desc">
            Defina o total de tokens permitido. Deixe em branco para ilimitado.
            Apenas informativo — não bloqueia automaticamente o uso.
          </p>
        </div>
        <div className="token-quota-form">
          <input
            type="number"
            className="settings-input"
            placeholder="Ex: 1000000 (deixe vazio para ilimitado)"
            value={quotaInput}
            min={1}
            onChange={(e) => setQuotaInput(e.target.value)}
          />
          <button
            type="button"
            className="btn-save"
            onClick={handleSaveQuota}
            disabled={savingQuota}
          >
            {savingQuota ? 'Salvando…' : 'Salvar quota'}
          </button>
        </div>
        {quotaMsg && (
          <p className={`token-quota-msg ${quotaMsg.includes('sucesso') ? 'token-quota-msg-ok' : 'token-quota-msg-err'}`}>
            {quotaMsg}
          </p>
        )}
      </div>
    </div>
  )
}
