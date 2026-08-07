import { useEffect, useReducer, useState } from 'react'

// ── Types ──────────────────────────────────────────────────

interface Recipe {
  id: string
  title: string
  description: string
  content: string
  audience: string[]
  createdAt: string
  updatedAt: string
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

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

const emptyForm = {
  id: '',
  title: '',
  description: '',
  content: '',
  audience: [] as string[],
}

// Simple markdown preview (bold, italic, headings, lists, line breaks)
function renderMarkdownPreview(md: string): string {
  return md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])/gm, '')
    .replace(/^(.+)$/gm, (line) =>
      /^<(h[1-3]|ul|li|\/ul)/.test(line) ? line : `<p>${line}</p>`,
    )
    .replace(/<p><\/p>/g, '')
    .replace(/\n/g, ' ')
}

// ── Component ──────────────────────────────────────────────

type View = 'list' | 'editor'

export function RecipesPage({ adminToken }: Props) {
  const [view, setView] = useState<View>('list')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useReducer(
    (s: typeof emptyForm, p: Partial<typeof emptyForm>) => ({ ...s, ...p }),
    emptyForm,
  )
  const [previewMode, setPreviewMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  function headers() {
    return { 'Content-Type': 'application/json', 'x-admin-token': adminToken }
  }

  async function fetchRecipes() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/recipes', { headers: headers() })
      const data = await res.json()
      setRecipes(data.recipes ?? [])
    } catch {
      setError('Não foi possível carregar as receitas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRecipes() }, [])

  function openCreate() {
    setForm({ ...emptyForm, id: generateId() })
    setEditingId(null)
    setSaveError(null)
    setPreviewMode(false)
    setView('editor')
  }

  function openEdit(recipe: Recipe) {
    setForm({
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      content: recipe.content,
      audience: recipe.audience,
    })
    setEditingId(recipe.id)
    setSaveError(null)
    setPreviewMode(false)
    setView('editor')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/admin/recipes', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message ?? 'Erro ao salvar.')
      }
      await fetchRecipes()
      setView('list')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro desconhecido.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Remover esta receita?')) return
    try {
      await fetch(`/api/admin/recipes/${id}`, { method: 'DELETE', headers: headers() })
      await fetchRecipes()
    } catch {
      alert('Erro ao remover a receita.')
    }
  }

  function toggleAudience(planId: string) {
    const next = form.audience.includes(planId)
      ? form.audience.filter((a) => a !== planId)
      : [...form.audience, planId]
    setForm({ audience: next })
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // ── Editor view ────────────────────────────────────────────
  if (view === 'editor') {
    return (
      <div className="recipes-editor-page">
        <div className="recipes-editor-topbar">
          <button type="button" className="recipes-back-btn" onClick={() => setView('list')}>
            <i className="bi bi-arrow-left" /> Voltar
          </button>
          <h2 className="page-title">{editingId ? 'Editar receita' : 'Nova receita'}</h2>
        </div>

        <form onSubmit={handleSave} className="recipes-editor-form">
          {/* Metadata row */}
          <div className="recipes-meta-row">
            <label className="comm-label" style={{ flex: 2 }}>
              Título
              <input
                className="comm-input"
                required
                maxLength={200}
                value={form.title}
                onChange={(e) => setForm({ title: e.target.value })}
                placeholder="ex: Suco verde detox"
              />
            </label>
            <label className="comm-label" style={{ flex: 3 }}>
              Descrição curta
              <input
                className="comm-input"
                maxLength={400}
                value={form.description}
                onChange={(e) => setForm({ description: e.target.value })}
                placeholder="Subtítulo exibido na lista do app"
              />
            </label>
          </div>

          {/* Audience */}
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
                {form.audience.length === 0
                  ? 'Todos os assinantes'
                  : `${form.audience.length} nível(is) selecionado(s)`}
              </span>
            </div>
          </div>

          {/* Markdown editor / preview */}
          <div className="recipes-editor-section">
            <div className="recipes-editor-tabs">
              <button
                type="button"
                className={`recipes-tab ${!previewMode ? 'recipes-tab-active' : ''}`}
                onClick={() => setPreviewMode(false)}
              >
                <i className="bi bi-code-slash" /> Editor
              </button>
              <button
                type="button"
                className={`recipes-tab ${previewMode ? 'recipes-tab-active' : ''}`}
                onClick={() => setPreviewMode(true)}
              >
                <i className="bi bi-eye" /> Pré-visualização
              </button>
            </div>

            {!previewMode ? (
              <textarea
                className="recipes-md-editor"
                required
                value={form.content}
                onChange={(e) => setForm({ content: e.target.value })}
                placeholder={`# Título da receita\n\n## Ingredientes\n\n- Item 1\n- Item 2\n\n## Modo de preparo\n\n1. Passo um\n2. Passo dois`}
                spellCheck={false}
              />
            ) : (
              <div
                className="recipes-md-preview"
                dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(form.content) }}
              />
            )}
            <p className="recipes-md-hint">
              Suporta Markdown: **negrito**, *itálico*, # títulos, - listas
            </p>
          </div>

          {saveError && <p className="comm-error">{saveError}</p>}

          <div className="comm-form-actions">
            <button type="button" className="btn-outline" onClick={() => setView('list')}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar receita'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  // ── List view ──────────────────────────────────────────────
  return (
    <div className="community-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Receitas</h2>
          <p className="page-sub">Gerencie protocolos e receitas disponíveis por nível de plano.</p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          <i className="bi bi-plus-lg" /> Nova receita
        </button>
      </div>

      {loading && <p className="comm-loading">Carregando…</p>}
      {error && <p className="comm-error">{error}</p>}

      {!loading && !error && recipes.length === 0 && (
        <div className="placeholder-section">
          <div className="placeholder-icon"><i className="bi bi-journal-medical" /></div>
          <h2>Nenhuma receita cadastrada</h2>
          <p>Clique em <strong>Nova receita</strong> para adicionar protocolos e receitas.</p>
        </div>
      )}

      {!loading && recipes.length > 0 && (
        <div className="recipes-list">
          {recipes.map((recipe) => (
            <div key={recipe.id} className="recipes-card">
              <div className="recipes-card-icon">
                <i className="bi bi-journal-medical" />
              </div>
              <div className="comm-card-body">
                <div className="comm-card-title">{recipe.title}</div>
                {recipe.description && (
                  <div className="comm-audience-label">{recipe.description}</div>
                )}
                <div className="comm-card-meta" style={{ marginTop: '0.25rem' }}>
                  <span className="comm-platform-badge">
                    {recipe.audience.length === 0
                      ? 'Todos os planos'
                      : recipe.audience.map((a) => PLANS.find((p) => p.id === a)?.label ?? a).join(', ')}
                  </span>
                  <span className="comm-audience-label">
                    Atualizado em {formatDate(recipe.updatedAt)}
                  </span>
                </div>
              </div>
              <div className="comm-card-actions">
                <button type="button" className="comm-btn-edit" onClick={() => openEdit(recipe)} title="Editar">
                  <i className="bi bi-pencil" />
                </button>
                <button type="button" className="comm-btn-delete" onClick={() => handleDelete(recipe.id)} title="Remover">
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
