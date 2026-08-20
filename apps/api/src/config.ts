import 'dotenv/config'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { AiConfig } from './ai.js'

// ── Config file paths ──────────────────────────────────────
const AI_CONFIG_PATH = resolve(process.cwd(), '.ai-config.json')
const STRIPE_CONFIG_PATH = resolve(process.cwd(), '.stripe-config.json')
const SMTP_CONFIG_PATH = resolve(process.cwd(), '.smtp-config.json')

// ── Stripe config shape (file) ─────────────────────────────
export interface StripeFileConfig {
  secretKey: string
  webhookSecret: string
  priceIdNivel1: string
  priceIdNivel2: string
  priceIdNivel3: string
}

// ── SMTP config shape (file) ───────────────────────────────
export interface SmtpFileConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

// ── File readers ───────────────────────────────────────────

function readAiConfigFile(): Partial<AiConfig> {
  try {
    if (!existsSync(AI_CONFIG_PATH)) return {}
    return JSON.parse(readFileSync(AI_CONFIG_PATH, 'utf-8')) as Partial<AiConfig>
  } catch {
    return {}
  }
}

function readStripeConfigFile(): Partial<StripeFileConfig> {
  try {
    if (!existsSync(STRIPE_CONFIG_PATH)) return {}
    return JSON.parse(readFileSync(STRIPE_CONFIG_PATH, 'utf-8')) as Partial<StripeFileConfig>
  } catch {
    return {}
  }
}

function readSmtpConfigFile(): Partial<SmtpFileConfig> {
  try {
    if (!existsSync(SMTP_CONFIG_PATH)) return {}
    return JSON.parse(readFileSync(SMTP_CONFIG_PATH, 'utf-8')) as Partial<SmtpFileConfig>
  } catch {
    return {}
  }
}

// ── Static config (env vars) ───────────────────────────────

export const config = {
  port: Number(process.env.PORT ?? 4000),
  appUrl: process.env.APP_URL ?? 'http://localhost:5173',
  adminUrl: process.env.ADMIN_URL ?? 'http://localhost:5174',
  appScheme: process.env.APP_SCHEME ?? 'viversaude',
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  adminEmail: process.env.ADMIN_EMAIL ?? '',
  adminPassword: process.env.ADMIN_PASSWORD ?? '',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/viversaude',
  // Usado para assinar/verificar tokens JWT de usuário (chat, chamadas, agendamento).
  // Em produção DEVE vir de env var — o fallback abaixo é só para dev local e
  // gera um aviso no boot para não passar despercebido.
  jwtSecret: process.env.JWT_SECRET ?? '',
  // Servidor TURN/STUN (coturn) para WebRTC — Módulo 3 (chamadas).
  turnSecret: process.env.TURN_SECRET ?? '',
  turnHost: process.env.TURN_HOST ?? '',
}

if (!config.jwtSecret) {
  console.warn(
    '[Config] JWT_SECRET não definido — usando chave de desenvolvimento insegura. ' +
      'Defina JWT_SECRET no .env antes de ir para produção.',
  )
}

/** Chave efetiva usada para assinar tokens (nunca vazia, mas insegura sem env var). */
export const effectiveJwtSecret = config.jwtSecret || 'dev-insecure-secret-do-not-use-in-production'

// ── Email (SMTP) config ────────────────────────────────────
// Priority: env vars → .smtp-config.json → null
// Read at call time so admin-panel updates take effect without restart.

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

export function getSmtpConfig(): SmtpConfig | null {
  const file = readSmtpConfigFile()
  const host = process.env.SMTP_HOST ?? file.host ?? ''
  const user = process.env.SMTP_USER ?? file.user ?? ''
  const pass = process.env.SMTP_PASS ?? file.pass ?? ''
  if (!host || !user || !pass) return null
  return {
    host,
    port: Number(process.env.SMTP_PORT ?? file.port ?? 587),
    secure: (process.env.SMTP_SECURE ?? String(file.secure ?? false)) === 'true',
    user,
    pass,
    from: process.env.SMTP_FROM ?? file.from ?? user,
  }
}

// ── Dynamic Stripe config ──────────────────────────────────
// Priority: env vars → .stripe-config.json → empty string
// Read at call time so admin-panel updates take effect without restart.

export function getStripeConfig(): StripeFileConfig {
  const file = readStripeConfigFile()
  return {
    secretKey:       process.env.STRIPE_SECRET_KEY        ?? file.secretKey        ?? '',
    webhookSecret:   process.env.STRIPE_WEBHOOK_SECRET    ?? file.webhookSecret    ?? '',
    priceIdNivel1:   process.env.STRIPE_PRICE_ID_NIVEL1   ?? file.priceIdNivel1    ?? '',
    priceIdNivel2:   process.env.STRIPE_PRICE_ID_NIVEL2   ?? file.priceIdNivel2    ?? '',
    priceIdNivel3:   process.env.STRIPE_PRICE_ID_NIVEL3   ?? file.priceIdNivel3    ?? '',
  }
}

export function hasStripeConfig(): boolean {
  return Boolean(getStripeConfig().secretKey)
}

export function hasSupabaseAdminConfig(): boolean {
  return Boolean(config.supabaseUrl && config.supabaseServiceRoleKey)
}

/**
 * Resolves the current AI config.
 * Priority: env vars → .ai-config.json → no config.
 */
export function getAiConfig(): AiConfig | null {
  const fileConfig = readAiConfigFile()

  const provider = (process.env.AI_PROVIDER as AiConfig['provider'] | undefined) ?? fileConfig.provider ?? 'claude'

  let apiKey = fileConfig.apiKey ?? ''
  let model = fileConfig.model ?? 'claude-sonnet-4-5'
  const rememberPersonSummary = fileConfig.rememberPersonSummary ?? false

  if (provider === 'mimo' || provider === 'mimo-free') {
    apiKey = process.env.OPENROUTER_API_KEY ?? apiKey
    model = process.env.AI_MODEL ?? model
  } else if (provider === 'gemini') {
    apiKey = process.env.GEMINI_API_KEY ?? apiKey
    model = process.env.AI_MODEL ?? model
  } else {
    apiKey = process.env.ANTHROPIC_API_KEY ?? apiKey
    model = process.env.AI_MODEL ?? model
  }

  if (!apiKey) return null

  return { provider, apiKey, model, rememberPersonSummary }
}
