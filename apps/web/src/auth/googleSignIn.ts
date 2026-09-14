const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ||
  '886426639076-k402g862lsjr5ql76vpefovl9arlmgb2.apps.googleusercontent.com'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: {
            client_id: string
            callback: (response: { credential: string }) => void
            ux_mode?: string
            auto_select?: boolean
          }) => void
          prompt: (cb?: (n: { isNotDisplayed?: boolean; isSkippedMoment?: boolean }) => void) => void
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void
        }
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string
            scope: string
            callback: (response: { access_token?: string; error?: string }) => void
            error_callback?: (error: { type?: string; message?: string }) => void
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void }
        }
      }
    }
  }
}

let scriptPromise: Promise<void> | null = null

function waitForOauth2(timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      if (window.google?.accounts?.oauth2) {
        resolve()
        return
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error('Google Sign-In indisponível neste navegador.'))
        return
      }
      window.setTimeout(tick, 50)
    }
    tick()
  })
}

export function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const finish = () => {
      waitForOauth2().then(resolve).catch(reject)
    }
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')
    if (existing) {
      if (window.google?.accounts?.oauth2) {
        resolve()
        return
      }
      existing.addEventListener('load', finish)
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar o Google.')))
      finish()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = finish
    script.onerror = () => reject(new Error('Falha ao carregar o Google.'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

/** Popup clássico: escolher conta → devolve access token para o backend. */
export function signInWithGooglePopup(): Promise<string> {
  return new Promise((resolve, reject) => {
    const oauth = window.google?.accounts?.oauth2
    if (!oauth) {
      reject(new Error('Google Sign-In indisponível neste navegador.'))
      return
    }
    const client = oauth.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error === 'popup_closed_by_user'
            ? 'Login com Google cancelado.'
            : 'Não foi possível concluir o login com o Google.'))
          return
        }
        resolve(response.access_token)
      },
      error_callback: (error) => {
        if (error.type === 'popup_closed' || error.type === 'popup_closed_by_user') {
          reject(new Error('Login com Google cancelado.'))
          return
        }
        reject(new Error(error.message || 'Não foi possível concluir o login com o Google.'))
      },
    })
    client.requestAccessToken({ prompt: 'select_account' })
  })
}
