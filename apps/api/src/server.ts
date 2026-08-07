import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import multer from 'multer'
import { z } from 'zod'
import Stripe from 'stripe'
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve, extname, basename } from 'node:path'
import {
  getCatalog,
  createCheckoutSession,
  registerPendingUser,
  applyWebhookCheckoutCompleted,
  applyWebhookSubscriptionDeleted,
  cancelSubscriptionAtPeriodEnd,
  getStripeClient,
} from './services.js'
import { getPlan } from '@viver-saude/shared'
import { config, getStripeConfig, hasStripeConfig, getAiConfig, type StripeFileConfig } from './config.js'
import { chat, type ChatMessage, type UserProfile } from './ai.js'
import { recordUsage, getUsageStats, setQuota } from './tokenTracker.js'
import { listUsers, upsertUser, removeUser, findByEmail } from './userStore.js'
import { createResetToken, consumeResetToken } from './resetTokenStore.js'
import { sendPasswordResetLink } from './emailService.js'
import { listCommunityLinks, upsertCommunityLink, removeCommunityLink, type CommunityPlatform } from './communityStore.js'
import { listRecipes, listRecipesMeta, getRecipeById, upsertRecipe, removeRecipe } from './recipeStore.js'
import {
  listChats,
  getChatWithMessages,
  createChat as dbCreateChat,
  updateChatTitle,
  deleteChat as dbDeleteChat,
  addMessage,
} from './chatStore.js'
import { shutdown as shutdownDb } from './db.js'
import {
  loadManifest,
  removeManifestEntry,
  selectRelevantFiles,
  upsertManifestEntry,
  type KnowledgeEntry,
} from './knowledgeRouter.js'

// ── Paths ──────────────────────────────────────────────────
const AI_CONFIG_PATH = resolve(process.cwd(), '.ai-config.json')
const STRIPE_CONFIG_PATH = resolve(process.cwd(), '.stripe-config.json')
const KNOWLEDGE_DIR = resolve(process.cwd(), 'knowledge')

// Ensure required directories exist on startup
mkdirSync(KNOWLEDGE_DIR, { recursive: true })

// ── Zod schemas ────────────────────────────────────────────
const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  fullName: z.string().min(3),
  planId: z.enum(['nivel1', 'nivel2', 'nivel3']),
})

const checkoutSchema = z.object({
  // email is optional — Stripe collects it during checkout if not provided
  // preprocess converts empty string '' to undefined to avoid email format errors
  email: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().email().optional()
  ),
  planId: z.enum(['nivel1', 'nivel2', 'nivel3']),
  fullName: z.string().min(2).max(100).optional(),
})

const registerPostPaymentSchema = z.object({
  stripeSessionId: z.string().min(1),
  fullName: z.string().min(2).max(100),
  password: z.string().min(8).max(128),
})

const grantSchema = z.object({
  userId: z.uuid(),
  planId: z.enum(['nivel1', 'nivel2', 'nivel3']),
  expiresAt: z.iso.datetime().optional(),
  reason: z.string().min(3),
})

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(50),
  userProfile: z
    .object({
      name: z.string().optional(),
      age: z.number().optional(),
      weightKg: z.number().optional(),
      heightCm: z.number().optional(),
      bloodType: z.string().optional(),
      goals: z.array(z.string()).optional(),
      familyHistory: z.array(z.object({ relation: z.string(), notes: z.string() })).optional(),
    })
    .optional(),
  userId: z.string().optional(),
  userEmail: z.string().optional(),
  chatId: z.string().optional(),
})

const chatIdParamSchema = z.object({
  id: z.string().min(1),
})

const generateTitleSchema = z.object({
  firstMessage: z.string().min(1).max(2000),
})

const tokenQuotaSchema = z.object({
  quota: z.number().int().positive().nullable(),
})

const aiSettingsSchema = z.object({
  provider: z.enum(['claude', 'gemini', 'mimo', 'mimo-free']),
  apiKey: z.string().min(10),
  model: z.string().min(3),
})

