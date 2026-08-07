/**
 * Dev-mode authentication: validates credentials against the backend API.
 *
 * Calls POST /api/auth/login — proxied to localhost:4000 in development (via
 * Vite proxy) and handled by Nginx in production.
 *
 * Only active when Supabase is not configured.
 */

import type { PlanId } from '@viver-saude/shared'

export interface DevAuthResult {
  ok: boolean
  userId?: string
  email?: string
  fullName?: string
  planIds?: PlanId[]
  /** Per-plan expiry timestamps in ms (ISO strings converted from API). */
  planExpiresAt?: Record<string, number>
  error?: string
}

export async function devAuthenticate(email: string, password: string): Promise<DevAuthResult> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json() as {
      ok?: boolean
      message?: string
      userId?: string
      email?: string
      fullName?: string
      planIds?: string[]
      planExpiresAt?: Record<string, string>
    }

    if (!res.ok || !data.ok) {
      return { ok: false, error: data.message ?? 'Credenciais inválidas.' }
    }

    // Convert ISO date strings → ms timestamps
    const planExpiresAt: Record<string, number> = {}
    for (const [planId, iso] of Object.entries(data.planExpiresAt ?? {})) {
      if (iso) planExpiresAt[planId] = new Date(iso).getTime()
    }

    return {
      ok: true,
      userId: data.userId,
      email: data.email,
      fullName: data.fullName,
      planIds: (data.planIds ?? []) as PlanId[],
      planExpiresAt,
    }
  } catch {
    return {
      ok: false,
      error: 'Não foi possível conectar ao servidor. Verifique sua conexão.',
    }
  }
}
