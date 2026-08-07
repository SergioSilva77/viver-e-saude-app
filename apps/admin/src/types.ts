import type { PlanId } from '@viver-saude/shared'

export type AdminSection = 'usuarios' | 'receitas' | 'mensagens' | 'concessoes' | 'config-ia' | 'config-stripe' | 'tokens' | 'comunidade'

export type UserStatus = 'sem_plano' | 'nivel1' | 'nivel2' | 'nivel3' | 'acesso_manual'

export type ResourceOverride = 'herdado' | 'liberado' | 'bloqueado'

export interface ResourceToggle {
  id: string
  label: string
  description: string
  requiredPlan: PlanId
  override: ResourceOverride
}

export interface PaymentRecord {
  id: string
  date: string
  plan: string
  amount: string
  status: 'pago' | 'pendente' | 'cancelado'
}

export interface AdminUser {
  id: string
  fullName: string
  email: string
  /** Array of plan levels granted to this user. Replaces legacy planId. */
  planIds: PlanId[]
  status: UserStatus
  createdAt: string
  lastAccessAt: string | null
  expiresAt: string | null
  grantedByAdmin: boolean
  resources: ResourceToggle[]
  payments: PaymentRecord[]
}

export const ALL_RESOURCES: Omit<ResourceToggle, 'override'>[] = [
  {
    id: 'guardiao_limitado',
    label: 'MeuGuardião (limitado)',
    description: 'Acesso por 24h com limite de consultas',
    requiredPlan: 'nivel1',
  },
  {
    id: 'guardiao_completo',
    label: 'MeuGuardião (completo)',
    description: 'Acesso irrestrito ao assistente de IA',
    requiredPlan: 'nivel2',
  },
  {
    id: 'receitas_ebook',
    label: 'Receitas e e-book',
    description: '70 receitas naturais e material em PDF',
    requiredPlan: 'nivel2',
  },
  {
    id: 'whatsapp_consultoria',
    label: 'WhatsApp consultoria',
    description: 'Bate-papo gratuito toda segunda',
    requiredPlan: 'nivel2',
  },
  {
    id: 'comunidade_whatsapp',
    label: 'Grupo WhatsApp exclusivo',
    description: 'Acesso ao grupo premium',
    requiredPlan: 'nivel3',
  },
  {
    id: 'comunidade_telegram',
    label: 'Canal Telegram exclusivo',
    description: 'Canal premium de protocolos',
    requiredPlan: 'nivel3',
  },
  {
    id: 'videoconferencia',
    label: 'Videoconferência agendada',
    description: 'Atendimento com profissionais da área',
    requiredPlan: 'nivel3',
  },
]

// ── localStorage persistence ───────────────────────────────

const USERS_STORAGE_KEY = 'vs_admin_users'

/** Normalizes legacy records that used planId instead of planIds. */
function normalizeLegacyUser(raw: AdminUser & { planId?: PlanId | null }): AdminUser {
  if (!raw.planIds) {
    raw.planIds = raw.planId ? [raw.planId] : []
  }
  return raw
}

export function loadUsers(): AdminUser[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as (AdminUser & { planId?: PlanId | null })[]
    return parsed.map(normalizeLegacyUser)
  } catch {
    return []
  }
}

export function persistUsers(users: AdminUser[]): void {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))
}
