export type PlanId = 'nivel1' | 'nivel2' | 'nivel3'
export type BillingInterval = 'one_time' | 'monthly'
export type AppSection = 'inicio' | 'meuguardiao' | 'receitas' | 'comunidade' | 'conta'

export interface PlanDefinition {
  id: PlanId
  label: string
  priceInCents: number
  billingInterval: BillingInterval
  description: string
  benefits: string[]
  whatsappEnabled: boolean
  telegramEnabled: boolean
  aiAccess: 'locked' | 'limited' | 'full'
}

export interface NavItem {
  id: AppSection
  label: string
  icon: string
}

export interface CommunityLink {
  id: string
  title: string
  platform: 'whatsapp' | 'telegram'
  audience: PlanId[]
  href: string
}

export interface RecipeAsset {
  id: string
  title: string
  category: string
  summary: string
  premiumPlan: PlanId
  assetType: 'ebook' | 'recipe' | 'protocol'
}

export interface FamilyMemberHistory {
  relation: string
  notes: string
}

export interface HealthProfile {
  age: number
  weightKg: number
  heightCm: number
  bloodType: string
  goals: string[]
  familyHistory: FamilyMemberHistory[]
}

export interface BillingStatus {
  planId: PlanId | null
  paymentConfirmed: boolean
  subscriptionActive: boolean
  trialEndsAt?: string
}

export interface OnboardingDecision {
  canLogin: boolean
  nextStep: 'checkout' | 'app' | 'support'
  message: string
}

export const appName = 'Viver & Saúde'

export const plans: PlanDefinition[] = [
  {
    id: 'nivel1',
    label: 'Cadastro único - Nível 1',
    priceInCents: 2990,
    billingInterval: 'one_time',
    description: 'Ativa a jornada inicial do usuário e libera a primeira camada do ecossistema.',
    benefits: [
      'Desbloqueio inicial do MeuGuardião por 24 horas',
      '30 minutos com consultor gratuito uma única vez',
      'Acesso ao onboarding pago obrigatório',
    ],
    whatsappEnabled: false,
    telegramEnabled: false,
    aiAccess: 'limited',
  },
  {
    id: 'nivel2',
    label: 'Assinatura mensal - Nível 2',
    priceInCents: 1807,
    billingInterval: 'monthly',
    description: 'Assinatura recorrente para uso contínuo dos recursos de rotina.',
    benefits: [
      'MeuGuardião com liberação total',
      '70 receitas naturais e e-book',
      'Bate-papo gratuito toda segunda-feira',
      'Botão de WhatsApp para consultoria gratuita',
    ],
    whatsappEnabled: true,
    telegramEnabled: false,
    aiAccess: 'full',
  },
  {
    id: 'nivel3',
    label: 'Experiência premium - Nível 3',
    priceInCents: 7990,
    billingInterval: 'monthly',
    description: 'Plano premium com consultoria e grupos exclusivos.',
    benefits: [
      'Treinamento gratuito de até 30 minutos',
      'Todos os benefícios dos níveis 1 e 2',
      'Grupos exclusivos no WhatsApp e Telegram',
      'Atendimento por videoconferência sob agendamento',
      'Acesso à fábrica com descontos e indicações da plataforma',
    ],
    whatsappEnabled: true,
    telegramEnabled: true,
    aiAccess: 'full',
  },
]

export const bottomNavItems: NavItem[] = [
  { id: 'inicio', label: 'Início', icon: 'bi-house-heart' },
  { id: 'meuguardiao', label: 'MeuGuardião', icon: 'bi-chat-heart' },
  { id: 'receitas', label: 'Receitas', icon: 'bi-journal-medical' },
  { id: 'comunidade', label: 'Comunidade', icon: 'bi-people' },
  { id: 'conta', label: 'Conta', icon: 'bi-person-circle' },
]

export const sampleCommunityLinks: CommunityLink[] = [
  {
    id: 'grupo-whatsapp-boasvindas',
    title: 'Grupo oficial de boas-vindas',
    platform: 'whatsapp',
    audience: ['nivel2', 'nivel3'],
    href: 'https://wa.me/5500000000000',
  },
  {
    id: 'grupo-telegram-premium',
    title: 'Canal premium de protocolos',
    platform: 'telegram',
    audience: ['nivel3'],
    href: 'https://t.me/viveresaude-premium',
  },
]

