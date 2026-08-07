import { useState } from 'react'
import { plans, getEffectivePlanId } from '@viver-saude/shared'
import type { AdminUser, ResourceOverride, ResourceToggle, UserStatus } from './types'
import type { PlanId } from '@viver-saude/shared'

const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN ?? 'vs-admin-dev'

interface Props {
  user: AdminUser
  onClose: () => void
  onUpdate: (user: AdminUser) => void
}

const overrideLabel: Record<ResourceOverride, string> = {
  herdado: 'Pelo plano',
  liberado: 'Liberado',
  bloqueado: 'Bloqueado',
}

const overrideIcon: Record<ResourceOverride, string> = {
  herdado: 'bi-circle-half',
  liberado: 'bi-check-circle-fill',
  bloqueado: 'bi-x-circle-fill',
}

const overrideClass: Record<ResourceOverride, string> = {
  herdado: 'toggle-inherited',
  liberado: 'toggle-granted',
  bloqueado: 'toggle-blocked',
}

function cycleOverride(current: ResourceOverride): ResourceOverride {
  if (current === 'herdado') return 'liberado'
  if (current === 'liberado') return 'bloqueado'
  return 'herdado'
}

function deriveStatus(planIds: PlanId[], grantedByAdmin: boolean): UserStatus {
  if (planIds.length === 0) return 'sem_plano'
  if (grantedByAdmin) return 'acesso_manual'
  const highest = getEffectivePlanId(planIds)
  if (highest === 'nivel3') return 'nivel3'
  if (highest === 'nivel2') return 'nivel2'
  return 'nivel1'
}