const stripeSettingsSchema = z.object({
  secretKey:      z.string().min(1),
  webhookSecret:  z.string().default(''),
  priceIdNivel1:  z.string().default(''),
  priceIdNivel2:  z.string().default(''),
  priceIdNivel3:  z.string().default(''),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
})

const createUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  fullName: z.string().default(''),
  planIds: z.array(z.string()).default([]),
  password: z.string().optional(),
})

const knowledgeMetaSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(300).default(''),
  topics: z.array(z.string().min(1).max(50)).max(30).default([]),
})

// ── Multer — only .txt, max 512 KB ────────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, KNOWLEDGE_DIR),
    filename: (_req, file, cb) => {
      // Sanitize filename: keep only safe characters
      const safe = basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_')
      cb(null, safe)
    },
  }),
  limits: { fileSize: 512 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (extname(file.originalname).toLowerCase() !== '.txt') {
      cb(new Error('Apenas arquivos .txt são aceitos.'))
      return
    }
    cb(null, true)
  },
})

// ── Helpers ────────────────────────────────────────────────
function requireAdminToken(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const token = req.headers['x-admin-token']
  if (token !== config.adminApiSecret) {
    res.status(401).json({ message: 'Token de administrador inválido.' })
    return
  }
  next()
}


// ── App ────────────────────────────────────────────────────
const app = express()

// Webhook route must be before express.json()
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (request, response) => {
  const stripeConf = getStripeConfig()
  if (!stripeConf.secretKey || !stripeConf.webhookSecret) {
    response.status(503).json({
      message: 'Configure STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET para processar webhooks.',
    })
    return
  }

  try {
    const event = getStripeClient().webhooks.constructEvent(
      request.body,
      request.headers['stripe-signature'] ?? '',
      stripeConf.webhookSecret,
    )

    if (event.type === 'checkout.session.completed') {
      await applyWebhookCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
    }

    if (event.type === 'customer.subscription.deleted') {
      await applyWebhookSubscriptionDeleted(event.data.object as Stripe.Subscription)
    }

    response.json({ received: true })
  } catch (error) {
    response.status(400).json({
      message: error instanceof Error ? error.message : 'Falha ao validar webhook.',
    })
  }
})

app.use(express.json())
app.use(cors({ origin: [config.appUrl, config.adminUrl] }))
app.use(helmet())
app.use(morgan('dev'))

// ── Health ─────────────────────────────────────────────────
app.get(['/health', '/api/health'], (_req, res) => {
  const aiConfig = getAiConfig()
  res.json({
    status: 'ok',
    service: 'viver-saude-api',
    stripeConfigured: hasStripeConfig(),
    aiConfigured: aiConfig !== null,
    aiProvider: aiConfig?.provider ?? null,
  })
})

// ── Catalog ────────────────────────────────────────────────
app.get('/api/catalog/plans', (_req, res) => {
  res.json({ plans: getCatalog() })
})

// ── Onboarding ─────────────────────────────────────────────
app.post('/api/onboarding/register-intent', async (req, res) => {
  try {
    const payload = registerSchema.parse(req.body)
    const persistence = await registerPendingUser(payload)
    res.status(201).json({
      nextStep: 'checkout',
      user: { email: payload.email, fullName: payload.fullName, planId: payload.planId },
      persistence,
    })
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao registrar intenção de cadastro.' })
  }
})

// ── Billing ────────────────────────────────────────────────
app.post('/api/billing/checkout-session', async (req, res) => {
  if (!hasStripeConfig()) {
    res.status(503).json({
      ok: false,
      code: 'stripe_not_configured',
      message: 'Pagamentos indisponíveis no momento. Tente novamente mais tarde.',
    })
    return
  }

  try {
    const payload = checkoutSchema.parse(req.body)

    if (payload.email) {
      const existing = await findByEmail(payload.email)
      if (existing?.planIds.includes(payload.planId)) {
        const expiresIso = existing.planExpiresAt?.[payload.planId]
        const isActive = !expiresIso || new Date(expiresIso).getTime() > Date.now()
        if (isActive) {
          res.status(409).json({
            ok: false,
            code: 'already_subscribed',
            message: 'Este e-mail já possui este plano ativo. Faça login para acessar.',
          })
          return
        }
      }
    }

    const session = await createCheckoutSession(payload.planId, payload.email, payload.fullName)
    res.status(201).json({ ok: true, sessionId: session.id, url: session.url })
  } catch (error) {
    res.status(400).json({
      ok: false,
      code: 'checkout_failed',
      message: error instanceof Error ? error.message : 'Falha ao criar sessão de checkout.',
    })
  }
})