export const sampleRecipes: RecipeAsset[] = [
  {
    id: 'ebook-natural',
    title: 'E-book de receitas naturais',
    category: 'Material rico',
    summary: 'Coletânea inicial para alimentação funcional com foco em rotina saudável.',
    premiumPlan: 'nivel2',
    assetType: 'ebook',
  },
  {
    id: 'protocolo-imunidade',
    title: 'Protocolo de imunidade',
    category: 'Orientação',
    summary: 'Sugestões de produtos e hábitos para fortalecimento diário.',
    premiumPlan: 'nivel2',
    assetType: 'protocol',
  },
  {
    id: 'receita-calmante',
    title: 'Chá calmante funcional',
    category: 'Receita',
    summary: 'Receita simples voltada ao relaxamento e qualidade do sono.',
    premiumPlan: 'nivel1',
    assetType: 'recipe',
  },
]

export const sampleHealthProfile: HealthProfile = {
  age: 39,
  weightKg: 71,
  heightCm: 168,
  bloodType: 'O+',
  goals: ['Reduzir inflamação', 'Melhorar energia', 'Organizar rotina alimentar'],
  familyHistory: [
    { relation: 'Mãe', notes: 'Histórico de hipertensão.' },
    { relation: 'Avô', notes: 'Diabetes tipo 2.' },
  ],
}

export function formatCurrencyBRL(amountInCents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amountInCents / 100)
}

export function getPlan(planId: PlanId): PlanDefinition {
  const plan = plans.find((item) => item.id === planId)

  if (!plan) {
    throw new Error(`Plano inválido: ${planId}`)
  }

  return plan
}

export type SectionAccess = 'free' | 'locked' | 'limited'

export function canAccessSection(planId: PlanId | null, section: AppSection): boolean {
  return getSectionAccess(planId, section) !== 'locked'
}

/**
 * Resolves section access when a user holds multiple plan levels.
 * Returns the best (most permissive) access across all provided plans.
 */
export function getSectionAccessForPlans(planIds: PlanId[], section: AppSection): SectionAccess {
  if (planIds.length === 0) return getSectionAccess(null, section)
  const results = planIds.map((id) => getSectionAccess(id, section))
  if (results.includes('free')) return 'free'
  if (results.includes('limited')) return 'limited'
  return 'locked'
}

/**
 * Returns the highest plan from a list, or null if the list is empty.
 * Order: nivel3 > nivel2 > nivel1.
 */
export function getEffectivePlanId(planIds: PlanId[]): PlanId | null {
  if (planIds.includes('nivel3')) return 'nivel3'
  if (planIds.includes('nivel2')) return 'nivel2'
  if (planIds.includes('nivel1')) return 'nivel1'
  return null
}

export function getSectionAccess(planId: PlanId | null, section: AppSection): SectionAccess {
  if (section === 'inicio') return 'free'

  if (!planId) return 'locked'

  switch (section) {
    case 'meuguardiao':
      if (planId === 'nivel1') return 'limited'
      return 'free'

    case 'receitas':
      if (planId === 'nivel1') return 'locked'
      return 'free'

    case 'comunidade':
      if (planId === 'nivel3') return 'free'
      return 'locked'

    case 'conta':
      return 'free'

    default:
      return 'locked'
  }
}

export const sectionRequiredPlan: Record<AppSection, string> = {
  inicio: '',
  meuguardiao: 'Nível 1',
  receitas: 'Nível 2',
  comunidade: 'Nível 3',
  conta: 'Nível 1',
}

export function resolveOnboardingDecision(status: BillingStatus): OnboardingDecision {
  if (!status.paymentConfirmed) {
    return {
      canLogin: false,
      nextStep: 'checkout',
      message: 'Finalize o pagamento inicial para liberar o acesso ao aplicativo.',
    }
  }

  if (status.planId === 'nivel1') {
    return {
      canLogin: true,
      nextStep: 'app',
      message: 'Seu acesso inicial foi liberado com sucesso.',
    }
  }

  if (status.subscriptionActive || status.trialEndsAt) {
    return {
      canLogin: true,
      nextStep: 'app',
      message: 'Seu plano recorrente está ativo.',
    }
  }

  return {
    canLogin: true,
    nextStep: 'support',
    message: 'Seu cadastro existe, mas há pendências de assinatura para revisar.',
  }
}
