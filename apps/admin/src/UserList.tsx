import type { AdminUser } from './types'
import type { PlanId } from '@viver-saude/shared'

interface Props {
  users: AdminUser[]
  onSelect: (user: AdminUser) => void
  onCreateNew: () => void
}

const planBadgeClass: Record<PlanId, string> = {
  nivel1: 'badge-n1',
  nivel2: 'badge-n2',
  nivel3: 'badge-n3',
}

function PlanBadges({ user }: { user: AdminUser }) {
  if (user.planIds.length === 0) {
    return <span className="badge badge-neutral">Sem plano</span>
  }
  return (
    <span style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
      {user.grantedByAdmin && (
        <i className="bi bi-shield-check" title="Concedido pelo admin" style={{ marginRight: '0.2rem', color: 'var(--clr-green)' }} />
      )}
      {user.planIds.map((id) => (
        <span key={id} className={`badge ${planBadgeClass[id]}`}>
          {id.replace('nivel', 'N')}
        </span>
      ))}
    </span>
  )
}

export function UserList({ users, onSelect, onCreateNew }: Props) {
  return (
    <div className="user-list-section">
      <div className="section-bar">
        <div>
          <h2 className="section-heading">Usuários</h2>
          <p className="section-desc">{users.length} cadastros encontrados</p>
        </div>
        <button type="button" className="btn-primary" onClick={onCreateNew}>
          <i className="bi bi-person-plus-fill"></i>
          Criar usuário
        </button>
      </div>

      <div className="user-table">
        <div className="user-table-header">
          <span>Nome</span>
          <span>Email</span>
          <span>Planos</span>
          <span>Cadastro</span>
          <span>Expira em</span>
          <span></span>
        </div>

        {users.map((user) => (
          <div key={user.id} className="user-row">
            <div className="user-row-name">
              <div className="user-avatar">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
              <span>{user.fullName}</span>
            </div>
            <span className="user-email">{user.email}</span>
            <span>
              <PlanBadges user={user} />
            </span>
            <span className="user-date">{user.createdAt}</span>
            <span className="user-date">
              {user.expiresAt ? (
                <span className="expiry-pill">{user.expiresAt}</span>
              ) : (
                <span className="text-muted">—</span>
              )}
            </span>
            <button
              type="button"
              className="btn-detail"
              onClick={() => onSelect(user)}
            >
              Ver detalhes
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
        ))}
      </div>

      {/* Métricas rápidas */}
      <div className="metrics-row">
        {[
          { label: 'Sem plano', value: users.filter((u) => u.planIds.length === 0).length, cls: 'badge-neutral' },
          { label: 'Nível 1', value: users.filter((u) => u.planIds.includes('nivel1')).length, cls: 'badge-n1' },
          { label: 'Nível 2', value: users.filter((u) => u.planIds.includes('nivel2')).length, cls: 'badge-n2' },
          { label: 'Nível 3', value: users.filter((u) => u.planIds.includes('nivel3')).length, cls: 'badge-n3' },
          { label: 'Acesso manual', value: users.filter((u) => u.grantedByAdmin && u.planIds.length > 0).length, cls: 'badge-manual' },
        ].map((m) => (
          <div key={m.label} className="metric-chip">
            <span className={`badge ${m.cls}`}>{m.label}</span>
            <strong>{m.value}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}
