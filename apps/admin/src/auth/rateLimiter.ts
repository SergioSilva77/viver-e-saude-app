// ── Exponential backoff rate limiter ──────────────────────
// Protects the admin login against brute-force attacks.
// State persists in localStorage so it survives page reloads.

const LOCKOUT_KEY = 'vs_admin_lockout'

interface LockoutState {
  attempts: number
  lockedUntil: number
}

// Lockout durations indexed by attempt count (0-based after the free attempts).
// Attempts 1-2: no lockout. Starting from attempt 3: escalating delays.
const LOCKOUT_SCHEDULE_MS: number[] = [
  0,           // attempt 1 — no wait
  0,           // attempt 2 — no wait
  10_000,      // attempt 3 — 10 seconds
  30_000,      // attempt 4 — 30 seconds
  120_000,     // attempt 5 — 2 minutes
  600_000,     // attempt 6+ — 10 minutes (applied to all subsequent)
]

function getLockoutMs(attempts: number): number {
  const idx = Math.min(attempts - 1, LOCKOUT_SCHEDULE_MS.length - 1)
  return LOCKOUT_SCHEDULE_MS[idx]
}

function readState(): LockoutState {
  try {
    const raw = localStorage.getItem(LOCKOUT_KEY)
    if (!raw) return { attempts: 0, lockedUntil: 0 }
    return JSON.parse(raw) as LockoutState
  } catch {
    return { attempts: 0, lockedUntil: 0 }
  }
}

function writeState(state: LockoutState): void {
  localStorage.setItem(LOCKOUT_KEY, JSON.stringify(state))
}

// ── Public API ─────────────────────────────────────────────

export interface LockStatus {
  locked: boolean
  remainingMs: number
  attempts: number
}

export function getLockStatus(): LockStatus {
  const state = readState()
  const remainingMs = Math.max(0, state.lockedUntil - Date.now())
  return {
    locked: remainingMs > 0,
    remainingMs,
    attempts: state.attempts,
  }
}

export function recordFailure(): LockStatus {
  const state = readState()
  const next: LockoutState = {
    attempts: state.attempts + 1,
    lockedUntil: Date.now() + getLockoutMs(state.attempts + 1),
  }
  writeState(next)
  return getLockStatus()
}

export function resetLockout(): void {
  localStorage.removeItem(LOCKOUT_KEY)
}
