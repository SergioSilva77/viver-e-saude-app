// ── Admin API helper ───────────────────────────────────────
// Centraliza o header de autenticação (token de sessão) e o
// tratamento de 401 (sessão expirada → volta para o login).

import { loadAdminSession, clearAdminSession } from '../auth/adminSession'

export async function adminFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const session = loadAdminSession()
  const headers = new Headers(options.headers)
  if (session?.token) headers.set('x-admin-token', session.token)

  const res = await fetch(path, { ...options, headers })

  if (res.status === 401) {
    clearAdminSession()
    window.location.reload()
    throw new Error('Sessão expirada. Faça login novamente.')
  }
  return res
}