app.get('/api/billing/verify-session', async (req, res) => {
  const sessionId = String(req.query.session_id ?? '')
  if (!sessionId) {
    res.status(400).json({ message: 'session_id é obrigatório.' })
    return
  }

  if (!hasStripeConfig()) {
    res.status(503).json({ message: 'O Stripe ainda não está configurado.' })
    return
  }

  try {
    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const paid = session.payment_status === 'paid' || session.status === 'complete'
    const email = session.customer_details?.email ?? session.customer_email ?? null
    const planId = (session.metadata?.planId ?? null) as string | null
    const fullName = (session.metadata?.fullName ?? null) as string | null

    if (!paid) {
      res.status(400).json({ message: 'Pagamento ainda não confirmado.' })
      return
    }

    res.json({ ok: true, email, planId, fullName, paid })
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Sessão inválida.' })
  }
})

// Link a Stripe session to an already-authenticated user (upgrade / add plan)
app.post('/api/billing/link-session', async (req, res) => {
  if (!hasStripeConfig()) {
    res.status(503).json({ ok: false, message: 'O Stripe ainda não está configurado.' })
    return
  }

  const { userId, stripeSessionId } = req.body as { userId?: string; stripeSessionId?: string }

  if (!userId || !stripeSessionId) {
    res.status(400).json({ ok: false, message: 'userId e stripeSessionId são obrigatórios.' })
    return
  }

  try {
    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(stripeSessionId)
    const paid = session.payment_status === 'paid' || session.status === 'complete'

    if (!paid) {
      res.status(400).json({ ok: false, message: 'Pagamento ainda não confirmado.' })
      return
    }

    const planId = (session.metadata?.planId ?? 'nivel1') as string

    const users = await listUsers()
    const user = users.find((u) => u.id === userId)
    if (!user) {
      res.status(404).json({ ok: false, message: 'Usuário não encontrado.' })
      return
    }

    const plan = getPlan(planId as 'nivel1' | 'nivel2' | 'nivel3')
    const expiresIso = plan.billingInterval === 'monthly'
      ? (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString() })()
      : null

    const updatedPlanIds = user.planIds.includes(planId)
      ? user.planIds
      : [...user.planIds, planId]

    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null

    const updated = await upsertUser({
      id: user.id,
      email: user.email,
      planIds: updatedPlanIds,
      planExpiresAt: expiresIso ? { [planId]: expiresIso } : undefined,
      subscriptionIds: subscriptionId ? { [planId]: subscriptionId } : undefined,
    })

    const planExpiresAtMs: Record<string, number> = {}
    for (const [pid, iso] of Object.entries(updated.planExpiresAt ?? {})) {
      if (iso) planExpiresAtMs[pid] = new Date(iso).getTime()
    }

    res.json({
      ok: true,
      planIds: updated.planIds,
      planExpiresAt: planExpiresAtMs,
    })
  } catch (error) {
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : 'Falha ao vincular plano.' })
  }
})

