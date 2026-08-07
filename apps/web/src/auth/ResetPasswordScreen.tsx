import { useState } from 'react'

interface Props {
  token: string
  onSuccess: () => void
  onBack: () => void
}

type ScreenState = 'form' | 'submitting' | 'success' | 'error'

export function ResetPasswordScreen({ token, onSuccess, onBack }: Props) {
  const [screenState, setScreenState] = useState<ScreenState>('form')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

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
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json() as { ok?: boolean; message?: string }

      if (!res.ok || !data.ok) {
        setErrorMsg(data.message ?? 'Não foi possível redefinir sua senha.')
        setScreenState('error')
        return
      }

      setScreenState('success')
      setTimeout(onSuccess, 2500)
    } catch {
      setErrorMsg('Erro de conexão. Tente novamente.')
      setScreenState('form')
    }
  }

  if (screenState === 'success') {
    return (
      <div className="register-screen">
        <div className="register-card">
          <div className="register-success-badge">
            <i className="bi bi-check-circle-fill" />
            Senha redefinida!
          </div>
          <h1 className="register-title">Tudo certo</h1>
          <p className="register-sub">Sua senha foi atualizada com sucesso. Você será redirecionado para o login.</p>
          <div className="reset-success-loader" />
        </div>
      </div>
    )
  }

  if (screenState === 'error') {
    return (
      <div className="register-screen">
        <div className="register-card">
          <div className="register-error-icon">
            <i className="bi bi-exclamation-circle-fill" />
          </div>
          <h2 className="register-title">Link inválido</h2>
          <p className="register-sub">{errorMsg}</p>
          <button type="button" className="btn-login-enter" onClick={onBack}>
            Voltar ao login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="register-screen">
      <div className="register-card">
        <div className="reset-icon">
          <i className="bi bi-shield-lock-fill" />
        </div>

        <h1 className="register-title">Nova senha</h1>
        <p className="register-sub">
          Escolha uma senha segura com no mínimo 8 caracteres.
        </p>

        <form className="register-form" onSubmit={handleSubmit} noValidate>
          <div className="register-field">
            <label className="register-label" htmlFor="reset-password">Nova senha</label>
            <div className="register-input-wrap">
              <input
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                className="register-input"
                placeholder="Mínimo 8 caracteres"
                value={password}
                autoComplete="new-password"
                autoFocus
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
            <label className="register-label" htmlFor="reset-confirm">Confirmar nova senha</label>
            <input
              id="reset-confirm"
              type={showPassword ? 'text' : 'password'}
              className="register-input"
              placeholder="Repita a nova senha"
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
              : 'Salvar nova senha'}
          </button>
        </form>

        <button type="button" className="register-back-link" onClick={onBack}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
