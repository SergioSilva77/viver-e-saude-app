import type { PlanId } from '@viver-saude/shared'

// ── Types ──────────────────────────────────────────────────

export interface Session {
  userId: string
  email: string
  /** Display name (from backend StoredUser.fullName). May be empty for legacy data. */
  fullName?: string
  /** Profile photo URL (from backend). */
  photoUrl?: string
  /** All plan levels granted to this user. */
  planIds: PlanId[]
  expiresAt: number
  /**
   * Per-plan expiry timestamps in ms.
   * Absent or null means lifetime access (one-time payment).
   */
  planExpiresAt?: Record<string, number>
  /**
   * Timestamp (ms) until which MeuGuardião is fully unlocked for Nível 1 users.
   * Set on first login when the user holds nivel1.
   * Null means the 24h window has not been started yet.
   */
  guardiao24hUnlockedUntil?: number | null
  /**
   * Whether the user has already used the one-time free consultant session.
   * Available exclusively to Nível 1 users.
   */
  consultantUsed?: boolean
}

// ── Constants ──────────────────────────────────────────────

const SESSION_KEY = 'vs_session'
const ADMIN_SETTINGS_KEY = 'vs_admin_settings'
const DEFAULT_SESSION_DAYS = 30

// ── Session duration ───────────────────────────────────────

export function getSessionDurationMs(): number {
  try {
    const raw = localStorage.getItem(ADMIN_SETTINGS_KEY)
    if (!raw) return DEFAULT_SESSION_DAYS * 24 * 60 * 60 * 1000
    const settings = JSON.parse(raw) as { session?: { durationDays?: number } }
    const days = settings?.session?.durationDays ?? DEFAULT_SESSION_DAYS
    return days * 24 * 60 * 60 * 1000
  } catch {
    return DEFAULT_SESSION_DAYS * 24 * 60 * 60 * 1000
  }
}

// ── CRUD helpers ───────────────────────────────────────────

/** Normalizes legacy sessions that used planId instead of planIds. */
function normalizeLegacySession(raw: Session & { planId?: PlanId | null }): Session {
  if (!raw.planIds) {
    raw.planIds = raw.planId ? [raw.planId] : []
  }
  if (raw.guardiao24hUnlockedUntil === undefined) raw.guardiao24hUnlockedUntil = null
  if (raw.consultantUsed === undefined) raw.consultantUsed = false
  return raw
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = normalizeLegacySession(JSON.parse(raw) as Session & { planId?: PlanId | null })
    if (Date.now() > session.expiresAt) {
      clearSession()
      return null
    }
    return session
  } catch {
    return null
  }
}

export function saveSession(session: Omit<Session, 'expiresAt'>): void {
  const full: Session = {
    ...session,
    guardiao24hUnlockedUntil: session.guardiao24hUnlockedUntil ?? null,
    consultantUsed: session.consultantUsed ?? false,
    expiresAt: Date.now() + getSessionDurationMs(),
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(full))
}

export function updateSession(patch: Partial<Pick<Session, 'guardiao24hUnlockedUntil' | 'consultantUsed'>>): void {
  const current = loadSession()
  if (!current) return
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...current, ...patch }))
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}