app.post('/api/auth/register', async (req, res) => {
  if (!hasStripeConfig()) {
    res.status(503).json({ message: 'O Stripe ainda não está configurado.' })
    return
  }

  try {
    const { stripeSessionId, fullName, password } = registerPostPaymentSchema.parse(req.body)

    // Verify payment with Stripe
    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(stripeSessionId)
    const paid = session.payment_status === 'paid' || session.status === 'complete'

    if (!paid) {
      res.status(400).json({ message: 'Pagamento não confirmado. Conclua o pagamento antes de criar sua conta.' })
      return
    }

    const email = session.customer_details?.email ?? session.customer_email
    if (!email) {
      res.status(400).json({ message: 'E-mail não encontrado na sessão do Stripe.' })
      return
    }

    const planId = (session.metadata?.planId ?? 'nivel1') as string

    const existing = await findByEmail(email)
    if (existing) {
      res.status(409).json({ message: 'Esta conta já foi criada. Faça login para acessar.' })
      return
    }

    // Calculate plan expiry
    const plan = getPlan(planId as 'nivel1' | 'nivel2' | 'nivel3')
    const expiresIso = plan.billingInterval === 'monthly'
      ? (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString() })()
      : null

    const newUser = await upsertUser({
      id: `stripe_${stripeSessionId.slice(-12)}`,
      email,
      fullName,
      planIds: [planId],
      password,
      planExpiresAt: expiresIso ? { [planId]: expiresIso } : undefined,
    })

    const planExpiresAtMs: Record<string, number> = {}
    for (const [pid, iso] of Object.entries(newUser.planExpiresAt ?? {})) {
      if (iso) planExpiresAtMs[pid] = new Date(iso).getTime()
    }

    res.status(201).json({
      ok: true,
      userId: newUser.id,
      email: newUser.email,
      planIds: newUser.planIds,
      planExpiresAt: planExpiresAtMs,
    })
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao criar conta.' })
  }
})

app.post('/api/billing/cancel-subscription', async (req, res) => {
  if (!hasStripeConfig()) {
    res.status(503).json({ ok: false, message: 'O Stripe ainda não está configurado.' })
    return
  }

  const { userId, planId } = req.body as { userId?: string; planId?: string }

  if (!userId || !planId) {
    res.status(400).json({ ok: false, message: 'userId e planId são obrigatórios.' })
    return
  }

  try {
    const result = await cancelSubscriptionAtPeriodEnd(userId, planId)
    res.json({ ok: true, cancelAt: result.cancelAt })
  } catch (error) {
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : 'Falha ao cancelar assinatura.' })
  }
})

// ── Recipes (public) ───────────────────────────────────────
app.get('/api/recipes', async (_req, res) => {
  res.json({ recipes: await listRecipesMeta() })
})

app.get('/api/recipes/:id', async (req, res) => {
  const recipe = await getRecipeById(String(req.params.id))
  if (!recipe) {
    res.status(404).json({ message: 'Receita não encontrada.' })
    return
  }
  res.json({ recipe })
})

// ── Recipes (admin) ─────────────────────────────────────────
const recipeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(400).default(''),
  content: z.string().min(1),
  audience: z.array(z.string()).default([]),
})

app.get('/api/admin/recipes', requireAdminToken, async (_req, res) => {
  res.json({ recipes: await listRecipes() })
})

app.post('/api/admin/recipes', requireAdminToken, async (req, res) => {
  try {
    const payload = recipeSchema.parse(req.body)
    const recipe = await upsertRecipe(payload)
    res.status(201).json({ ok: true, recipe })
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Dados inválidos.' })
  }
})

app.delete('/api/admin/recipes/:id', requireAdminToken, async (req, res) => {
  await removeRecipe(String(req.params.id))
  res.json({ ok: true })
})

// ── Community links (public) ────────────────────────────────
app.get('/api/community-links', async (_req, res) => {
  res.json({ links: await listCommunityLinks() })
})

// ── Community links (admin) ─────────────────────────────────
const communityLinkSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  platform: z.enum(['whatsapp', 'telegram', 'youtube', 'discord', 'other']),
  audience: z.array(z.string()).default([]),
  href: z.string().url(),
})

app.get('/api/admin/community-links', requireAdminToken, async (_req, res) => {
  res.json({ links: await listCommunityLinks() })
})

app.post('/api/admin/community-links', requireAdminToken, async (req, res) => {
  try {
    const payload = communityLinkSchema.parse(req.body)
    const link = await upsertCommunityLink({
      ...payload,
      platform: payload.platform as CommunityPlatform,
    })
    res.status(201).json({ ok: true, link })
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Dados inválidos.' })
  }
})

