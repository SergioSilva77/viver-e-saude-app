import { useState } from 'react'
import { plans, getEffectivePlanId } from '@viver-saude/shared'
import { ALL_RESOURCES, type AdminUser } from './types'
import type { PlanId } from '@viver-saude/shared'

const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN ?? 'vs-admin-dev'

async function syncUserToApi(user: {
  id: string
  fullName: string
  email: string
  planIds: PlanId[]
  password: string
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
      body: JSON.stringify(user),
    })
    const data = await res.json()
    if (!res.ok) {
      let msg = data.message || 'Erro ao criar usuário.'
      if (msg.includes('email')) msg = 'Email inválido.'
      return { ok: false, error: msg }
    }
    return { ok: true }
  } catch (_) {
    return { ok: false, error: 'API indisponível — verifique se o servidor está rodando.' }
  }
}

interface Props {
  onClose: () => void
  onSave: (user: AdminUser) => void
}

export function CreateUserModal({ onClose, onSave }: Props) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [planIds, setPlanIds] = useState<PlanId[]>([])
  const [expiresAt, setExpiresAt] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function togglePlan(planId: PlanId) {
    setPlanIds((prev) =>
      prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId]
    )
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!fullName.trim()) e.fullName = 'Nome obrigatório'
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) e.email = 'Email inválido'
    if (!password || password.length < 8) e.password = 'Senha obrigatória (mínimo 8 caracteres)'
    return e
  }

  async function handleSave() {
    const e = validate()
    if (Object.keys(e).length > 0) {
      setErrors(e)
      return
    }

    const effectivePlan = getEffectivePlanId(planIds)

    const newUser: AdminUser = {
      id: String(Date.now()),
      fullName: fullName.trim(),
      email: email.trim(),
      planIds,
      status: planIds.length === 0 ? 'sem_plano' : Boolean(planIds.length) ? 'acesso_manual' : (effectivePlan ?? 'sem_plano') as AdminUser['status'],
      createdAt: new Date().toISOString().slice(0, 10),
      lastAccessAt: null,
      expiresAt: expiresAt || null,
      grantedByAdmin: planIds.length > 0,
      resources: ALL_RESOURCES.map((r) => ({ ...r, override: 'herdado' as const })),
      payments: [],
    }

    const result = await syncUserToApi({
      id: newUser.id,
      fullName: newUser.fullName,
      email: newUser.email,
      planIds: newUser.planIds,
      password,
    })

    if (!result.ok) {
      setErrors({ api: result.error || 'Falha ao criar usuário.' })
      return
    }

    onSave(newUser)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Criar usuário</h3>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Fechar">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="modal-body">
          <label className="field-label">
            Nome completo *
            <input
              type="text"
              className={`field-input ${errors.fullName ? 'field-error' : ''}`}
              placeholder="Ex: Marina Costa"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            {errors.fullName && <span className="error-msg">{errors.fullName}</span>}
          </label>

          <label className="field-label">
            Email *
            <input
              type="text"
              className={`field-input ${errors.email ? 'field-error' : ''}`}
              placeholder="marina@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {errors.email && <span className="error-msg">{errors.email}</span>}
          </label>

          <label className="field-label">
            Senha *
            <input
              type="password"
              className={`field-input ${errors.password ? 'field-error' : ''}`}
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errors.password && <span className="error-msg">{errors.password}</span>}
          </label>

          <div className="field-label">
            Planos iniciais
            <div className="plan-checkboxes" style={{ marginTop: '0.5rem' }}>
              {plans.map((p) => (
                <label
                  key={p.id}
                  className={`plan-checkbox-row ${planIds.includes(p.id) ? 'plan-checkbox-row-active' : ''}`}
                >
                  <input
                    type="checkbox"
                    className="plan-checkbox-input"
                    checked={planIds.includes(p.id)}
                    onChange={() => togglePlan(p.id)}
                  />
                  <div className="plan-checkbox-info">
                    <span className="plan-checkbox-label">{p.id.replace('nivel', 'Nível ')}</span>
                    <span className="plan-checkbox-desc">{p.label}</span>
                  </div>
                  {planIds.includes(p.id) && (
                    <i className="bi bi-check-circle-fill plan-checkbox-check"></i>
                  )}
                </label>
              ))}
            </div>
          </div>

          {planIds.length > 0 && (
            <label className="field-label">
              Acesso expira em (opcional)
              <input
                type="date"
                className="field-input"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <span className="field-hint">Deixe em branco para acesso sem expiração.</span>
            </label>
          )}
        </div>

        <div className="modal-footer">
          {errors.api && (
            <span className="error-msg" style={{ marginRight: 'auto', fontSize: '0.85rem' }}>
              <i className="bi bi-exclamation-triangle-fill"></i> {errors.api}
            </span>
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={handleSave}>
            <i className="bi bi-person-check-fill"></i>
            Criar usuário
          </button>
        </div>
      </div>
    </div>
  )
}
