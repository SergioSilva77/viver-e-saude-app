import { useEffect, useState } from 'react'

// ── Types ──────────────────────────────────────────────────

interface Props {
  sessionId: string
  planId: string
  /** Called after successful registration — no auto-login, user must sign in. */
  onRegistered: (email: string) => void
  onBack: () => void
}

type ScreenState = 'verifying' | 'form' | 'submitting' | 'error'

interface SessionInfo {
  email: string
  planId: string
  fullName?: string
}

// ── Helpers ────────────────────────────────────────────────


// ── Component ──────────────────────────────────────────────

export function RegisterScreen({ sessionId, planId: planIdFromUrl, onRegistered, onBack }: Props) {
  const [screenState, setScreenState] = useState<ScreenState>('verifying')
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Verify Stripe session on mount
  useEffect(() => {
    async function verify() {
      try {
        const res = await fetch(`/api/billing/verify-session?session_id=${encodeURIComponent(sessionId)}`)
        const data = await res.json() as { ok?: boolean; email?: string; planId?: string; fullName?: string; message?: string }

        if (!res.ok || !data.email) {
          setErrorMsg(data.message ?? 'Não foi possível verificar o pagamento.')
          setScreenState('error')
          return
        }

        setSessionInfo({
          email: data.email,
          planId: data.planId ?? planIdFromUrl,
          fullName: data.fullName ?? undefined,
        })
        if (data.fullName) setFullName(data.fullName)
        setScreenState('form')
      } catch {
        setErrorMsg('Erro de conexão ao verificar pagamento.')
        setScreenState('error')
      }
    }

    verify()
  }, [sessionId, planIdFromUrl])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!fullName.trim()) {
      setErrorMsg('Informe seu nome completo.')
      return
    }
    if (password.length < 8) {
      setErrorMsg('A senha deve ter no mínimo 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setErrorMsg('As senhas não conferem.')
      return
    }

    setErrorMsg('')
    setScreenState('submitting')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripeSessionId: sessionId,
          fullName: fullName.trim(),
          password,
        }),
      })

      const data = await res.json() as {
        ok?: boolean
        userId?: string
        email?: string
        planIds?: string[]
        planExpiresAt?: Record<string, number>
        message?: string
      }

      if (!res.ok || !data.ok) {
        setErrorMsg(data.message ?? 'Não foi possível criar sua conta.')
        setScreenState('form')
        return
      }

      // Registration complete — do NOT auto-login.
      // Redirect to login so the user authenticates with the credentials they just created.
      onRegistered(data.email!)
    } catch {
      setErrorMsg('Erro de conexão. Tente novamente.')
      setScreenState('form')
    }
  }

  // ── Verifying state ──────────────────────────────────────

  if (screenState === 'verifying') {
    return (
      <div className="register-screen">
        <div className="register-card">
          <div className="register-verify-icon">
            <i className="bi bi-shield-check" />
          </div>
          <h2 className="register-title">Verificando pagamento...</h2>
          <p className="register-sub">Aguarde enquanto confirmamos sua transação.</p>
          <div className="register-spinner" />
        </div>
      </div>
    )
  }

  // ── Error state ──────────────────────────────────────────

  if (screenState === 'error') {
    return (
      <div className="register-screen">
        <div className="register-card">
          <div className="register-error-icon">
            <i className="bi bi-exclamation-circle-fill" />
          </div>
          <h2 className="register-title">Não foi possível verificar</h2>
          <p className="register-sub">{errorMsg}</p>
          <button type="button" className="btn-login-enter" onClick={onBack}>
            Voltar ao início
          </button>
        </div>
      </div>
    )
  }

  // ── Form state ───────────────────────────────────────────

  return (
    <div className="register-screen">
      <div className="register-card">
        <div className="register-success-badge">
          <i className="bi bi-check-circle-fill" />
          Pagamento confirmado
        </div>

        <h1 className="register-title">Crie sua conta</h1>
        <p className="register-sub">
          Complete o cadastro para acessar todos os recursos do seu plano.
        </p>

        <form className="register-form" onSubmit={handleSubmit} noValidate>
          <div className="register-field">
            <label className="register-label" htmlFor="reg-email">E-mail</label>
            <input
              id="reg-email"
              type="email"
              className="register-input register-input-readonly"
              value={sessionInfo?.email ?? ''}
              readOnly
              tabIndex={-1}
            />
            <span className="register-field-hint">
              <i className="bi bi-lock-fill" /> Confirmado pelo Stripe
            </span>
          </div>

          <div className="register-field">
            <label className="register-label" htmlFor="reg-name">Nome completo</label>
            <input
              id="reg-name"
              type="text"
              className={`register-input ${sessionInfo?.fullName ? 'register-input-readonly' : ''}`}
              placeholder="Seu nome completo"
              value={fullName}
              autoComplete="name"
              autoFocus={!sessionInfo?.fullName}
              readOnly={Boolean(sessionInfo?.fullName)}
              tabIndex={sessionInfo?.fullName ? -1 : undefined}
              onChange={(e) => { if (!sessionInfo?.fullName) setFullName(e.target.value) }}
            />
            {sessionInfo?.fullName && (
              <span className="register-field-hint">
                <i className="bi bi-lock-fill" /> Confirmado antes do pagamento
              </span>
            )}
          </div>

          <div className="register-field">
            <label className="register-label" htmlFor="reg-password">Senha</label>
            <div className="register-input-wrap">
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                className="register-input"
                placeholder="Mínimo 8 caracteres"
                value={password}
                autoComplete="new-password"
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

          <div className="register-field">
            <label className="register-label" htmlFor="reg-confirm">Confirmar senha</label>
            <input
              id="reg-confirm"
              type={showPassword ? 'text' : 'password'}
              className="register-input"
              placeholder="Repita a senha"
              value={confirmPassword}
              autoComplete="new-password"
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {errorMsg && (
            <p className="register-error">
              <i className="bi bi-exclamation-circle" /> {errorMsg}
            </p>
          )}

          <button
            type="submit"
            className="btn-login-enter"
            disabled={screenState === 'submitting'}
          >
            {screenState === 'submitting'
              ? <span className="login-spinner" />
              : 'Criar minha conta'}
          </button>
        </form>

        <button type="button" className="register-back-link" onClick={onBack}>
          Voltar
        </button>
      </div>
    </div>
  )
}