app.delete('/api/admin/community-links/:id', requireAdminToken, async (req, res) => {
  await removeCommunityLink(String(req.params.id))
  res.json({ ok: true })
})

// ── Admin grants ───────────────────────────────────────────
app.post('/api/admin/access-grants', async (req, res) => {
  try {
    const payload = grantSchema.parse(req.body)
    res.status(201).json({
      grant: { ...payload, createdAt: new Date().toISOString(), mode: 'manual-admin-grant' },
      message: 'Endpoint pronto para sincronizar concessões com Supabase e Stripe.',
    })
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao registrar concessão manual.' })
  }
})

// ── AI: save settings ──────────────────────────────────────
app.post('/api/admin/ai-settings', requireAdminToken, (req, res) => {
  try {
    const payload = aiSettingsSchema.parse(req.body)
    writeFileSync(AI_CONFIG_PATH, JSON.stringify(payload, null, 2), 'utf-8')
    res.json({ ok: true, message: 'Configurações de IA salvas no servidor.' })
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao salvar configurações de IA.' })
  }
})

// ── Stripe: save settings ─────────────────────────────────
app.post('/api/admin/stripe-settings', requireAdminToken, (req, res) => {
  try {
    const payload = stripeSettingsSchema.parse(req.body) satisfies StripeFileConfig
    writeFileSync(STRIPE_CONFIG_PATH, JSON.stringify(payload, null, 2), 'utf-8')
    res.json({ ok: true, message: 'Configurações do Stripe salvas no servidor.' })
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao salvar configurações do Stripe.' })
  }
})

// ── AI: knowledge files ────────────────────────────────────
app.get('/api/admin/knowledge', requireAdminToken, (_req, res) => {
  try {
    if (!existsSync(KNOWLEDGE_DIR)) {
      res.json({ files: [] })
      return
    }
    const manifest = loadManifest()
    const metaByFilename = new Map(manifest.map((e) => [e.filename, e]))

    const files = readdirSync(KNOWLEDGE_DIR)
      .filter((f) => f.endsWith('.txt'))
      .map((filename) => {
        const stat = statSync(resolve(KNOWLEDGE_DIR, filename))
        const meta = metaByFilename.get(filename)
        return {
          filename,
          sizeBytes: stat.size,
          uploadedAt: stat.mtime.toISOString(),
          title: meta?.title ?? '',
          description: meta?.description ?? '',
          topics: meta?.topics ?? [],
        }
      })
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))

    res.json({ files })
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Falha ao listar arquivos.' })
  }
})

app.post('/api/admin/knowledge', requireAdminToken, (req, res, next) => {
  upload.array('files', 20)(req, res, (err) => {
    if (err) {
      res.status(400).json({ message: err.message })
      return
    }
    const uploaded = (req.files as Express.Multer.File[] | undefined) ?? []
    res.status(201).json({
      ok: true,
      uploaded: uploaded.map((f) => ({ filename: f.filename, sizeBytes: f.size })),
    })
  })
})

app.put('/api/admin/knowledge/:filename/meta', requireAdminToken, (req, res) => {
  try {
    const filename = basename(String(req.params.filename))
    if (!filename.endsWith('.txt')) {
      res.status(400).json({ message: 'Somente arquivos .txt são válidos.' })
      return
    }
    if (!existsSync(resolve(KNOWLEDGE_DIR, filename))) {
      res.status(404).json({ message: 'Arquivo não encontrado.' })
      return
    }
    const payload = knowledgeMetaSchema.parse(req.body)
    const entry: KnowledgeEntry = { filename, ...payload }
    upsertManifestEntry(entry)
    res.json({ ok: true, entry })
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao salvar metadados.' })
  }
})

app.delete('/api/admin/knowledge/:filename', requireAdminToken, (req, res) => {
  try {
    const filename = basename(String(req.params.filename))
    if (!filename.endsWith('.txt')) {
      res.status(400).json({ message: 'Somente arquivos .txt podem ser removidos.' })
      return
    }
    const filePath = resolve(KNOWLEDGE_DIR, filename)
    if (!existsSync(filePath)) {
      res.status(404).json({ message: 'Arquivo não encontrado.' })
      return
    }
    unlinkSync(filePath)
    removeManifestEntry(filename)
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Falha ao remover arquivo.' })
  }
})

