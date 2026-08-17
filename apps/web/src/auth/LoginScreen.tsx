import { useEffect, useRef, useState } from 'react'
import { plans } from '@viver-saude/shared'
import { saveSession } from './sessionTypes'
import { devAuthenticate } from './devAuth'
import type { PlanId } from '@viver-saude/shared'

type SubscribeState = 'idle' | 'loading' | 'error'
type OverlayStep = 'plans' | 'user-info'
type LoginView = 'login' | 'forgot' | 'forgot-sent'

const GUARDIAO_24H_MS = 24 * 60 * 60 * 1000

// ── Plan display constants ──────────────────────────────────
const planIcons = ['bi-seedling', 'bi-heart-pulse', 'bi-stars']
const planIconClass = ['n1', 'n2', 'n3']

type LoginState = 'idle' | 'loading' | 'error'

interface Props {
  onLogin: (planIds: PlanId[]) => void
  onSubscribe: (planId: PlanId, userData: { fullName: string; email: string }) => Promise<void>
  /** Success banner shown after registration redirect — also hides "Assinar" button */
  successMessage?: string
  /** Email pre-filled after registration redirect */
  prefilledEmail?: string
  /**
   * `true`  → Stripe configured, can subscribe
   * `false` → Stripe NOT configured, disable subscribe and show banner
   * `null`  → still checking
   */
  stripeReady?: boolean | null
}

