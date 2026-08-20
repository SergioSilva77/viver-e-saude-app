import jwt from 'jsonwebtoken'
import type express from 'express'
import { effectiveJwtSecret } from './config.js'
import { findById } from './userStore.js'

// ── JWT de usuário (chat, chamadas, agendamento) ────────────
// Não substitui o login atual (que continua funcionando exatamente
// como antes) — é um token ADICIONAL emitido no login para proteger
// as novas rotas privadas (chat/chamada/agendamento) e o handshake
// do WebSocket.

export const USER_TOKEN_EXPIRES_IN = '90d'

export interface UserTokenPayload {
  sub: string // userId
  role: 'user' | 'consultant'
  tokenVersion: number
}

export function signUserToken(payload: UserTokenPayload): string {
  return jwt.sign(payload, effectiveJwtSecret, { expiresIn: USER_TOKEN_EXPIRES_IN })
}

export function verifyUserToken(token: string): UserTokenPayload {
  const decoded = jwt.verify(token, effectiveJwtSecret)
  if (typeof decoded !== 'object' || decoded === null || typeof (decoded as { sub?: unknown }).sub !== 'string') {
    throw new Error('Token inválido.')
  }
  return decoded as unknown as UserTokenPayload
}

// Extensão do Request do Express para carregar os dados do usuário autenticado.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { userId: string; role: 'user' | 'consultant' }
    }
  }
}

/**
 * Middleware que exige um token JWT válido no header Authorization: Bearer <token>.
 * Também confere se o tokenVersion do token ainda corresponde ao do banco —
 * isso permite invalidar tokens antigos (ex: reset de senha) incrementando
 * users.token_version.
 *
 * Usado apenas nas rotas NOVAS (chat/chamada/agendamento). As rotas antigas
 * continuam sem essa exigência para não quebrar nada em produção.
 */
export async function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Token de autenticação ausente.' })
      return
    }
    const token = header.slice('Bearer '.length).trim()
    const payload = verifyUserToken(token)

    const user = await findById(payload.sub)
    if (!user) {
      res.status(401).json({ message: 'Usuário não encontrado.' })
      return
    }
    if ((user.tokenVersion ?? 0) !== payload.tokenVersion) {
      res.status(401).json({ message: 'Sessão expirada. Faça login novamente.' })
      return
    }

    req.auth = { userId: payload.sub, role: payload.role }
    next()
  } catch {
    res.status(401).json({ message: 'Token inválido ou expirado.' })
  }
}

/** Middleware adicional para restringir uma rota a um papel específico (ex: consultor). */
export function requireRole(role: 'user' | 'consultant') {
  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    if (!req.auth || req.auth.role !== role) {
      res.status(403).json({ message: 'Acesso não permitido para este papel de usuário.' })
      return
    }
    next()
  }
}