// ── AI: chat ───────────────────────────────────────────────
app.post('/api/ai/chat', async (req, res) => {
  const aiConfig = getAiConfig()

  if (!aiConfig) {
    res.status(503).json({
      message: 'A IA não está configurada. Configure a chave de API no painel admin.',
    })
    return
  }

  try {
    const payload = chatSchema.parse(req.body)

    // Extract the last user message to route knowledge selection
    const lastUserMessage = [...payload.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
    const knowledgeContent = selectRelevantFiles(lastUserMessage)

    const result = await chat(
      payload.messages as ChatMessage[],
      payload.userProfile as UserProfile | undefined,
      knowledgeContent,
      aiConfig,
    )

    // Save messages to DB if chatId is provided (fire-and-forget)
    if (payload.chatId && payload.userId) {
      const lastMsg = payload.messages[payload.messages.length - 1]
      setImmediate(async () => {
        try {
          await addMessage(payload.chatId!, lastMsg.role as 'user' | 'assistant', lastMsg.content)
          await addMessage(payload.chatId!, 'assistant', result.reply)
        } catch (e) {
          console.error('[Chat Persistence Error]', e)
        }
      })
    }

    // Record token usage asynchronously — never block the response
    setImmediate(() => {
      recordUsage({
        userId: payload.userId ?? 'anonymous',
        userEmail: payload.userEmail ?? 'anonymous',
        date: new Date().toISOString(),
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        provider: aiConfig.provider,
        model: aiConfig.model,
      }).catch(() => { /* non-critical */ })
    })

    res.json({ reply: result.reply })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao processar mensagem.'
    // Do not leak internal error details to the client
    res.status(500).json({ message: 'Não foi possível obter resposta da IA. Tente novamente.' })
    console.error('[AI Chat Error]', msg)
  }
})

// ── Chat CRUD ──────────────────────────────────────────────

app.get('/api/ai/chats', async (req, res) => {
  const userId = req.query.userId as string | undefined
  if (!userId) {
    res.status(400).json({ message: 'userId é obrigatório.' })
    return
  }
  try {
    const chats = await listChats(userId)
    res.json(chats)
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Falha ao listar conversas.' })
  }
})

app.get('/api/ai/chats/:id', async (req, res) => {
  const userId = req.query.userId as string | undefined
  if (!userId) {
    res.status(400).json({ message: 'userId é obrigatório.' })
    return
  }
  try {
    const chat = await getChatWithMessages(req.params.id, userId)
    if (!chat) {
      res.status(404).json({ message: 'Conversa não encontrada.' })
      return
    }
    res.json(chat)
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Falha ao buscar conversa.' })
  }
})

app.post('/api/ai/chats', async (req, res) => {
  const { userId, title } = req.body as { userId?: string; title?: string }
  if (!userId) {
    res.status(400).json({ message: 'userId é obrigatório.' })
    return
  }
  try {
    const chat = await dbCreateChat(userId, title)
    res.status(201).json(chat)
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Falha ao criar conversa.' })
  }
})

app.delete('/api/ai/chats/:id', async (req, res) => {
  const userId = req.query.userId as string | undefined
  if (!userId) {
    res.status(400).json({ message: 'userId é obrigatório.' })
    return
  }
  try {
    await dbDeleteChat(req.params.id, userId)
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Falha ao excluir conversa.' })
  }
})

app.post('/api/ai/chats/:id/title', async (req, res) => {
  const userId = req.body.userId as string | undefined
  if (!userId) {
    res.status(400).json({ message: 'userId é obrigatório.' })
    return
  }

  const aiConfig = getAiConfig()
  if (!aiConfig) {
    res.status(503).json({ message: 'IA não configurada.' })
    return
  }

  try {
    const { firstMessage } = generateTitleSchema.parse(req.body)

    const result = await chat(
      [{ role: 'user', content: `Gere um título curto (máximo 50 caracteres) para esta conversa. Responda APENAS com o título, sem aspas, sem ponto final, sem explicação.\n\nPrimeira mensagem do usuário: "${firstMessage}"` }],
      undefined,
      [],
      aiConfig,
    )

    const title = result.reply.trim().replace(/^["']|["']$/g, '').slice(0, 50)
    await updateChatTitle(req.params.id, userId, title || 'Nova conversa')

    res.json({ title: title || 'Nova conversa' })
  } catch (error) {
    console.error('[Title Generation Error]', error)
    res.json({ title: 'Nova conversa' })
  }
})

// ── Admin: token usage ─────────────────────────────────────
app.get('/api/admin/token-usage', requireAdminToken, async (_req, res) => {
  try {
    const stats = await getUsageStats()
    res.json(stats)
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Falha ao obter estatísticas.' })
  }
})

app.put('/api/admin/token-quota', requireAdminToken, async (req, res) => {
  try {
    const { quota } = tokenQuotaSchema.parse(req.body)
    await setQuota(quota)
    res.json({ ok: true, quota })
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Quota inválida.' })
  }
})

// ── Auth ───────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body)
    const user = await findByEmail(email)

    if (!user || user.password !== password) {
      res.status(401).json({ message: 'E-mail ou senha incorretos.' })
      return
    }

    res.json({
      ok: true,
      userId: user.id,
      email: user.email,
      fullName: user.fullName ?? '',
      planIds: user.planIds,
      planExpiresAt: user.planExpiresAt ?? {},
    })
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Credenciais inválidas.' })
  }
})