export function LoginScreen({ onLogin, onSubscribe, successMessage, prefilledEmail, stripeReady = null }: Props) {
  const [loginView, setLoginView] = useState<LoginView>('login')
  const [loginState, setLoginState] = useState<LoginState>('idle')
  const [email, setEmail] = useState(prefilledEmail ?? '')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [showPassword, setShowPassword] = useState(false)

  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotState, setForgotState] = useState<'idle' | 'loading'>('idle')
  const [forgotError, setForgotError] = useState('')

  const [overlayVisible, setOverlayVisible] = useState(false)
  const [overlayEntered, setOverlayEntered] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  const [subscribeState, setSubscribeState] = useState<SubscribeState>('idle')
  const [subscribeError, setSubscribeError] = useState('')
  const [subscribingPlanId, setSubscribingPlanId] = useState<PlanId | null>(null)

  const [overlayStep, setOverlayStep] = useState<OverlayStep>('plans')
  const [pendingPlanId, setPendingPlanId] = useState<PlanId | null>(null)
  const [intentName, setIntentName] = useState('')
  const [intentEmail, setIntentEmail] = useState('')
  const [intentError, setIntentError] = useState('')

  function openPlans() {
    setOverlayStep('plans')
    setPendingPlanId(null)
    setIntentName('')
    setIntentEmail('')
    setIntentError('')
    setOverlayVisible(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setOverlayEntered(true))
    })
  }

  function handlePlanSelect(planId: PlanId) {
    setPendingPlanId(planId)
    setSubscribeError('')
    setIntentError('')
    setOverlayStep('user-info')
  }

  async function handleUserInfoSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!intentName.trim()) {
      setIntentError('Informe seu nome completo.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(intentEmail.trim())) {
      setIntentError('Informe um e-mail válido.')
      return
    }
    setIntentError('')
    setSubscribeError('')
    setSubscribeState('loading')
    setSubscribingPlanId(pendingPlanId)
    let didFail = false
    try {
      await onSubscribe(pendingPlanId!, { fullName: intentName.trim(), email: intentEmail.trim() })
    } catch (err) {
      didFail = true
      const msg = err instanceof Error ? err.message : 'Erro desconhecido ao iniciar o checkout.'
      setSubscribeError(msg)
      setSubscribeState('error')
    } finally {
      setSubscribingPlanId(null)
      if (!didFail) setSubscribeState('idle')
    }
  }

  function closePlans() {
    setOverlayEntered(false)
    setTimeout(() => setOverlayVisible(false), 380)
  }

  function buildGuardiao24hTimestamp(planIds: PlanId[]): number | null {
    // Only start the 24h window if the user has nivel1 (and not a higher tier that gives full access)
    if (planIds.includes('nivel1') && !planIds.includes('nivel2') && !planIds.includes('nivel3')) {
      return Date.now() + GUARDIAO_24H_MS
    }
    return null
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      setErrorMsg('Preencha e-mail e senha.')
      setLoginState('error')
      return
    }

    setLoginState('loading')
    setErrorMsg('')

    const result = await devAuthenticate(email, password)
    if (!result.ok) {
      setErrorMsg(result.error ?? 'Credenciais inválidas.')
      setLoginState('error')
      return
    }
    const resolvedPlanIds = result.planIds ?? []
    saveSession({
      userId: result.userId!,
      email: result.email!,
      fullName: result.fullName,
      photoUrl: result.photoUrl,
      planIds: resolvedPlanIds,
      planExpiresAt: result.planExpiresAt,
      guardiao24hUnlockedUntil: buildGuardiao24hTimestamp(resolvedPlanIds),
    })
    onLogin(resolvedPlanIds)
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && overlayVisible) closePlans()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [overlayVisible])

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())) {
      setForgotError('Informe um e-mail válido.')
      return
    }
    setForgotError('')
    setForgotState('loading')
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      })
      // Always show success (API never reveals if email exists)
      setLoginView('forgot-sent')
    } catch {
      setForgotError('Erro de conexão. Tente novamente.')
    } finally {
      setForgotState('idle')
    }
  }


  // ── Forgot password — sent confirmation ─────────────────
  if (loginView === 'forgot-sent') {
    return (
      <div className="login-screen">
        <div className="login-brand">
          <div className="login-logo"><i className="bi bi-envelope-check-fill" /></div>
          <h1 className="login-app-name">Verifique seu e-mail</h1>
          <p className="login-tagline">Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.</p>
        </div>
        <div className="forgot-sent-card">
          <i className="bi bi-send-check" />
          <p>Não recebeu? Verifique a pasta de spam ou <button type="button" className="link-btn" onClick={() => { setLoginView('forgot'); setForgotEmail('') }}>tente novamente</button>.</p>
        </div>
        <button
          type="button"
          className="btn-login-enter"
          style={{ marginTop: '1rem' }}
          onClick={() => setLoginView('login')}
        >
          Voltar ao login
        </button>
      </div>
    )
  }

  // ── Forgot password — email form ─────────────────────────
  if (loginView === 'forgot') {
    return (
      <div className="login-screen">
        <div className="login-brand">
          <div className="login-logo"><i className="bi bi-key-fill" /></div>
          <h1 className="login-app-name">Esqueci minha senha</h1>
          <p className="login-tagline">Digite seu e-mail e enviaremos um link para redefinir sua senha.</p>
        </div>

        <form className="login-form" onSubmit={handleForgotPassword} noValidate>
          <div className="login-field">
            <label className="login-label" htmlFor="forgot-email">E-mail</label>
            <input
              id="forgot-email"
              type="email"
              className="login-input"
              placeholder="seu@email.com"
              value={forgotEmail}
              autoComplete="email"
              autoFocus
              onChange={(e) => setForgotEmail(e.target.value)}
            />
          </div>

          {forgotError && (
            <p className="login-error">
              <i className="bi bi-exclamation-circle" /> {forgotError}
            </p>
          )}

          <button
            type="submit"
            className="btn-login-enter"
            disabled={forgotState === 'loading'}
          >
            {forgotState === 'loading' ? <span className="login-spinner" /> : 'Enviar link de redefinição'}
          </button>
        </form>

        <button
          type="button"
          className="login-forgot"
          style={{ marginTop: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={() => setLoginView('login')}
        >
          ← Voltar ao login
        </button>
      </div>
    )
  }

  // ── Main login view ───────────────────────────────────────
  return (
    <div className="login-screen">
      {successMessage && (
        <div className="login-success-banner">
          <i className="bi bi-check-circle-fill" />
          {successMessage}
        </div>
      )}

      <div className="login-brand">
        <div className="login-logo">
          <i className="bi bi-heart-pulse-fill" />
        </div>
        <h1 className="login-app-name">Viver &amp; Saúde</h1>
        <p className="login-tagline">Sua jornada de saúde natural começa aqui</p>
      </div>

      <form className="login-form" onSubmit={handleLogin} noValidate>
        <div className="login-field">
          <label className="login-label" htmlFor="login-email">E-mail</label>
          <input
            id="login-email"
            type="email"
            className="login-input"
            placeholder="seu@email.com"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="login-field">
          <label className="login-label" htmlFor="login-password">Senha</label>
          <div className="register-input-wrap">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              className="login-input"
              placeholder="••••••••"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="register-toggle-pw"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
            </button>
          </div>
        </div>

        {loginState === 'error' && (
          <p className="login-error">
            <i className="bi bi-exclamation-circle" /> {errorMsg}
          </p>
        )}

        <button
          type="submit"
          className="btn-login-enter"
          disabled={loginState === 'loading'}
        >
          {loginState === 'loading' ? <span className="login-spinner" /> : 'Entrar'}
        </button>

        <button
          type="button"
          className="login-forgot"
          onClick={() => { setForgotEmail(email); setForgotError(''); setLoginView('forgot') }}
        >
          Esqueci minha senha
        </button>
      </form>

      <div className="login-divider">
        <span>Novo por aqui?</span>
      </div>

      {/* Hide subscribe button after a payment/registration — user must log in */}
      {!successMessage && (
        <div className="login-subscribe-area">
          <button
            type="button"
            className="btn-login-subscribe"
            onClick={openPlans}
            aria-label="Ver planos e assinar"
          >
            <i className="bi bi-stars" />
            Assinar
          </button>
        </div>
      )}

      {overlayVisible && (
        <div
          ref={overlayRef}
          className={`plans-overlay ${overlayEntered ? 'plans-overlay-entered' : ''}`}
          aria-modal="true"
          role="dialog"
          aria-label="Escolha seu plano"
        >
          <div className="plans-overlay-handle" onClick={closePlans} />

          <div className="plans-overlay-header">
            <div>
              <h2 className="plans-overlay-title">
                {overlayStep === 'plans' ? 'Escolha seu plano' : 'Seus dados'}
              </h2>
              <p className="plans-overlay-sub">
                {overlayStep === 'plans' ? 'Comece sua jornada de saúde hoje' : 'Antes de ir ao pagamento'}
              </p>
            </div>
            <button
              type="button"
              className="plans-overlay-close"
              onClick={closePlans}
              aria-label="Fechar"
            >
              <i className="bi bi-x-lg" />
            </button>
          </div>

          {/* Stepper */}
          <div className="overlay-stepper">
            <div className={`overlay-stepper-step ${overlayStep === 'plans' ? 'active' : 'done'}`}>
              <span className="overlay-stepper-num">{overlayStep === 'plans' ? '①' : '✓'}</span>
              <span>Plano</span>
            </div>
            <div className="overlay-stepper-line" />
            <div className={`overlay-stepper-step ${overlayStep === 'user-info' ? 'active' : ''}`}>
              <span className="overlay-stepper-num">②</span>
              <span>Seus dados</span>
            </div>
            <div className="overlay-stepper-line" />
            <div className="overlay-stepper-step">
              <span className="overlay-stepper-num">③</span>
              <span>Pagamento</span>
            </div>
          </div>

          <div className="plans-overlay-body">
            {overlayStep === 'plans' ? (
              <>
                {stripeReady === false && (
                  <div className="stripe-unavailable-banner">
                    <i className="bi bi-credit-card-2-front" />
                    <div>
                      <strong>Pagamentos indisponíveis</strong>
                      <p>O sistema de pagamentos está em manutenção. Tente novamente em alguns minutos.</p>
                    </div>
                  </div>
                )}
                <div className="plans-list">
                  {plans.map((plan, index) => (
                    <div
                      key={plan.id}
                      className={`plan-card ${index === 1 ? 'featured' : ''}`}
                    >
                      {index === 1 && (
                        <span className="plan-featured-badge">mais popular</span>
                      )}
                      <div className="plan-card-top">
                        <div className={`plan-icon ${planIconClass[index]}`}>
                          <i className={`bi ${planIcons[index]}`} />
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
                            <i className="bi bi-check2" />
                            {benefit}
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className={`btn-subscribe ${index === 1 ? 'primary' : 'outline'}`}
                        disabled={stripeReady === false}
                        onClick={() => handlePlanSelect(plan.id)}
                      >
                        Escolher {index === 0 ? 'este' : 'plano'}
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn-already-have-account"
                  onClick={closePlans}
                >
                  Já tenho uma conta — fazer login
                </button>
              </>
            ) : (
              <div className="overlay-user-info">
                {/* Summary of chosen plan */}
                {pendingPlanId && (() => {
                  const plan = plans.find(p => p.id === pendingPlanId)!
                  const idx = plans.indexOf(plan)
                  return (
                    <div className="overlay-plan-summary">
                      <div className={`plan-icon ${planIconClass[idx]}`} style={{ width: 36, height: 36, fontSize: '1rem' }}>
                        <i className={`bi ${planIcons[idx]}`} />
                      </div>
                      <div>
                        <div className="overlay-plan-summary-name">{plan.label}</div>
                        <div className="overlay-plan-summary-price">
                          R$ {(plan.priceInCents / 100).toFixed(2).replace('.', ',')}
                          {plan.billingInterval === 'monthly' ? '/mês' : ''}
                        </div>
                      </div>
                    </div>
                  )
                })()}

                <form className="overlay-user-info-form" onSubmit={handleUserInfoSubmit} noValidate>
                  <div className="register-field">
                    <label className="register-label" htmlFor="intent-name">Nome completo</label>
                    <input
                      id="intent-name"
                      type="text"
                      className="register-input"
                      placeholder="Seu nome completo"
                      value={intentName}
                      autoComplete="name"
                      autoFocus
                      onChange={(e) => setIntentName(e.target.value)}
                    />
                  </div>

                  <div className="register-field">
                    <label className="register-label" htmlFor="intent-email">E-mail</label>
                    <input
                      id="intent-email"
                      type="email"
                      className="register-input"
                      placeholder="seu@email.com"
                      value={intentEmail}
                      autoComplete="email"
                      onChange={(e) => setIntentEmail(e.target.value)}
                    />
                  </div>

                  {(intentError || subscribeError) && (
                    <p className="register-error">
                      <i className="bi bi-exclamation-circle" /> {intentError || subscribeError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="btn-login-enter"
                    disabled={subscribeState === 'loading'}
                  >
                    {subscribeState === 'loading' && subscribingPlanId === pendingPlanId
                      ? <><span className="login-spinner" /> Aguarde...</>
                      : <><i className="bi bi-lock-fill" style={{ marginRight: '0.4rem' }} />Continuar para o pagamento</>
                    }
                  </button>
                </form>

                <button
                  type="button"
                  className="overlay-back-btn"
                  onClick={() => setOverlayStep('plans')}
                >
                  <i className="bi bi-arrow-left" /> Voltar aos planos
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {overlayVisible && (
        <div
          className={`plans-backdrop ${overlayEntered ? 'plans-backdrop-entered' : ''}`}
          onClick={closePlans}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
