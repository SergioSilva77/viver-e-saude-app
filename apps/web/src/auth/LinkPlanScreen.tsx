import { useEffect, useState } from 'react'
import type { PlanId } from '@viver-saude/shared'

interface Props {
  sessionId: string
  userId: string
  onLinked: (planIds: PlanId[], planExpiresAt: Record<string, number>) => void
  onBack: () => void
}

type ScreenState = 'linking' | 'success' | 'error'

export function LinkPlanScreen({ sessionId, userId, onLinked, onBack }: Props) {
  const [state, setState] = useState<ScreenState>('linking')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function link() {
      try {
        const res = await fetch('/api/billing/link-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, stripeSessionId: sessionId }),
        })
        const data = await res.json() as {
          ok?: boolean
          planIds?: string[]
          planExpiresAt?: Record<string, number>
          message?: string
        }

        if (!res.ok || !data.ok) {
          setErrorMsg(data.message ?? 'Não foi possível vincular o plano.')
          setState('error')
          return
        }

        setState('success')

        // Brief success display before handing control back
        setTimeout(() => {
          onLinked(
            (data.planIds ?? []) as PlanId[],
            data.planExpiresAt ?? {},
          )
        }, 1800)
      } catch {
        setErrorMsg('Erro de conexão. Tente novamente.')
        setState('error')
      }
    }

    link()
  }, [sessionId, userId, onLinked])

  if (state === 'linking') {
    return (
      <div className="register-screen">
        <div className="register-card">
          <div className="register-verify-icon">
            <i className="bi bi-shield-check" />
          </div>
          <h2 className="register-title">Ativando seu plano...</h2>
          <p className="register-sub">Aguarde enquanto adicionamos o plano à sua conta.</p>
          <div className="register-spinner" />
        </div>
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div className="register-screen">
        <div className="register-card">
          <div className="register-success-badge">
            <i className="bi bi-check-circle-fill" />
            Plano ativado com sucesso!
          </div>
          <h2 className="register-title">Tudo pronto!</h2>
          <p className="register-sub">Seu novo plano já está disponível. Redirecionando...</p>
          <div className="register-spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="register-screen">
      <div className="register-card">
        <div className="register-error-icon">
          <i className="bi bi-exclamation-circle-fill" />
        </div>
        <h2 className="register-title">Não foi possível ativar</h2>
        <p className="register-sub">{errorMsg}</p>
        <button type="button" className="btn-login-enter" onClick={onBack}>
          Voltar ao app
        </button>
      </div>
    </div>
  )
}