// ── Auth: forgot / reset password ─────────────────────────
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body)
    const user = await findByEmail(email)

    // Always return 200 to avoid email enumeration — don't reveal if email exists
    if (!user) {
      res.json({ ok: true, message: 'Se este e-mail estiver cadastrado, você receberá um link em breve.' })
      return
    }

    const token = await createResetToken(email)
    setImmediate(() => {
      sendPasswordResetLink({
        to: user.email,
        fullName: user.fullName || user.email,
        token,
      }).catch(() => { /* already logged inside sendPasswordResetLink */ })
    })

    res.json({ ok: true, message: 'Se este e-mail estiver cadastrado, você receberá um link em breve.' })
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao processar solicitação.' })
  }
})

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body)
    const email = await consumeResetToken(token)

    if (!email) {
      res.status(400).json({ ok: false, message: 'Link inválido ou expirado. Solicite um novo link.' })
      return
    }

    const user = await findByEmail(email)
    if (!user) {
      res.status(404).json({ ok: false, message: 'Usuário não encontrado.' })
      return
    }

    await upsertUser({ id: user.id, email: user.email, password })
    res.json({ ok: true, message: 'Senha redefinida com sucesso. Faça login para continuar.' })
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao redefinir senha.' })
  }
})

// ── Admin: user management ─────────────────────────────────
app.get('/api/admin/users', requireAdminToken, async (_req, res) => {
  try {
    const users = (await listUsers()).map(({ password: _pw, ...rest }) => rest)
    res.json({ users })
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Falha ao listar usuários.' })
  }
})

app.post('/api/admin/users', requireAdminToken, async (req, res) => {
  try {
    const payload = createUserSchema.parse(req.body)
    const allUsers = await listUsers()
    const existing = allUsers.find((u) => u.id === payload.id)

    if (!existing && !payload.password) {
      res.status(400).json({ message: 'Senha obrigatória para novos usuários.' })
      return
    }

    const saved = await upsertUser(payload)
    const { password: _pw, ...safe } = saved
    res.status(201).json({ ok: true, user: safe })
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao salvar usuário.' })
  }
})

app.delete('/api/admin/users/:id', requireAdminToken, async (req, res) => {
  try {
    await removeUser(String(req.params.id))
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Falha ao remover usuário.' })
  }
})

// ── Start ──────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`Viver & Saúde API pronta em http://localhost:${config.port}`)
})
