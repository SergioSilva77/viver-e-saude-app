import { useEffect, useReducer, useState } from 'react'

// ── Helpers ────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ── Types ──────────────────────────────────────────────────

type Platform = 'whatsapp' | 'telegram' | 'youtube' | 'discord' | 'other'

interface CommunityLink {
  id: string
  title: string
  platform: Platform
  audience: string[]
  href: string
  createdAt: string
}

interface Props {
  adminToken: string
}

// ── Constants ──────────────────────────────────────────────

const PLANS = [
  { id: 'nivel1', label: 'Nível 1' },
  { id: 'nivel2', label: 'Nível 2' },
  { id: 'nivel3', label: 'Nível 3' },
]

const PLATFORM_ICONS: Record<Platform, string> = {
  whatsapp: 'bi-whatsapp',
  telegram: 'bi-telegram',
  youtube: 'bi-youtube',
  discord: 'bi-discord',
  other: 'bi-link-45deg',
}

const PLATFORM_COLORS: Record<Platform, string> = {
  whatsapp: '#25D366',
  telegram: '#229ED9',
  youtube: '#FF0000',
  discord: '#5865F2',
  other: '#6c757d',
}

const PLATFORM_LABELS: Record<Platform, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  youtube: 'YouTube',
  discord: 'Discord',
  other: 'Outro',
}

const emptyForm = {
  id: '',
  title: '',
  platform: 'whatsapp' as Platform,
  audience: [] as string[],
  href: '',
}

// ── Component ──────────────────────────────────────────────

export function CommunityPage({ adminToken }: Props) {
  const [links, setLinks] = useState<CommunityLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useReducer(
    (s: typeof emptyForm, p: Partial<typeof emptyForm>) => ({ ...s, ...p }),
    emptyForm,
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  function headers() {
    return { 'Content-Type': 'application/json', 'x-admin-token': adminToken }
  }

  async function fetchLinks() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/community-links', { headers: headers() })
      const data = await res.json()
      setLinks(data.links ?? [])
    } catch {
      setError('Não foi possível carregar os links.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLinks() }, [])

  function openCreate() {
    setForm({ ...emptyForm, id: generateId() })
    setEditingId(null)
    setSaveError(null)
    setShowForm(true)
  }

  function openEdit(link: CommunityLink) {
    setForm({ id: link.id, title: link.title, platform: link.platform, audience: link.audience, href: link.href })
    setEditingId(link.id)
    setSaveError(null)
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/admin/community-links', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message ?? 'Erro ao salvar.')
      }
      setShowForm(false)
      await fetchLinks()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro desconhecido.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Remover este link da comunidade?')) return
    try {
      await fetch(`/api/admin/community-links/${id}`, { method: 'DELETE', headers: headers() })
      await fetchLinks()
    } catch {
      alert('Erro ao remover o link.')
    }
  }

  function toggleAudience(planId: string) {
    const current = form.audience.includes(planId)
      ? form.audience.filter((a) => a !== planId)
      : [...form.audience, planId]
    setForm({ audience: current })
  }

  return (
    <div className="community-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Comunidade</h2>
          <p className="page-sub">Gerencie os grupos e canais disponíveis por nível de plano.</p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          <i className="bi bi-plus-lg" /> Novo link
        </button>
      </div>

      {/* Form / Modal */}
      {showForm && (
        <div className="comm-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="comm-modal">
            <div className="comm-modal-header">
              <h3>{editingId ? 'Editar link' : 'Novo link de comunidade'}</h3>
              <button type="button" className="comm-modal-close" onClick={() => setShowForm(false)}>
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <form onSubmit={handleSave} className="comm-form">
              <label className="comm-label">
                Título
                <input
                  className="comm-input"
                  required
                  maxLength={120}
                  value={form.title}
                  onChange={(e) => setForm({ title: e.target.value })}
                  placeholder="ex: Grupo VIP WhatsApp Nível 1"
                />
              </label>

              <label className="comm-label">
                Plataforma
                <select
                  className="comm-input"
                  value={form.platform}
                  onChange={(e) => setForm({ platform: e.target.value as Platform })}
                >
                  {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => (
                    <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                  ))}
                </select>
              </label>

              <label className="comm-label">
                URL
                <input
                  className="comm-input"
                  required
                  type="url"
                  value={form.href}
                  onChange={(e) => setForm({ href: e.target.value })}
                  placeholder="https://chat.whatsapp.com/..."
                />
              </label>

              <div className="comm-label">
                Público (planos com acesso)
                <div className="comm-audience-chips">
                  {PLANS.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      className={`comm-chip ${form.audience.includes(plan.id) ? 'comm-chip-active' : ''}`}
                      onClick={() => toggleAudience(plan.id)}
                    >
                      {plan.label}
                    </button>
                  ))}
                  <span className="comm-chip-hint">
                    {form.audience.length === 0 ? 'Todos os assinantes' : `${form.audience.length} nível(is) selecionado(s)`}
                  </span>
                </div>
              </div>

              {saveError && <p className="comm-error">{saveError}</p>}

              <div className="comm-form-actions">
                <button type="button" className="btn-outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      {loading && <p className="comm-loading">Carregando…</p>}
      {error && <p className="comm-error">{error}</p>}

      {!loading && !error && links.length === 0 && (
        <div className="placeholder-section">
          <div className="placeholder-icon"><i className="bi bi-people-fill" /></div>
          <h2>Nenhum link cadastrado</h2>
          <p>Clique em <strong>Novo link</strong> para adicionar grupos e canais.</p>
        </div>
      )}

      {!loading && links.length > 0 && (
        <div className="comm-list">
          {links.map((link) => (
            <div key={link.id} className="comm-card">
              <div className="comm-card-icon" style={{ background: PLATFORM_COLORS[link.platform] }}>
                <i className={`bi ${PLATFORM_ICONS[link.platform]}`} />
              </div>
              <div className="comm-card-body">
                <div className="comm-card-title">{link.title}</div>
                <div className="comm-card-meta">
                  <span className="comm-platform-badge">{PLATFORM_LABELS[link.platform]}</span>
                  <span className="comm-audience-label">
                    {link.audience.length === 0
                      ? 'Todos os planos'
                      : link.audience.map((a) => PLANS.find((p) => p.id === a)?.label ?? a).join(', ')}
                  </span>
                </div>
                <a className="comm-href" href={link.href} target="_blank" rel="noreferrer">
                  {link.href.length > 60 ? link.href.slice(0, 60) + '…' : link.href}
                </a>
              </div>
              <div className="comm-card-actions">
                <button type="button" className="comm-btn-edit" onClick={() => openEdit(link)} title="Editar">
                  <i className="bi bi-pencil" />
                </button>
                <button type="button" className="comm-btn-delete" onClick={() => handleDelete(link.id)} title="Remover">
                  <i className="bi bi-trash3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
