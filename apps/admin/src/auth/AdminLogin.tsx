import { useEffect, useRef, useState } from 'react'
import { saveAdminSession } from './adminSession'

interface Props {
  onLogin: () => void
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  if (totalSeconds >= 60) {
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return s > 0 ? `${m}m ${s}s` : `${m}m`
  }
  return `${totalSeconds}s`
}

export function AdminLogin({ onLogin }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [remainingMs, setRemainingMs] = useState(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startCountdown(totalMs: number) {
    setRemainingMs(totalMs)
    if (countdownRef.current) clearInterval(countdownRef.current)
    const startedAt = Date.now()
    countdownRef.current = setInterval(() => {
      const left = totalMs - (Date.now() - startedAt)
      setRemainingMs(Math.max(0, left))
      if (left <= 0) {
        clearInterval(countdownRef.current!)
        countdownRef.current = null
        setErrorMsg('')
      }
    }, 250)
  }

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (remainingMs > 0) return

    if (!email || !password) {
      setErrorMsg('Preencha e-mail e senha.')
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        token?: string
        expiresAt?: number
        message?: string
        retryAfterSec?: number
      }

      if (res.status === 429) {
        const waitMs = (data.retryAfterSec ?? 900) * 1000
        setErrorMsg(data.message ?? 'Muitas tentativas. Aguarde antes de tentar novamente.')
        startCountdown(waitMs)
        return
      }

      if (!res.ok || !data.token || !data.expiresAt) {
        setErrorMsg(data.message ?? 'E-mail ou senha incorretos.')
        return
      }

      saveAdminSession(data.token, data.expiresAt)
      onLogin()
    } catch {
      setErrorMsg('Falha de conexão com o servidor. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const isLocked = remainingMs > 0

  return (
    <div className="admin-login-screen">

      {/* Animated plant decorations */}
      <div className="login-plants" aria-hidden="true">
        {/* Bottom-left large tropical leaf */}
        <svg className="login-plant-bl" viewBox="0 0 200 300" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M100 290 C80 250 20 200 10 120 C0 40 60 10 100 5 C140 10 200 40 190 120 C180 200 120 250 100 290Z" fill="#5a8672"/>
          <path d="M100 290 C100 200 100 100 100 5" stroke="#3d6153" strokeWidth="3" opacity="0.5"/>
          <path d="M100 200 C70 170 30 150 10 120" stroke="#3d6153" strokeWidth="2" opacity="0.3"/>
          <path d="M100 200 C130 170 170 150 190 120" stroke="#3d6153" strokeWidth="2" opacity="0.3"/>
          <path d="M100 140 C75 115 40 105 20 90" stroke="#3d6153" strokeWidth="1.5" opacity="0.2"/>
          <path d="M100 140 C125 115 160 105 180 90" stroke="#3d6153" strokeWidth="1.5" opacity="0.2"/>
          {/* Second leaf */}
          <path d="M60 280 C30 230 5 160 20 90 C35 30 70 15 90 10 C60 80 55 170 60 280Z" fill="#5a8672" opacity="0.7"/>
        </svg>

        {/* Bottom-right plant */}
        <svg className="login-plant-br" viewBox="0 0 180 260" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M90 250 C75 210 15 165 8 95 C0 30 55 8 90 5 C125 8 180 30 172 95 C165 165 105 210 90 250Z" fill="#5a8672"/>
          <path d="M90 250 C90 170 90 80 90 5" stroke="#3d6153" strokeWidth="3" opacity="0.5"/>
          <path d="M90 170 C60 145 25 130 8 100" stroke="#3d6153" strokeWidth="2" opacity="0.3"/>
          <path d="M90 170 C120 145 155 130 172 100" stroke="#3d6153" strokeWidth="2" opacity="0.3"/>
          {/* Smaller side leaf */}
          <path d="M130 240 C160 190 175 130 162 70 C148 20 118 10 100 8 C125 60 135 155 130 240Z" fill="#5a8672" opacity="0.6"/>
        </svg>

        {/* Top-right hanging leaf */}
        <svg className="login-plant-tr" viewBox="0 0 120 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M60 0 C80 40 100 100 90 160 C80 200 40 210 20 170 C0 130 10 60 60 0Z" fill="#5a8672"/>
          <path d="M60 0 C60 80 60 140 60 200" stroke="#3d6153" strokeWidth="2.5" opacity="0.5"/>
          <path d="M60 80 C45 60 20 55 8 40" stroke="#3d6153" strokeWidth="1.5" opacity="0.3"/>
          <path d="M60 80 C75 60 95 55 108 40" stroke="#3d6153" strokeWidth="1.5" opacity="0.3"/>
        </svg>

        {/* Top-left accent leaf */}
        <svg className="login-plant-tl" viewBox="0 0 90 130" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M45 0 C60 30 75 75 65 110 C55 135 25 140 12 110 C-2 80 8 35 45 0Z" fill="#5a8672"/>
          <path d="M45 0 C45 50 45 100 45 130" stroke="#3d6153" strokeWidth="2" opacity="0.4"/>
        </svg>

        {/* Floating bubbles */}
        <div className="login-bubble login-bubble-1" />
        <div className="login-bubble login-bubble-2" />
        <div className="login-bubble login-bubble-3" />
        <div className="login-bubble login-bubble-4" />
        <div className="login-bubble login-bubble-5" />
        <div className="login-bubble login-bubble-6" />
      </div>

      <div className="admin-login-card">
        {/* Brand */}
        <div className="admin-login-brand">
          <div className="admin-login-logo">
            <i className="bi bi-heart-pulse-fill" />
          </div>
          <div>
            <h1 className="admin-login-title">Viver &amp; Saúde</h1>
            <p className="admin-login-sub">Painel administrativo</p>
          </div>
        </div>

        {/* Form */}
        <form className="admin-login-form" onSubmit={handleSubmit} noValidate>
          <div className="admin-login-field">
            <label className="admin-login-label" htmlFor="adm-email">E-mail</label>
            <input
              id="adm-email"
              type="email"
              className="admin-login-input"
              placeholder="admin@dominio.com"
              value={email}
              autoComplete="email"
              disabled={isLocked || loading}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="admin-login-field">
            <label className="admin-login-label" htmlFor="adm-password">Senha</label>
            <div className="admin-login-input-wrap">
              <input
                id="adm-password"
                type={showPassword ? 'text' : 'password'}
                className="admin-login-input"
                placeholder="••••••••"
                value={password}
                autoComplete="current-password"
                disabled={isLocked || loading}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="admin-login-eye"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className={`admin-login-error ${isLocked ? 'admin-login-error-locked' : ''}`}>
              <i className={`bi ${isLocked ? 'bi-clock-history' : 'bi-exclamation-circle'}`} />
              <span>
                {errorMsg}
                {isLocked && <strong className="admin-login-countdown"> {formatCountdown(remainingMs)}</strong>}
              </span>
            </div>
          )}

          <button
            type="submit"
            className="admin-login-btn"
            disabled={isLocked || loading}
          >
            {loading ? (
              <span className="admin-login-spinner" />
            ) : isLocked ? (
              <>
                <i className="bi bi-lock-fill" />
                Bloqueado — {formatCountdown(remainingMs)}
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <p className="admin-login-footer">
          <i className="bi bi-shield-lock" /> Acesso restrito a administradores autorizados.
        </p>
      </div>
    </div>
  )
}
