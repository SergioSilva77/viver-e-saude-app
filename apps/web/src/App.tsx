import { type ReactNode, useEffect, useRef, useState } from 'react'
/** Lightweight markdown → HTML (headings, bold, italic, lists, paragraphs) */
function mdToHtml(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inList = false

  for (const raw of lines) {
    const line = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // inline: bold, italic
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')

    if (/^### /.test(line)) {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(`<h3>${line.slice(4)}</h3>`)
    } else if (/^## /.test(line)) {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(`<h2>${line.slice(3)}</h2>`)
    } else if (/^# /.test(line)) {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(`<h1>${line.slice(2)}</h1>`)
    } else if (/^- /.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true }
      out.push(`<li>${line.slice(2)}</li>`)
    } else if (/^\d+\. /.test(line)) {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(`<li>${line.replace(/^\d+\. /, '')}</li>`)
    } else if (line.trim() === '') {
      if (inList) { out.push('</ul>'); inList = false }
      out.push('<br>')
    } else {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(`<p>${line}</p>`)
    }
  }

  if (inList) out.push('</ul>')
  return out.join('\n')
}
import {
  bottomNavItems,
  getSectionAccessForPlans,
  plans,
  sampleCommunityLinks,
  sampleRecipes,
  sectionRequiredPlan,
  type AppSection,
  type PlanId,
} from '@viver-saude/shared'

type CommunityPlatform = 'whatsapp' | 'telegram' | 'youtube' | 'discord' | 'other'
interface CommunityLink { id: string; title: string; platform: CommunityPlatform; audience: string[]; href: string }

interface RecipeMeta { id: string; title: string; description: string; audience: string[]; updatedAt: string }
interface RecipeFull extends RecipeMeta { content: string }
import { LoginScreen } from './auth/LoginScreen'
import { RegisterScreen } from './auth/RegisterScreen'
import { ResetPasswordScreen } from './auth/ResetPasswordScreen'
import { LinkPlanScreen } from './auth/LinkPlanScreen'
import { MeuGuardiao } from './guardiao/MeuGuardiao'
import { HealthProfileEditor } from './health/HealthProfileEditor'
import { loadHealthProfile, saveHealthProfile, clearHealthProfile, type HealthProfile } from './health/healthProfile'
import { loadSession, saveSession, clearSession, updateSession } from './auth/sessionTypes'
import { clearChats } from './guardiao/chatHistory'
import './App.css'

const planIcons = ['bi-seedling', 'bi-heart-pulse', 'bi-stars']
const planIconClass = ['n1', 'n2', 'n3']

const PLATFORM_ICON: Record<CommunityPlatform, string> = {
  whatsapp: 'bi-whatsapp',
  telegram: 'bi-telegram',
  youtube: 'bi-youtube',
  discord: 'bi-discord',
  other: 'bi-link-45deg',
}
const PLATFORM_LABEL: Record<CommunityPlatform, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  youtube: 'YouTube',
  discord: 'Discord',
  other: 'Link',
}

/**
 * Plan hierarchy: a higher tier covers lower tiers.
 * If the user has nivel3, they implicitly have nivel2 and nivel1.
 */
const PLAN_HIERARCHY: Record<PlanId, PlanId[]> = {
  nivel1: ['nivel1'],
  nivel2: ['nivel1', 'nivel2'],
  nivel3: ['nivel1', 'nivel2', 'nivel3'],
}

function expandPlanHierarchy(activePlans: PlanId[]): Set<PlanId> {
  const expanded = new Set<PlanId>()
  for (const planId of activePlans) {
    for (const covered of PLAN_HIERARCHY[planId] ?? [planId]) {
      expanded.add(covered)
    }
  }
  return expanded
}

/* ─────────────────────────────────────────────────────────────
   Countdown helpers
───────────────────────────────────────────────────────────── */
function formatCountdown(ms: number): string {
  if (ms <= 0) return '0h 0min'
  const totalMin = Math.floor(ms / 60000)
  const hours = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  return `${hours}h ${mins}min`
}

/* ─────────────────────────────────────────────────────────────
   Seção bloqueada
───────────────────────────────────────────────────────────── */
interface LockedSectionProps {
  section: AppSection
  limited?: boolean
  onViewPlans: () => void
  children: ReactNode
}