export function UserDrawer({ user, onClose, onUpdate }: Props) {
  const [grantPlans, setGrantPlans] = useState<PlanId[]>(user.planIds)
  const [expiresAt, setExpiresAt] = useState(user.expiresAt ?? '')
  const [reason, setReason] = useState('')
  const [resources, setResources] = useState<ResourceToggle[]>(user.resources)

  function togglePlan(planId: PlanId) {
    setGrantPlans((prev) =>
      prev.includes(planId)
        ? prev.filter((id) => id !== planId)
        : [...prev, planId]
    )
  }

  function toggleResource(id: string) {
    setResources((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, override: cycleOverride(r.override) } : r
      )
    )
  }

  async function applyGrant() {
    const updated: AdminUser = {
      ...user,
      planIds: grantPlans,
      status: deriveStatus(grantPlans, true),
      expiresAt: expiresAt || null,
      grantedByAdmin: true,
      resources,
    }
    onUpdate(updated)

    // Sync planIds to API store so the web app picks them up on next login
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
        body: JSON.stringify({ id: user.id, email: user.email, planIds: grantPlans }),
      })
      if (!res.ok) {
        const data = await res.json()
        console.error('Erro ao sincronizar plano:', data.message)
      }
    } catch (err) {
      console.error('API indisponível:', err)
    }
  }

  function applyResourceChanges() {
    onUpdate({ ...user, resources })
  }

  const effectivePlanId = getEffectivePlanId(user.planIds)
  const planLabel = effectivePlanId
    ? plans.find((p) => p.id === effectivePlanId)?.label ?? 'Sem plano'
    : 'Sem plano'

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className="drawer-header">
          <div className="drawer-user-info">
            <div className="drawer-avatar">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="drawer-name">{user.fullName}</h3>
              <p className="drawer-email">{user.email}</p>
            </div>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Fechar">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="drawer-body">
          {/* Dados básicos */}
          <div className="drawer-section">
            <div className="drawer-section-title">Dados do cadastro</div>
            <div className="info-grid">
              <div className="info-item">
                <span>Plano atual</span>
                <strong>
                  {user.planIds.length === 0
                    ? 'Sem plano'
                    : user.planIds.map((id) => id.replace('nivel', 'Nível ')).join(' + ')}
                </strong>
              </div>
              <div className="info-item">
                <span>Plano efetivo</span>
                <strong>{planLabel}</strong>
              </div>
              <div className="info-item">
                <span>Cadastrado em</span>
                <strong>{user.createdAt}</strong>
              </div>
              <div className="info-item">
                <span>Último acesso</span>
                <strong>{user.lastAccessAt ?? '—'}</strong>
              </div>
              <div className="info-item">
                <span>Acesso expira</span>
                <strong>{user.expiresAt ?? 'Não definido'}</strong>
              </div>
              {user.grantedByAdmin && (
                <div className="info-item full">
                  <span>Origem</span>
                  <strong className="badge badge-manual">
                    <i className="bi bi-shield-check"></i> Concedido pelo admin
                  </strong>
                </div>
              )}
            </div>
          </div>

          {/* Recursos */}
          <div className="drawer-section">
            <div className="drawer-section-title">Recursos</div>
            <p className="drawer-section-sub">
              Clique no estado para alternar entre <em>pelo plano</em>, <em>liberado</em> ou <em>bloqueado</em>.
            </p>
            <div className="resource-list">
              {resources.map((resource) => (
                <div key={resource.id} className="resource-row">
                  <div className="resource-info">
                    <div className="resource-label">{resource.label}</div>
                    <div className="resource-desc">{resource.description}</div>
                    <span className="resource-plan-req">Requer {resource.requiredPlan.replace('nivel', 'Nível ')}</span>
                  </div>
                  <button
                    type="button"
                    className={`override-toggle ${overrideClass[resource.override]}`}
                    onClick={() => toggleResource(resource.id)}
                    title="Clique para alternar"
                  >
                    <i className={`bi ${overrideIcon[resource.override]}`}></i>
                    {overrideLabel[resource.override]}
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn-secondary" onClick={applyResourceChanges}>
              Salvar recursos
            </button>
          </div>

          {/* Concessão de planos (multi-seleção) */}
          <div className="drawer-section">
            <div className="drawer-section-title">Conceder planos</div>
            <p className="drawer-section-sub">
              Selecione um ou mais níveis para este usuário. Os benefícios de todos os níveis selecionados serão combinados.
            </p>
            <div className="plan-checkboxes">
              {plans.map((p) => (
                <label key={p.id} className={`plan-checkbox-row ${grantPlans.includes(p.id) ? 'plan-checkbox-row-active' : ''}`}>
                  <input
                    type="checkbox"
                    className="plan-checkbox-input"
                    checked={grantPlans.includes(p.id)}
                    onChange={() => togglePlan(p.id)}
                  />
                  <div className="plan-checkbox-info">
                    <span className="plan-checkbox-label">{p.id.replace('nivel', 'Nível ')}</span>
                    <span className="plan-checkbox-desc">{p.label}</span>
                  </div>
                  {grantPlans.includes(p.id) && (
                    <i className="bi bi-check-circle-fill plan-checkbox-check"></i>
                  )}
                </label>
              ))}
            </div>
            {grantPlans.length > 1 && (
              <p className="drawer-section-sub" style={{ marginTop: '0.5rem' }}>
                <i className="bi bi-info-circle" /> Acesso efetivo:{' '}
                <strong>{grantPlans.map((id) => id.replace('nivel', 'Nível ')).join(' + ')}</strong>
              </p>
            )}
            <div className="grant-fields">
              <label className="field-label">
                Expira em (opcional)
                <input
                  type="date"
                  className="field-input"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </label>
              <label className="field-label">
                Motivo (auditoria)
                <input
                  type="text"
                  className="field-input"
                  placeholder="ex: demonstração para lead qualificado"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            </div>
            <button type="button" className="btn-primary" onClick={applyGrant}>
              <i className="bi bi-shield-check"></i>
              Aplicar concessão
            </button>
          </div>

          {/* Histórico de pagamentos */}
          <div className="drawer-section">
            <div className="drawer-section-title">Histórico de pagamentos</div>
            {user.payments.length > 0 ? (
              <div className="payment-timeline">
                {user.payments.map((p) => (
                  <div key={p.id} className="payment-item">
                    <div className="payment-dot"></div>
                    <div className="payment-info">
                      <strong>{p.plan}</strong>
                      <span>{p.amount} · {p.date}</span>
                      <span className={`badge ${p.status === 'pago' ? 'badge-n2' : 'badge-neutral'}`}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted">Nenhum pagamento registrado.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
