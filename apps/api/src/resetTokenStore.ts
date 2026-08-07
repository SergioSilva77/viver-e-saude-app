import { randomUUID } from 'node:crypto'
import { query } from './db.js'

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

interface ResetTokenRow {
  token: string
  email: string
  expires_at: string
}

export async function createResetToken(email: string): Promise<string> {
  // Remove expired tokens and previous tokens for this email
  await query('DELETE FROM reset_tokens WHERE expires_at < NOW()')
  await query('DELETE FROM reset_tokens WHERE LOWER(email) = LOWER($1)', [email])

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()

  await query(
    'INSERT INTO reset_tokens (token, email, expires_at) VALUES ($1, $2, $3)',
    [token, email.toLowerCase(), expiresAt],
  )

  return token
}

export async function consumeResetToken(token: string): Promise<string | null> {
  // Purge expired first
  await query('DELETE FROM reset_tokens WHERE expires_at < NOW()')

  const { rows } = await query<ResetTokenRow>(
    'SELECT * FROM reset_tokens WHERE token = $1 LIMIT 1',
    [token],
  )

  if (rows.length === 0) return null

  // One-time use: delete after reading
  await query('DELETE FROM reset_tokens WHERE token = $1', [token])

  return rows[0].email
}