function LockedSection({ section, limited = false, onViewPlans, children }: LockedSectionProps) {
  const requiredPlan = sectionRequiredPlan[section]
  return (
    <div className="locked-wrapper">
      <div className="locked-blur" aria-hidden="true">{children}</div>
      <div className="locked-overlay">
        <div className="locked-card">
          <div className="locked-lock"><i className="bi bi-lock-fill"></i></div>
          <div className="locked-card-title">
            {limited ? 'Acesso limitado' : 'Conteúdo exclusivo'}
          </div>
          <p className="locked-card-sub">
            {limited
              ? 'Você tem acesso parcial. Assine o Nível 2 para liberar tudo.'
              : `Disponível no ${requiredPlan}. Assine para desbloquear.`}
          </p>
          <button type="button" className="btn-subscribe primary locked-cta" onClick={onViewPlans}>
            Ver planos
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Previews borradas (renderizadas por trás do overlay)
───────────────────────────────────────────────────────────── */
function GuardiaoPreview() {
  return (
    <>
      <h2 className="section-title">MeuGuardião</h2>
      <p className="section-sub">Seu assistente de saúde pessoal</p>
      <div className="section-chat">
        <div className="chat-message ai">Olá! Analisei seu histórico e trouxe orientações personalizadas.</div>
        <div className="chat-message user">Quero melhorar meu sono.</div>
        <div className="chat-message ai">Com base no seu perfil, recomendo evitar cafeína após as 14h.</div>
        <div className="chat-message user">E para reduzir inflamação?</div>
        <div className="chat-message ai">Açafrão e gengibre são aliados potentes.</div>
      </div>
      <div className="chat-input-area">
        <div className="chat-input">Digite sua mensagem...</div>
        <div className="chat-send-btn"><i className="bi bi-send-fill"></i></div>
      </div>
    </>
  )
}

function ReceitasPreview() {
  return (
    <>
      <h2 className="section-title">Receitas</h2>
      <p className="section-sub">Protocolos e e-books naturais</p>
      <div className="cards-list">
        {sampleRecipes.map((recipe) => (
          <div className="content-card" key={recipe.id}>
            <div className="content-card-icon">
              <i className={`bi ${recipe.assetType === 'ebook' ? 'bi-book' : recipe.assetType === 'protocol' ? 'bi-clipboard2-heart' : 'bi-cup-hot'}`}></i>
            </div>
            <div className="content-card-body">
              <div className="content-card-title">{recipe.title}</div>
              <div className="content-card-sub">{recipe.category}</div>
            </div>
            <i className="bi bi-chevron-right content-card-arrow"></i>
          </div>
        ))}
        {['Detox matinal', 'Suco anti-inflamatório', 'Protocolo digestivo'].map((t) => (
          <div className="content-card" key={t}>
            <div className="content-card-icon"><i className="bi bi-cup-hot"></i></div>
            <div className="content-card-body">
              <div className="content-card-title">{t}</div>
              <div className="content-card-sub">Receita natural</div>
            </div>
            <i className="bi bi-chevron-right content-card-arrow"></i>
          </div>
        ))}
      </div>
    </>
  )
}

function ComunidadePreview() {
  return (
    <>
      <h2 className="section-title">Comunidade</h2>
      <p className="section-sub">Grupos exclusivos por plano</p>
      <div className="cards-list">
        {sampleCommunityLinks.map((link) => (
          <div className="content-card" key={link.id}>
            <div className="content-card-icon">
              <i className={`bi ${link.platform === 'whatsapp' ? 'bi-whatsapp' : 'bi-telegram'}`}></i>
            </div>
            <div className="content-card-body">
              <div className="content-card-title">{link.title}</div>
              <div className="content-card-sub">{link.platform}</div>
            </div>
            <i className="bi bi-chevron-right content-card-arrow"></i>
          </div>
        ))}
      </div>
    </>
  )
}

function RecipeDetail({ recipe, onBack }: { recipe: RecipeFull; onBack: () => void }) {
  const html = mdToHtml(recipe.content)
  return (
    <div className="recipe-detail">
      <button type="button" className="recipe-back-btn" onClick={onBack}>
        <i className="bi bi-arrow-left" /> Voltar
      </button>
      <h2 className="recipe-detail-title">{recipe.title}</h2>
      {recipe.description && <p className="recipe-detail-sub">{recipe.description}</p>}
      <div className="recipe-detail-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

function ContaPreview() {
  return (
    <>
      <div className="profile-avatar"><i className="bi bi-person-fill"></i></div>
      <div className="profile-name">Meu Perfil</div>
      <div className="profile-plan">Sem plano ativo</div>
      <ul className="menu-list">
        {[
          { icon: 'bi-person', label: 'Dados pessoais' },
          { icon: 'bi-heart', label: 'Saúde e histórico familiar' },
          { icon: 'bi-credit-card', label: 'Histórico de pagamentos' },
          { icon: 'bi-arrow-up-circle', label: 'Fazer upgrade de plano' },
        ].map((item) => (
          <li key={item.label}>
            <div className="menu-item">
              <div className="menu-item-icon"><i className={`bi ${item.icon}`}></i></div>
              <span className="menu-item-label">{item.label}</span>
              <i className="bi bi-chevron-right menu-item-chevron"></i>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

/* ─────────────────────────────────────────────────────────────
   Botão de consultor (uso único para Nível 1)
───────────────────────────────────────────────────────────── */
interface ConsultorCardProps {
  used: boolean
  onUse: () => void
}

function ConsultorCard({ used, onUse }: ConsultorCardProps) {
  function handleClick() {
    if (used) return
    const confirmed = confirm(
      'Você tem direito a 1 sessão gratuita de 30 min com nosso consultor.\n\nAo confirmar, este benefício será marcado como utilizado e não poderá ser usado novamente.\n\nDeseja prosseguir?'
    )
    if (!confirmed) return
    onUse()
    window.open('https://wa.me/5500000000000?text=Olá!%20Quero%20agendar%20minha%20sessão%20gratuita.', '_blank')
  }

  return (
    <div className={`consultor-card ${used ? 'consultor-card-used' : 'consultor-card-available'}`}>
      <div className="consultor-card-icon">
        <i className={`bi ${used ? 'bi-check-circle-fill' : 'bi-headset'}`}></i>
      </div>
      <div className="consultor-card-body">
        <div className="consultor-card-title">
          {used ? 'Sessão com consultor utilizada' : '30 min grátis com consultor'}
        </div>
        <div className="consultor-card-sub">
          {used
            ? 'Você já utilizou este benefício exclusivo do Nível 1.'
            : 'Benefício exclusivo do Nível 1 — use uma única vez.'}
        </div>
      </div>
      {!used && (
        <button type="button" className="btn-consultor-cta" onClick={handleClick}>
          Agendar
        </button>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   App principal
───────────────────────────────────────────────────────────── */
type AuthState = 'checking' | 'unauthenticated' | 'authenticated'

function App() {
  const [authState, setAuthState] = useState<AuthState>('checking')
  const [activePlans, setActivePlans] = useState<PlanId[]>([])
  const [activeSection, setActiveSection] = useState<AppSection>('inicio')
  const [sessionUserId, setSessionUserId] = useState<string | undefined>(undefined)
  const [sessionUserEmail, setSessionUserEmail] = useState<string | undefined>(undefined)
  const [sessionUserName, setSessionUserName] = useState<string>('')

  // 24h MeuGuardião unlock state
  const [guardiao24hUntil, setGuardiao24hUntil] = useState<number | null>(null)
  const [guardiao24hRemaining, setGuardiao24hRemaining] = useState<number>(0)

  // Consultant one-time use
  const [consultantUsed, setConsultantUsed] = useState(false)

  // Health profile — loaded per user after login
  const [healthProfile, setHealthProfile] = useState<HealthProfile>(() => loadHealthProfile(undefined))
  const [showHealthEditor, setShowHealthEditor] = useState(false)

  // Cancel subscription modal
  const [cancelModal, setCancelModal] = useState<{ planId: PlanId; planLabel: string } | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelResult, setCancelResult] = useState<Record<string, string>>({}) // planId → ISO cancelAt date

  // Checkout
  const [checkoutLoading, setCheckoutLoading] = useState<PlanId | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  // Post-payment registration detection (set via ?checkout=success&session_id=xxx in URL)
  const [checkoutSession, setCheckoutSession] = useState<{ sessionId: string; planId: string } | null>(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') !== 'success') return null
    const sessionId = params.get('session_id') ?? ''
    const planId = params.get('plan') ?? 'nivel1'
    return sessionId ? { sessionId, planId } : null
  })

  // Password reset detection (set via ?reset=TOKEN in URL)
  const [resetToken, setResetToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('reset') ?? null
  })

  // Shown on LoginScreen after registration completes
  const [registrationSuccessEmail, setRegistrationSuccessEmail] = useState<string | null>(null)

  // Pre-flight: is Stripe configured on the backend? null = checking
  const [stripeReady, setStripeReady] = useState<boolean | null>(null)

  // Community links fetched from API
  const [communityLinks, setCommunityLinks] = useState<CommunityLink[]>([])

  // Recipes fetched from API
  const [recipesMeta, setRecipesMeta] = useState<RecipeMeta[]>([])
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeFull | null>(null)
  const [recipeLoading, setRecipeLoading] = useState(false)

  // Confirm dialog ref (for consultant)
  const consultorConfirmedRef = useRef(false)

  // Pre-flight check Stripe availability once on mount.
  // This is a defense layer — disables Assinar buttons if the backend reports Stripe is not configured.
  useEffect(() => {
    let cancelled = false
    fetch('/api/health')
      .then((r) => r.json())
      .then((data: { stripeConfigured?: boolean }) => {
        if (!cancelled) setStripeReady(Boolean(data.stripeConfigured))
      })
      .catch(() => {
        if (!cancelled) setStripeReady(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Fetch community links from backend
  useEffect(() => {
    fetch('/api/community-links')
      .then((r) => r.json())
      .then((data: { links?: CommunityLink[] }) => {
        if (data.links) setCommunityLinks(data.links)
      })
      .catch(() => { /* silently fall back to empty list */ })
  }, [])

  // Fetch recipe list from backend
  useEffect(() => {
    fetch('/api/recipes')
      .then((r) => r.json())
      .then((data: { recipes?: RecipeMeta[] }) => {
        if (data.recipes) setRecipesMeta(data.recipes)
      })
      .catch(() => { /* silently fall back to empty list */ })
  }, [])

  useEffect(() => {
    // Clear checkout/reset URL params after reading them (keep state in React)
    if (window.location.search.includes('checkout=') || window.location.search.includes('reset=')) {
      window.history.replaceState({}, '', window.location.pathname)
    }

    const session = loadSession()
    if (session) {
      // Filter out expired plans
      const now = Date.now()
      const validPlans = session.planIds.filter((pid) => {
        const expiry = session.planExpiresAt?.[pid]
        return !expiry || expiry > now
      }) as PlanId[]

      setActivePlans(validPlans)
      setGuardiao24hUntil(session.guardiao24hUnlockedUntil ?? null)
      setConsultantUsed(session.consultantUsed ?? false)
      setSessionUserId(session.userId)
      setSessionUserEmail(session.email)
      setSessionUserName(session.fullName ?? '')
      setAuthState('authenticated')
    } else {
      setAuthState('unauthenticated')
    }
  }, [])

  // Reload health profile when the logged-in user changes
  useEffect(() => {
    setHealthProfile(loadHealthProfile(sessionUserId))
  }, [sessionUserId])

  // Periodic session expiration check — forces logout if session expired while app is open
  useEffect(() => {
    if (authState !== 'authenticated') return
    function checkExpiration() {
      const current = loadSession()
      if (!current) {
        // Session was cleared or expired — force logout
        setSessionUserId(undefined)
        setSessionUserEmail(undefined)
        setSessionUserName('')
        setActivePlans([])
        setAuthState('unauthenticated')
      }
    }
    checkExpiration()
    const id = setInterval(checkExpiration, 60_000)
    return () => clearInterval(id)
  }, [authState])

  // Countdown ticker for 24h MeuGuardião unlock
  useEffect(() => {
    if (!guardiao24hUntil) return
    function tick() {
      const remaining = (guardiao24hUntil ?? 0) - Date.now()
      setGuardiao24hRemaining(Math.max(0, remaining))
    }
    tick()
    const id = setInterval(tick, 60000) // update every minute
    return () => clearInterval(id)
  }, [guardiao24hUntil])

  async function handleSubscribe(planId: PlanId, userData?: { fullName: string; email: string }) {
    setCheckoutError(null)

    // Layer 4: client-side guard — refuse if Stripe is known not configured.
    if (stripeReady === false) {
      setCheckoutError('Pagamentos indisponíveis no momento. Tente novamente mais tarde.')
      return
    }

    const email = userData?.email ?? sessionUserEmail
    const fullName = userData?.fullName

    setCheckoutLoading(planId)
    try {
      const res = await fetch('/api/billing/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          ...(email ? { email } : {}),
          ...(fullName ? { fullName } : {}),
        }),
      })
      const data = await res.json() as { ok?: boolean; url?: string; message?: string; code?: string }
      if (!res.ok || !data.url) {
        setCheckoutError(data.message ?? 'Não foi possível iniciar o checkout.')
        return
      }
      window.location.href = data.url
    } catch {
      setCheckoutError('Não foi possível conectar ao servidor. Tente novamente.')
    } finally {
      setCheckoutLoading(null)
    }
  }

  function handleConsultorUse() {
    consultorConfirmedRef.current = true
    setConsultantUsed(true)
    updateSession({ consultantUsed: true })
  }

  async function handleCancelSubscription(planId: PlanId) {
    if (!sessionUserId) return
    setCancelLoading(true)
    try {
      const res = await fetch('/api/billing/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: sessionUserId, planId }),
      })
      const data = await res.json() as { ok?: boolean; cancelAt?: string; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? 'Falha ao cancelar.')
      setCancelResult((prev) => ({ ...prev, [planId]: data.cancelAt! }))
      setCancelModal(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao cancelar assinatura.')
    } finally {
      setCancelLoading(false)
    }
  }

  if (authState === 'checking') {
    return (
      <div className="auth-splash">
        <div className="auth-splash-logo"><i className="bi bi-heart-pulse-fill" /></div>
        <div className="auth-splash-spinner" />
      </div>
    )
  }

  // Password reset screen — token from ?reset=TOKEN in URL
  if (resetToken) {
    return (
      <ResetPasswordScreen
        token={resetToken}
        onSuccess={() => {
          setResetToken(null)
        }}
        onBack={() => setResetToken(null)}
      />
    )
  }

  // Post-payment flow — two cases depending on auth state:
  // 1. Already authenticated → silently link the new plan, no registration needed.
  // 2. Not authenticated → show RegisterScreen to create account with email + password.
  if (checkoutSession) {
    if (authState === 'authenticated' && sessionUserId) {
      return (
        <LinkPlanScreen
          sessionId={checkoutSession.sessionId}
          userId={sessionUserId}
          onLinked={(planIds, planExpiresAt) => {
            setCheckoutSession(null)
            setActivePlans(planIds as PlanId[])
            // Persist updated plan info to local session
            const session = loadSession()
            if (session) {
              saveSession({ ...session, planIds: planIds as PlanId[], planExpiresAt })
            }
            setActiveSection('inicio')
          }}
          onBack={() => setCheckoutSession(null)}
        />
      )
    }

    return (
      <RegisterScreen
        sessionId={checkoutSession.sessionId}
        planId={checkoutSession.planId}
        onRegistered={(email) => {
          // Registration done — clear checkout state and go to login.
          // The user must sign in with the credentials they just created.
          setCheckoutSession(null)
          setRegistrationSuccessEmail(email)
        }}
        onBack={() => setCheckoutSession(null)}
      />
    )
  }

  if (authState === 'unauthenticated') {
    return (
      <LoginScreen
        onLogin={(planIds) => {
          setRegistrationSuccessEmail(null)
          setActivePlans(planIds)
          const session = loadSession()
          if (session) {
            setSessionUserId(session.userId)
            setSessionUserEmail(session.email)
            setSessionUserName(session.fullName ?? '')
          }
          setGuardiao24hUntil(session?.guardiao24hUnlockedUntil ?? null)
          setConsultantUsed(session?.consultantUsed ?? false)
          setAuthState('authenticated')
        }}
        onSubscribe={async (planId, userData) => {
          // Layer 4: client-side guard — refuse to call API if Stripe isn't known to be ready.
          // This makes bypass impossible even if backend has a bug.
          if (stripeReady === false) {
            throw new Error('Pagamentos indisponíveis no momento. Tente novamente mais tarde.')
          }
          const res = await fetch('/api/billing/checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              planId,
              ...(userData?.email ? { email: userData.email } : {}),
              ...(userData?.fullName ? { fullName: userData.fullName } : {}),
            }),
          })
          const data = await res.json() as { ok?: boolean; url?: string; message?: string; code?: string }
          if (!res.ok || !data.url) {
            // Surface the real backend message (instead of a generic one)
            throw new Error(data.message ?? 'Erro ao iniciar checkout.')
          }
          // Integrity assertion: must have a Stripe URL to navigate to. No silent grant.
          window.location.href = data.url
        }}
        successMessage={
          registrationSuccessEmail
            ? 'Cadastro realizado! Faça login para acessar seu plano.'
            : undefined
        }
        prefilledEmail={registrationSuccessEmail ?? undefined}
        stripeReady={stripeReady}
      />
    )
  }

  // Resolve if guardiao is in 24h unlock window
  const guardiao24hActive = guardiao24hUntil !== null && guardiao24hUntil > Date.now()

  // Compute access for current section
  function resolveAccess(section: AppSection) {
    // Special case: nivel1 user within 24h window gets full guardiao access
    if (section === 'meuguardiao' && guardiao24hActive) return 'free' as const
    return getSectionAccessForPlans(activePlans, section)
  }

  const access = resolveAccess(activeSection)
  const isLocked = access === 'locked'
  const isLimited = access === 'limited'

  const goToPlans = () => setActiveSection('inicio')

  async function handleLogout() {
    // Clear user-scoped local data before clearing the session
    clearChats(sessionUserId)
    clearHealthProfile(sessionUserId)
    clearSession()
    setHealthProfile(loadHealthProfile(undefined))
    setSessionUserId(undefined)
    setSessionUserEmail(undefined)
    setSessionUserName('')
    setActivePlans([])
    setAuthState('unauthenticated')
  }

  const isNivel1Only = activePlans.includes('nivel1') && !activePlans.includes('nivel2') && !activePlans.includes('nivel3')
  const planLabel = activePlans.length > 0
    ? activePlans.map((id) => `Nível ${id.replace('nivel', '')}`).join(' + ') + ' ativo'
    : 'Sem plano ativo'

  return (
    <div className="app-shell">
      {/* ── Topo ──────────────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-brand">
          <div className="topbar-logo"><i className="bi bi-heart-pulse-fill"></i></div>
          <span className="topbar-name">Viver &amp; Saúde</span>
        </div>
        <button type="button" className="topbar-bell" aria-label="Notificações">
          <i className="bi bi-bell"></i>
        </button>
      </header>

      {/* ── Conteúdo ──────────────────────────────────────── */}
      <div className="scroll-area">

        {/* ── Folhas decorativas (home) ────────────────────── */}
        {activeSection === 'inicio' && (
          <div className="botanical-bg" aria-hidden="true">
            {/* Monstera — canto inferior direito */}
            <svg className="botanical-leaf leaf-monstera" viewBox="0 0 200 220" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M100 10 C60 30 20 70 15 120 C10 160 30 190 60 200 C70 203 80 200 85 195
                       C80 170 70 150 55 140 C45 133 42 125 48 115 C54 105 70 100 85 95
                       C75 80 60 65 55 45 C50 30 65 15 100 10Z"
                    fill="currentColor"/>
              <path d="M100 10 C140 30 180 70 185 120 C190 160 170 190 140 200 C130 203 120 200 115 195
                       C120 170 130 150 145 140 C155 133 158 125 152 115 C146 105 130 100 115 95
                       C125 80 140 65 145 45 C150 30 135 15 100 10Z"
                    fill="currentColor" opacity="0.7"/>
              <path d="M100 10 L100 200" stroke="currentColor" strokeWidth="2" opacity="0.4"/>
            </svg>

            {/* Samambaia — canto superior esquerdo */}
            <svg className="botanical-leaf leaf-fern" viewBox="0 0 160 260" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M80 250 L80 20" stroke="currentColor" strokeWidth="2.5" opacity="0.5"/>
              {/* folhas esquerda */}
              <path d="M80 40 C60 35 30 40 15 55 C25 50 45 42 80 40Z" fill="currentColor" opacity="0.8"/>
              <path d="M80 70 C55 62 20 68 5 90 C20 80 50 68 80 70Z" fill="currentColor" opacity="0.7"/>
              <path d="M80 100 C50 90 15 98 0 125 C18 112 50 96 80 100Z" fill="currentColor" opacity="0.6"/>
              <path d="M80 130 C55 120 20 130 5 155 C22 142 52 126 80 130Z" fill="currentColor" opacity="0.5"/>
              <path d="M80 160 C58 152 28 160 15 180 C30 170 56 156 80 160Z" fill="currentColor" opacity="0.4"/>
              {/* folhas direita */}
              <path d="M80 40 C100 35 130 40 145 55 C135 50 115 42 80 40Z" fill="currentColor" opacity="0.8"/>
              <path d="M80 70 C105 62 140 68 155 90 C140 80 110 68 80 70Z" fill="currentColor" opacity="0.7"/>
              <path d="M80 100 C110 90 145 98 160 125 C142 112 110 96 80 100Z" fill="currentColor" opacity="0.6"/>
              <path d="M80 130 C105 120 140 130 155 155 C138 142 108 126 80 130Z" fill="currentColor" opacity="0.5"/>
              <path d="M80 160 C102 152 132 160 145 180 C130 170 104 156 80 160Z" fill="currentColor" opacity="0.4"/>
            </svg>

            {/* Eucalipto pequeno — meio superior */}
            <svg className="botanical-leaf leaf-eucalyptus" viewBox="0 0 80 180" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M40 170 L40 10" stroke="currentColor" strokeWidth="1.8" opacity="0.4"/>
              <ellipse cx="25" cy="35" rx="18" ry="10" transform="rotate(-30 25 35)" fill="currentColor" opacity="0.6"/>
              <ellipse cx="55" cy="55" rx="18" ry="10" transform="rotate(30 55 55)" fill="currentColor" opacity="0.55"/>
              <ellipse cx="22" cy="80" rx="16" ry="9" transform="rotate(-25 22 80)" fill="currentColor" opacity="0.5"/>
              <ellipse cx="58" cy="105" rx="16" ry="9" transform="rotate(25 58 105)" fill="currentColor" opacity="0.45"/>
              <ellipse cx="25" cy="130" rx="14" ry="8" transform="rotate(-20 25 130)" fill="currentColor" opacity="0.4"/>
              <ellipse cx="55" cy="150" rx="14" ry="8" transform="rotate(20 55 150)" fill="currentColor" opacity="0.35"/>
            </svg>

            {/* Palmeira sutil — canto inferior esquerdo */}
            <svg className="botanical-leaf leaf-palm" viewBox="0 0 180 160" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M90 155 C90 100 85 60 50 20 C70 55 80 90 85 120" fill="currentColor" opacity="0.5"/>
              <path d="M90 155 C90 100 95 60 130 20 C110 55 100 90 95 120" fill="currentColor" opacity="0.45"/>
              <path d="M90 155 C70 110 40 85 10 70 C35 85 65 100 85 130" fill="currentColor" opacity="0.35"/>
              <path d="M90 155 C110 110 140 85 170 70 C145 85 115 100 95 130" fill="currentColor" opacity="0.3"/>
            </svg>
          </div>
        )}

        {/* INÍCIO */}
        {activeSection === 'inicio' && (() => {
          const effectivePlans = expandPlanHierarchy(activePlans)
          const allPlansCovered = plans.every((p) => effectivePlans.has(p.id))
          return (
            <>
              <div>
                <h2 className="section-title">
                  {allPlansCovered ? 'Sua jornada começa aqui' : 'Escolha seu plano'}
                </h2>
                <p className="section-sub">
                  {allPlansCovered
                    ? 'Você já tem acesso a todos os recursos disponíveis.'
                    : 'Comece sua jornada de saúde hoje'}
                </p>
              </div>
              {stripeReady === false && !allPlansCovered && (
                <div className="stripe-unavailable-banner">
                  <i className="bi bi-credit-card-2-front" />
                  <div>
                    <strong>Pagamentos indisponíveis</strong>
                    <p>O sistema de pagamentos está em manutenção. Tente novamente em alguns minutos.</p>
                  </div>
                </div>
              )}
              {checkoutError && (
                <div className="checkout-error-banner">
                  <i className="bi bi-exclamation-triangle-fill" />
                  {checkoutError}
                </div>
              )}
              <div className="plans-list">
                {plans.map((plan, index) => {
                  const isActive = effectivePlans.has(plan.id)
                  const expiryIso = sessionUserId
                    ? loadSession()?.planExpiresAt?.[plan.id]
                    : undefined
                  return (
                    <div key={plan.id} className={`plan-card ${index === 1 ? 'featured' : ''} ${isActive ? 'plan-card-active' : ''}`}>
                      {index === 1 && !isActive && <span className="plan-featured-badge">mais popular</span>}
                      {isActive && (
                        <span className="plan-active-badge">
                          <i className="bi bi-check-circle-fill" />
                          Plano ativo
                        </span>
                      )}
                      <div className="plan-card-top">
                        <div className={`plan-icon ${planIconClass[index]}`}>
                          <i className={`bi ${planIcons[index]}`}></i>
                        </div>
                        <div className="plan-meta">
                          <div className="plan-name">{plan.label}</div>
                          <div className="plan-price">
                            <span className="plan-price-currency">R$</span>
                            <span className="plan-price-value">
                              {(plan.priceInCents / 100).toFixed(2).replace('.', ',')}
                            </span>
                            {plan.billingInterval === 'monthly' && (
                              <span className="plan-price-period">/mês</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ul className="plan-benefits">
                        {plan.benefits.map((benefit) => (
                          <li key={benefit}>
                            <i className="bi bi-check2"></i>
                            {benefit}
                          </li>
                        ))}
                      </ul>
                      {isActive ? (
                        <div className={`plan-active-footer ${cancelResult[plan.id] ? 'plan-active-footer-cancelled' : ''}`}>
                          {cancelResult[plan.id] ? (
                            <>
                              <i className="bi bi-clock-history" />
                              Cancelamento agendado — ativo até{' '}
                              <strong>{new Date(cancelResult[plan.id]).toLocaleDateString('pt-BR')}</strong>
                            </>
                          ) : expiryIso ? (
                            <>Renovação: <strong>{new Date(typeof expiryIso === 'number' ? expiryIso : Date.parse(String(expiryIso))).toLocaleDateString('pt-BR')}</strong></>
                          ) : (
                            'Acesso vitalício'
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={`btn-subscribe ${index === 1 ? 'primary' : 'outline'}`}
                          disabled={checkoutLoading !== null || stripeReady === false}
                          onClick={() => handleSubscribe(plan.id)}
                        >
                          {checkoutLoading === plan.id ? (
                            <><span className="btn-spinner" /> Aguarde...</>
                          ) : (
                            <>Assinar {index === 0 ? 'agora' : 'plano'}</>
                          )}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )
        })()}

        {/* MEU GUARDIÃO */}
        {activeSection === 'meuguardiao' && (
          isLocked ? (
            <LockedSection section="meuguardiao" onViewPlans={goToPlans}>
              <GuardiaoPreview />
            </LockedSection>
          ) : (
            <>
              {/* Banner de 24h para Nível 1 */}
              {guardiao24hActive && isNivel1Only && (
                <div className="guardiao-24h-banner">
                  <i className="bi bi-clock-history"></i>
                  <div>
                    <strong>Acesso completo por mais {formatCountdown(guardiao24hRemaining)}</strong>
                    <span>Após este período, o acesso ao MeuGuardião ficará limitado. Assine o Nível 2 para acesso permanente.</span>
                  </div>
                </div>
              )}

              {/* Aviso de acesso limitado (após expirar 24h, nivel1 sem upgrade) */}
              {isLimited && !guardiao24hActive && (
                <div className="guardiao-limited-banner">
                  <i className="bi bi-info-circle"></i>
                  <div>
                    <strong>Acesso limitado</strong>
                    <span>Você é do Nível 1. Assine o Nível 2 para acesso completo e permanente ao MeuGuardião.</span>
                  </div>
                  <button type="button" className="btn-upgrade-mini" onClick={goToPlans}>
                    Ver planos
                  </button>
                </div>
              )}

              {/* Botão de consultor — só aparece para nivel1 */}
              {isNivel1Only && (
                <ConsultorCard used={consultantUsed} onUse={handleConsultorUse} />
              )}

              <MeuGuardiao
                userId={sessionUserId}
                userEmail={sessionUserEmail}
                userProfile={{
                  name: healthProfile.name || undefined,
                  age: typeof healthProfile.age === 'number' ? healthProfile.age : undefined,
                  weightKg: typeof healthProfile.weightKg === 'number' ? healthProfile.weightKg : undefined,
                  heightCm: typeof healthProfile.heightCm === 'number' ? healthProfile.heightCm : undefined,
                  bloodType: healthProfile.bloodType || undefined,
                  goals: healthProfile.goals.length > 0 ? healthProfile.goals : undefined,
                  familyHistory: healthProfile.familyHistory.length > 0
                    ? healthProfile.familyHistory.map((e) => ({ relation: e.relation, notes: e.notes }))
                    : undefined,
                }}
                guardiao24hUntil={guardiao24hUntil}
                onViewPlans={goToPlans}
              />
            </>
          )
        )}

        {/* RECEITAS */}
        {activeSection === 'receitas' && (
          isLocked ? (
            <LockedSection section="receitas" onViewPlans={goToPlans}>
              <ReceitasPreview />
            </LockedSection>
          ) : selectedRecipe ? (
            <RecipeDetail
              recipe={selectedRecipe}
              onBack={() => setSelectedRecipe(null)}
            />
          ) : (() => {
            const expanded = expandPlanHierarchy(activePlans)
            const visibleRecipes = recipesMeta.filter(
              (r) => r.audience.length === 0 || r.audience.some((a) => expanded.has(a as PlanId)),
            )
            async function openRecipe(id: string) {
              setRecipeLoading(true)
              try {
                const res = await fetch(`/api/recipes/${id}`)
                const data = await res.json() as { recipe?: RecipeFull }
                if (data.recipe) setSelectedRecipe(data.recipe)
              } finally {
                setRecipeLoading(false)
              }
            }
            return (
              <>
                <div>
                  <h2 className="section-title">Receitas</h2>
                  <p className="section-sub">Protocolos e e-books naturais</p>
                </div>
                <div className="cards-list">
                  {visibleRecipes.length === 0 && (
                    <p className="community-empty">Nenhuma receita disponível para o seu plano no momento.</p>
                  )}
                  {recipeLoading && <p className="community-empty">Carregando…</p>}
                  {visibleRecipes.map((recipe) => (
                    <button
                      type="button"
                      className="content-card"
                      key={recipe.id}
                      onClick={() => openRecipe(recipe.id)}
                    >
                      <div className="content-card-icon">
                        <i className="bi bi-journal-medical"></i>
                      </div>
                      <div className="content-card-body">
                        <div className="content-card-title">{recipe.title}</div>
                        {recipe.description && (
                          <div className="content-card-sub">{recipe.description}</div>
                        )}
                      </div>
                      <i className="bi bi-chevron-right content-card-arrow"></i>
                    </button>
                  ))}
                </div>
              </>
            )
          })()
        )}

        {/* COMUNIDADE */}
        {activeSection === 'comunidade' && (
          isLocked ? (
            <LockedSection section="comunidade" onViewPlans={goToPlans}>
              <ComunidadePreview />
            </LockedSection>
          ) : (() => {
            const expanded = expandPlanHierarchy(activePlans)
            const visibleLinks = communityLinks.filter(
              (link) => link.audience.length === 0 || link.audience.some((a) => expanded.has(a as PlanId)),
            )
            return (
              <>
                <div>
                  <h2 className="section-title">Comunidade</h2>
                  <p className="section-sub">Grupos exclusivos por plano</p>
                </div>
                <div className="cards-list">
                  {visibleLinks.length === 0 && (
                    <p className="community-empty">Nenhum grupo disponível para o seu plano no momento.</p>
                  )}
                  {visibleLinks.map((link) => (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="content-card"
                      key={link.id}
                    >
                      <div className="content-card-icon">
                        <i className={`bi ${PLATFORM_ICON[link.platform] ?? 'bi-link-45deg'}`}></i>
                      </div>
                      <div className="content-card-body">
                        <div className="content-card-title">{link.title}</div>
                        <div className="content-card-sub">{PLATFORM_LABEL[link.platform] ?? link.platform}</div>
                      </div>
                      <i className="bi bi-chevron-right content-card-arrow"></i>
                    </a>
                  ))}
                </div>
              </>
            )
          })()
        )}

        {/* CONTA */}
        {activeSection === 'conta' && (
          isLocked ? (
            <LockedSection section="conta" onViewPlans={goToPlans}>
              <ContaPreview />
            </LockedSection>
          ) : (
            <>
              <div>
                <div className="profile-avatar"><i className="bi bi-person-fill"></i></div>
                <div className="profile-name">{sessionUserName || 'Meu Perfil'}</div>
                {sessionUserEmail && (
                  <div className="profile-email">{sessionUserEmail}</div>
                )}
                <div className="profile-plan">{planLabel}</div>
              </div>
              <ul className="menu-list">
                {[
                  { icon: 'bi-person', label: 'Dados pessoais', action: () => setShowHealthEditor(true) },
                  { icon: 'bi-heart', label: 'Saúde e histórico familiar', action: () => setShowHealthEditor(true) },
                  { icon: 'bi-credit-card', label: 'Histórico de pagamentos', action: undefined as (() => void) | undefined },
                  { icon: 'bi-arrow-up-circle', label: 'Fazer upgrade de plano', action: goToPlans },
                  { icon: 'bi-x-circle', label: 'Cancelar assinatura', action: (() => {
                    const monthlyPlan = activePlans.find((pid) => plans.find((p) => p.id === pid)?.billingInterval === 'monthly')
                    // nivel1 is one_time — no subscription to cancel
                    if (!monthlyPlan) {
                      if (activePlans.length > 0) {
                        return () => alert('Seu plano atual é de pagamento único e não possui assinatura recorrente para cancelar.')
                      }
                      return undefined
                    }
                    return () => {
                      const label = plans.find((p) => p.id === monthlyPlan)?.label ?? monthlyPlan
                      setCancelModal({ planId: monthlyPlan as PlanId, planLabel: label })
                    }
                  })() },
                  { icon: 'bi-box-arrow-right', label: 'Sair', action: handleLogout },
                ].map((item) => (
                  <li key={item.label}>
                    <button type="button" className="menu-item" onClick={item.action}>
                      <div className="menu-item-icon"><i className={`bi ${item.icon}`}></i></div>
                      <span className="menu-item-label">{item.label}</span>
                      <i className="bi bi-chevron-right menu-item-chevron"></i>
                    </button>
                  </li>
                ))}
              </ul>

              {/* Resumo de saúde — mostra dados reais */}
              <div>
                <div className="health-summary-header">
                  <h3 className="section-title" style={{ fontSize: '1rem', marginBottom: 0 }}>
                    Dados de saúde
                  </h3>
                  <button
                    type="button"
                    className="btn-edit-health"
                    onClick={() => setShowHealthEditor(true)}
                  >
                    <i className="bi bi-pencil-fill" />
                    Editar
                  </button>
                </div>

                {healthProfile.age === '' && healthProfile.weightKg === '' && !healthProfile.bloodType ? (
                  <button
                    type="button"
                    className="health-empty-card"
                    onClick={() => setShowHealthEditor(true)}
                  >
                    <i className="bi bi-heart-pulse" />
                    <div>
                      <div className="health-empty-card-title">Perfil de saúde incompleto</div>
                      <div className="health-empty-card-sub">Toque para adicionar suas informações. O MeuGuardião usará esses dados para personalizar as orientações.</div>
                    </div>
                    <i className="bi bi-chevron-right" style={{ color: '#aac8bc', flexShrink: 0 }} />
                  </button>
                ) : (
                  <div className="cards-list" style={{ marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      className="content-card"
                      onClick={() => setShowHealthEditor(true)}
                    >
                      <div className="content-card-icon"><i className="bi bi-person-vcard"></i></div>
                      <div className="content-card-body">
                        <div className="content-card-title">
                          {[
                            healthProfile.age !== '' ? `${healthProfile.age} anos` : null,
                            healthProfile.weightKg !== '' ? `${healthProfile.weightKg} kg` : null,
                            healthProfile.heightCm !== '' ? `${healthProfile.heightCm} cm` : null,
                          ].filter(Boolean).join(' · ') || 'Medidas não informadas'}
                        </div>
                        <div className="content-card-sub">
                          {[
                            healthProfile.bloodType ? `Tipo ${healthProfile.bloodType}` : null,
                            healthProfile.gender ? healthProfile.gender.charAt(0).toUpperCase() + healthProfile.gender.slice(1) : null,
                          ].filter(Boolean).join(' · ') || 'Tipo sanguíneo não informado'}
                        </div>
                      </div>
                      <i className="bi bi-chevron-right content-card-arrow"></i>
                    </button>

                    {healthProfile.goals.length > 0 && (
                      <button
                        type="button"
                        className="content-card"
                        onClick={() => setShowHealthEditor(true)}
                      >
                        <div className="content-card-icon"><i className="bi bi-bullseye"></i></div>
                        <div className="content-card-body">
                          <div className="content-card-title">Objetivos</div>
                          <div className="content-card-sub">{healthProfile.goals.slice(0, 2).join(', ')}{healthProfile.goals.length > 2 ? ` +${healthProfile.goals.length - 2}` : ''}</div>
                        </div>
                        <i className="bi bi-chevron-right content-card-arrow"></i>
                      </button>
                    )}

                    <button
                      type="button"
                      className="content-card"
                      onClick={() => setShowHealthEditor(true)}
                    >
                      <div className="content-card-icon"><i className="bi bi-people"></i></div>
                      <div className="content-card-body">
                        <div className="content-card-title">Histórico familiar</div>
                        <div className="content-card-sub">
                          {healthProfile.familyHistory.length > 0
                            ? `${healthProfile.familyHistory.length} registro(s)`
                            : 'Nenhum registro adicionado'}
                        </div>
                      </div>
                      <i className="bi bi-chevron-right content-card-arrow"></i>
                    </button>
                  </div>
                )}
              </div>
            </>
          )
        )}
      </div>

      {/* ── Editor de perfil de saúde ─────────────────────── */}
      {showHealthEditor && (
        <HealthProfileEditor
          profile={healthProfile}
          onSave={(updated) => {
            setHealthProfile(updated)
            saveHealthProfile(updated, sessionUserId)
            setShowHealthEditor(false)
          }}
          onClose={() => setShowHealthEditor(false)}
        />
      )}

      {/* ── Modal de cancelamento de assinatura ───────────── */}
      {cancelModal && (
        <div className="cancel-modal-backdrop" onClick={() => setCancelModal(null)}>
          <div className="cancel-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cancel-modal-icon">
              <i className="bi bi-x-circle-fill" />
            </div>
            <h3 className="cancel-modal-title">Cancelar assinatura</h3>
            <p className="cancel-modal-body">
              Tem certeza que deseja cancelar o plano <strong>{cancelModal.planLabel}</strong>?
              <br />
              Você continuará tendo acesso até o fim do período pago.
            </p>
            <div className="cancel-modal-actions">
              <button
                type="button"
                className="btn-cancel-modal-dismiss"
                onClick={() => setCancelModal(null)}
                disabled={cancelLoading}
              >
                Manter assinatura
              </button>
              <button
                type="button"
                className="btn-cancel-modal-confirm"
                disabled={cancelLoading}
                onClick={() => handleCancelSubscription(cancelModal.planId)}
              >
                {cancelLoading ? <span className="btn-spinner" /> : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Navegação inferior ────────────────────────────── */}
      <nav className="bottom-nav" aria-label="Navegação principal">
        {bottomNavItems.map((item) => {
          const itemAccess = resolveAccess(item.id)
          const itemLocked = itemAccess === 'locked'
          return (
            <button
              type="button"
              key={item.id}
              aria-label={item.label}
              title={item.label}
              className={`nav-btn ${activeSection === item.id ? 'active' : ''} ${itemLocked ? 'nav-btn-locked' : ''}`}
              onClick={() => setActiveSection(item.id)}
            >
              <i className={`bi ${item.icon}`}></i>
              {itemLocked && <i className="bi bi-lock-fill nav-lock-badge"></i>}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export default App
