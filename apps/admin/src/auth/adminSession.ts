// ── Admin session ──────────────────────────────────────────

const SESSION_KEY = 'vs_admin_session'
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000 // 8 hours

interface AdminSession {
  expiresAt: number
}

export function loadAdminSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as AdminSession
    if (Date.now() > session.expiresAt) {
      clearAdminSession()
      return null
    }
    return session
  } catch {
    return null
  }
}

export function saveAdminSession(): void {
  const session: AdminSession = { expiresAt: Date.now() + SESSION_DURATION_MS }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearAdminSession(): void {
  localStorage.removeItem(SESSION_KEY)
}
