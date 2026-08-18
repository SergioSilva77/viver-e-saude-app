// ── AI provider models ─────────────────────────────────────

export type ClaudeModelId =
  | 'claude-sonnet-4-5'
  | 'claude-opus-4-5'
  | 'claude-haiku-3-5'

export type GeminiModelId =
  | 'gemini-2.0-flash'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash'

export type MiMoModelId =
  | 'mimo-v2.5-pro'

export type MiMoFreeModelId =
  | 'mimo-v2-pro-free'

export type AiProvider = 'claude' | 'gemini' | 'mimo' | 'mimo-free'

export interface ClaudeModel {
  id: ClaudeModelId
  label: string
  description: string
  tier: 'fast' | 'balanced' | 'powerful'
}

export interface GeminiModel {
  id: GeminiModelId
  label: string
  description: string
  tier: 'fast' | 'balanced' | 'powerful'
}

export interface MiMoModel {
  id: MiMoModelId
  label: string
  description: string
  tier: 'fast' | 'balanced' | 'powerful'
}

export interface MiMoFreeModel {
  id: MiMoFreeModelId
  label: string
  description: string
  tier: 'fast' | 'balanced' | 'powerful'
}

// ── Config groups ──────────────────────────────────────────

export interface StripeConfig {
  secretKey: string
  webhookSecret: string
  priceIdNivel1: string
  priceIdNivel2: string
  priceIdNivel3: string
}

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

export interface ClaudeConfig {
  apiKey: string
  activeModel: ClaudeModelId
}

export interface GeminiConfig {
  apiKey: string
  activeModel: GeminiModelId
}

export interface MiMoConfig {
  apiKey: string
  activeModel: MiMoModelId
}

export interface MiMoFreeConfig {
  apiKey: string
  activeModel: MiMoFreeModelId
}

export interface AiConfig {
  activeProvider: AiProvider
  claude: ClaudeConfig
  gemini: GeminiConfig
  mimo: MiMoConfig
  mimoFree: MiMoFreeConfig
  rememberPersonSummary: boolean
}

export type SessionDurationDays = 1 | 7 | 15 | 30 | 60

export interface SessionConfig {
  durationDays: SessionDurationDays
}

export interface AppSettings {
  session: SessionConfig
  stripe: StripeConfig
  ai: AiConfig
  smtp: SmtpConfig
}

// ── Static model catalog ───────────────────────────────────

export const CLAUDE_MODELS: ClaudeModel[] = [
  {
    id: 'claude-haiku-3-5',
    label: 'Claude Haiku 3.5',
    description: 'Respostas rápidas e econômicas, ideal para interações simples.',
    tier: 'fast',
  },
  {
    id: 'claude-sonnet-4-5',
    label: 'Claude Sonnet 4.5',
    description: 'Equilíbrio ideal entre velocidade, qualidade e custo.',
    tier: 'balanced',
  },
  {
    id: 'claude-opus-4-5',
    label: 'Claude Opus 4.5',
    description: 'Máxima capacidade de raciocínio para respostas complexas.',
    tier: 'powerful',
  },
]

export const GEMINI_MODELS: GeminiModel[] = [
  {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    description: 'Baixa latência, excelente para chat em tempo real.',
    tier: 'fast',
  },
  {
    id: 'gemini-1.5-flash',
    label: 'Gemini 1.5 Flash',
    description: 'Custo-benefício otimizado para volume alto de consultas.',
    tier: 'balanced',
  },
  {
    id: 'gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    description: 'Modelo premium com janela de contexto de 1 milhão de tokens.',
    tier: 'powerful',
  },
]

export const MIMO_MODELS: MiMoModel[] = [
  {
    id: 'mimo-v2.5-pro',
    label: 'MiMo v2.5 Pro',
    description: 'Modelo Xiaomi de alta performance via OpenRouter.',
    tier: 'balanced',
  },
]

export const MIMO_FREE_MODELS: MiMoFreeModel[] = [
  {
    id: 'mimo-v2-pro-free',
    label: 'MiMo v2 Pro (Free)',
    description: 'Modelo gratuito via OpenRouter — sem custo por requisição.',
    tier: 'fast',
  },
]

export const TIER_ICON: Record<string, string> = {
  fast: 'bi-lightning-charge-fill',
  balanced: 'bi-stars',
  powerful: 'bi-cpu-fill',
}

export const TIER_LABEL: Record<string, string> = {
  fast: 'Rápido',
  balanced: 'Equilibrado',
  powerful: 'Poderoso',
}

// ── localStorage persistence ───────────────────────────────

const STORAGE_KEY = 'vs_admin_settings'

export const SESSION_DURATION_OPTIONS: { value: SessionDurationDays; label: string }[] = [
  { value: 1, label: '1 dia' },
  { value: 7, label: '7 dias' },
  { value: 15, label: '15 dias' },
  { value: 30, label: '30 dias (padrão)' },
  { value: 60, label: '60 dias' },
]

export const DEFAULT_SETTINGS: AppSettings = {
  session: {
    durationDays: 30,
  },
  stripe: {
    secretKey: '',
    webhookSecret: '',
    priceIdNivel1: '',
    priceIdNivel2: '',
    priceIdNivel3: '',
  },
  smtp: {
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    from: '',
  },
  ai: {
    activeProvider: 'claude',
    claude: {
      apiKey: '',
      activeModel: 'claude-sonnet-4-5',
    },
    gemini: {
      apiKey: '',
      activeModel: 'gemini-2.0-flash',
    },
    mimo: {
      apiKey: '',
      activeModel: 'mimo-v2.5-pro',
    },
    mimoFree: {
      apiKey: '',
      activeModel: 'mimo-v2-pro-free',
    },
    rememberPersonSummary: false,
  },
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULT_SETTINGS)
    const parsed = JSON.parse(raw)
    const merged = { ...DEFAULT_SETTINGS, ...parsed }
    merged.ai = { ...DEFAULT_SETTINGS.ai, ...parsed.ai }
    merged.ai.claude = { ...DEFAULT_SETTINGS.ai.claude, ...parsed.ai?.claude }
    merged.ai.gemini = { ...DEFAULT_SETTINGS.ai.gemini, ...parsed.ai?.gemini }
    merged.ai.mimo = { ...DEFAULT_SETTINGS.ai.mimo, ...parsed.ai?.mimo }
    merged.ai.mimoFree = { ...DEFAULT_SETTINGS.ai.mimoFree, ...parsed.ai?.mimoFree }
    merged.smtp = { ...DEFAULT_SETTINGS.smtp, ...parsed.smtp }
    return merged
  } catch {
    return structuredClone(DEFAULT_SETTINGS)
  }
}

export function saveSettings(settings: AppSettings): void {
  // SEGURANÇA: secrets (chaves de API, senhas) NUNCA são persistidos
  // no navegador. Eles vivem apenas no servidor (.json no backend).
  // Aqui só guardamos preferências não-sensíveis (modelos, provedor,
  // price IDs, host/porta, duração de sessão).
  const safe = structuredClone(settings)
  safe.stripe.secretKey = ''
  safe.stripe.webhookSecret = ''
  safe.smtp.pass = ''
  safe.ai.claude.apiKey = ''
  safe.ai.gemini.apiKey = ''
  safe.ai.mimo.apiKey = ''
  safe.ai.mimoFree.apiKey = ''
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safe))
}
