// ── Admin session ──────────────────────────────────────────
// Guarda APENAS o token de sessão emitido pelo backend
// (aleatório, revogável, expira em 8h). Nenhum secret ou
// credencial fixa é armazenada no navegador.

const SESSION_KEY = 'vs_admin_session'

interface AdminSession {
  token: string
  expiresAt: number
}

export function loadAdminSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as AdminSession
    if (!session.token || Date.now() > session.expiresAt) {
      clearAdminSession()
      return null
    }
    return session
  } catch {
    return null
  }
}

export function getAdminToken(): string | null {
  return loadAdminSession()?.token ?? null
}

export function saveAdminSession(token: string, expiresAt: number): void {
  const session: AdminSession = { token, expiresAt }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearAdminSession(): void {
  localStorage.removeItem(SESSION_KEY)
}
