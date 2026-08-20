import { createHmac } from 'node:crypto'

// ── Credenciais TURN efêmeras (coturn use-auth-secret) ─────
// Gera usuário/senha temporários (expiram em 1h) para autenticar no
// servidor TURN sem expor a chave secreta permanente no app.
// Convenção compatível com o mecanismo "REST API for TURN Server"
// (username = "expiry:userId", password = base64(HMAC-SHA1(secret, username))).

export interface TurnCredentials {
  username: string
  password: string
  ttl: number
  uris: string[]
}

const TTL_SECONDS = 3600

export function generateTurnCredentials(
  userId: string,
  secret: string,
  turnHost: string,
): TurnCredentials {
  const expiry = Math.floor(Date.now() / 1000) + TTL_SECONDS
  const username = `${expiry}:${userId}`
  const password = createHmac('sha1', secret).update(username).digest('base64')

  return {
    username,
    password,
    ttl: TTL_SECONDS,
    uris: [
      `turn:${turnHost}:3478?transport=udp`,
      `turn:${turnHost}:3478?transport=tcp`,
      `stun:${turnHost}:3478`,
    ],
  }
}
