import { useEffect, useRef, useState } from 'react'

// ── Types ──────────────────────────────────────────────────

interface KnowledgeFile {
  filename: string
  sizeBytes: number
  uploadedAt: string
  title: string
  description: string
  topics: string[]
}

interface MetaForm {
  title: string
  description: string
  topicsRaw: string // comma-separated string for editing
}

interface Props {
  apiUrl: string
  adminToken: string
}

// ── Helpers ────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function topicsFromRaw(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
}

function toMetaForm(file: KnowledgeFile): MetaForm {
  return {
    title: file.title,
    description: file.description,
    topicsRaw: file.topics.join(', '),
  }
}

// ── Component ──────────────────────────────────────────────

export function KnowledgeUpload({ apiUrl, adminToken }: Props) {
  const [files, setFiles] = useState<KnowledgeFile[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  /** filename → MetaForm currently being edited (null = not editing) */
  const [editingMeta, setEditingMeta] = useState<Record<string, MetaForm>>({})
  const [savingMeta, setSavingMeta] = useState<Record<string, boolean>>({})

  const fileInputRef = useRef<HTMLInputElement>(null)

  const headers = { 'x-admin-token': adminToken }

  // ── Data fetching ──────────────────────────────────────────

  async function fetchFiles() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/admin/knowledge`, { headers })
      if (!res.ok) throw new Error('Falha ao carregar arquivos.')
      const data = (await res.json()) as { files: KnowledgeFile[] }
      setFiles(data.files)
    } catch {
      setError('Não foi possível carregar os arquivos. A API está rodando?')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [])

  // ── Upload ─────────────────────────────────────────────────

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    if (selected.length === 0) return

    const invalid = selected.filter((f) => !f.name.endsWith('.txt'))
    if (invalid.length > 0) {
      setError(`Somente arquivos .txt são aceitos. Ignorados: ${invalid.map((f) => f.name).join(', ')}`)
      return
    }

    setUploading(true)
    setError(null)
    setSuccessMsg(null)

    const formData = new FormData()
    selected.forEach((f) => formData.append('files', f))

    try {
      const res = await fetch(`${apiUrl}/api/admin/knowledge`, {
        method: 'POST',
        headers,
        body: formData,
      })
      const data = (await res.json()) as {
        ok?: boolean
        uploaded?: { filename: string }[]
        message?: string
      }
      if (!res.ok) throw new Error(data.message ?? 'Falha no upload.')

      const uploadedNames = data.uploaded?.map((u) => u.filename) ?? []
      setSuccessMsg(`${uploadedNames.length} arquivo(s) enviado(s). Adicione título e tópicos abaixo.`)

      await fetchFiles()

      // Open meta editor for each newly uploaded file
      setEditingMeta((prev) => {
        const next = { ...prev }
        for (const name of uploadedNames) {
          if (!next[name]) {
            next[name] = { title: '', description: '', topicsRaw: '' }
          }
        }
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no upload.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── Meta editing ───────────────────────────────────────────

  function openMetaEditor(file: KnowledgeFile) {
    setEditingMeta((prev) => ({
      ...prev,
      [file.filename]: toMetaForm(file),
    }))
  }

  function closeMetaEditor(filename: string) {
    setEditingMeta((prev) => {
      const next = { ...prev }
      delete next[filename]
      return next
    })
  }

  function updateMetaField(filename: string, field: keyof MetaForm, value: string) {
    setEditingMeta((prev) => ({
      ...prev,
      [filename]: { ...prev[filename], [field]: value },
    }))
  }

  async function saveMeta(filename: string) {
    const form = editingMeta[filename]
    if (!form) return

    setSavingMeta((prev) => ({ ...prev, [filename]: true }))
    setError(null)

    try {
      const res = await fetch(
        `${apiUrl}/api/admin/knowledge/${encodeURIComponent(filename)}/meta`,
        {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: form.title.trim(),
            description: form.description.trim(),
            topics: topicsFromRaw(form.topicsRaw),
          }),
        },
      )
      const data = (await res.json()) as { ok?: boolean; message?: string }
      if (!res.ok) throw new Error(data.message ?? 'Falha ao salvar.')

      // Update local file list to reflect new meta
      setFiles((prev) =>
        prev.map((f) =>
          f.filename === filename
            ? {
                ...f,
                title: form.title.trim(),
                description: form.description.trim(),
                topics: topicsFromRaw(form.topicsRaw),
              }
            : f,
        ),
      )

      closeMetaEditor(filename)
      setSuccessMsg(`Metadados de "${filename}" salvos.`)
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar metadados.')
    } finally {
      setSavingMeta((prev) => ({ ...prev, [filename]: false }))
    }
  }

  // ── Delete ─────────────────────────────────────────────────

  async function handleDelete(filename: string) {
    if (!confirm(`Remover "${filename}" da base de conhecimento?`)) return
    setError(null)
    try {
      const res = await fetch(
        `${apiUrl}/api/admin/knowledge/${encodeURIComponent(filename)}`,
        { method: 'DELETE', headers },
      )
      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        throw new Error(data.message ?? 'Falha ao remover.')
      }
      setFiles((prev) => prev.filter((f) => f.filename !== filename))
      closeMetaEditor(filename)
      setSuccessMsg(`"${filename}" removido.`)
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover arquivo.')
    }
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <section className="settings-group">
      <div className="settings-group-header">
        <h3 className="settings-group-title">Base de conhecimento da IA</h3>
        <p className="settings-group-desc">
          Envie arquivos <code>.txt</code> com conteúdo temático. Defina título e tópicos para que a
          IA carregue apenas o arquivo mais relevante a cada pergunta do usuário.
        </p>
      </div>

      {/* Upload area */}
      <label className={`knowledge-upload-area ${uploading ? 'knowledge-upload-area-loading' : ''}`}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          multiple
          style={{ display: 'none' }}
          onChange={handleUpload}
          disabled={uploading}
        />
        {uploading ? (
          <>
            <span className="knowledge-upload-spinner" />
            Enviando…
          </>
        ) : (
          <>
            <i className="bi bi-cloud-upload" />
            Clique para enviar arquivos <code>.txt</code>
            <small>Máximo 512 KB por arquivo</small>
          </>
        )}
      </label>

      {/* Feedback */}
      {error && (
        <div className="settings-feedback settings-feedback-error">
          <i className="bi bi-exclamation-triangle-fill" />
          {error}
        </div>
      )}
      {successMsg && (
        <div className="settings-feedback settings-feedback-success">
          <i className="bi bi-check-circle-fill" />
          {successMsg}
        </div>
      )}

      {/* File list */}
      {loading ? (
        <p className="knowledge-loading">Carregando arquivos…</p>
      ) : files.length === 0 ? (
        <p className="knowledge-empty">Nenhum arquivo na base de conhecimento.</p>
      ) : (
        <ul className="knowledge-file-list">
          {files.map((file) => {
            const isEditing = Boolean(editingMeta[file.filename])
            const form = editingMeta[file.filename]
            const isSaving = savingMeta[file.filename] ?? false

            return (
              <li key={file.filename} className="knowledge-file-item">
                {/* File header row */}
                <div className="knowledge-file-header">
                  <div className="knowledge-file-info">
                    <i className="bi bi-file-text" />
                    <div>
                      <span className="knowledge-file-name">{file.filename}</span>
                      <span className="knowledge-file-meta">
                        {formatBytes(file.sizeBytes)} · {formatDate(file.uploadedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="knowledge-file-actions">
                    <button
                      type="button"
                      className="btn-knowledge-edit"
                      onClick={() => (isEditing ? closeMetaEditor(file.filename) : openMetaEditor(file))}
                      title={isEditing ? 'Fechar editor' : 'Editar tópicos'}
                    >
                      <i className={`bi ${isEditing ? 'bi-chevron-up' : 'bi-pencil'}`} />
                    </button>
                    <button
                      type="button"
                      className="btn-knowledge-delete"
                      onClick={() => handleDelete(file.filename)}
                      title="Remover arquivo"
                    >
                      <i className="bi bi-trash3" />
                    </button>
                  </div>
                </div>

                {/* Topic chips (collapsed view) */}
                {!isEditing && (
                  <div className="knowledge-topics-preview">
                    {file.topics.length > 0 ? (
                      file.topics.map((t) => (
                        <span key={t} className="knowledge-topic-chip">{t}</span>
                      ))
                    ) : (
                      <span className="knowledge-topics-missing">
                        <i className="bi bi-exclamation-circle" />
                        Sem tópicos definidos — a IA carregará este arquivo em todas as respostas
                      </span>
                    )}
                  </div>
                )}

                {/* Meta editor (expanded) */}
                {isEditing && form && (
                  <div className="knowledge-meta-editor">
                    <div className="knowledge-meta-field">
                      <label className="knowledge-meta-label">Título</label>
                      <input
                        type="text"
                        className="knowledge-meta-input"
                        placeholder="Ex: Dieta e alimentação"
                        value={form.title}
                        maxLength={100}
                        onChange={(e) => updateMetaField(file.filename, 'title', e.target.value)}
                      />
                    </div>
                    <div className="knowledge-meta-field">
                      <label className="knowledge-meta-label">Descrição resumida</label>
                      <input
                        type="text"
                        className="knowledge-meta-input"
                        placeholder="Ex: Conteúdo sobre alimentação saudável, dietas e nutrição"
                        value={form.description}
                        maxLength={300}
                        onChange={(e) => updateMetaField(file.filename, 'description', e.target.value)}
                      />
                    </div>
                    <div className="knowledge-meta-field">
                      <label className="knowledge-meta-label">
                        Tópicos / palavras-chave
                        <span className="knowledge-meta-hint">(separados por vírgula)</span>
                      </label>
                      <input
                        type="text"
                        className="knowledge-meta-input"
                        placeholder="Ex: dieta, nutrição, proteína, carboidrato, vitamina"
                        value={form.topicsRaw}
                        onChange={(e) => updateMetaField(file.filename, 'topicsRaw', e.target.value)}
                      />
                      {form.topicsRaw && (
                        <div className="knowledge-topics-preview" style={{ marginTop: '0.4rem' }}>
                          {topicsFromRaw(form.topicsRaw).map((t) => (
                            <span key={t} className="knowledge-topic-chip">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="knowledge-meta-actions">
                      <button
                        type="button"
                        className="btn-knowledge-cancel"
                        onClick={() => closeMetaEditor(file.filename)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="btn-knowledge-save"
                        onClick={() => saveMeta(file.filename)}
                        disabled={isSaving || !form.title.trim()}
                      >
                        {isSaving ? 'Salvando…' : 'Salvar tópicos'}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
