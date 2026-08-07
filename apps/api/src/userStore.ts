import { query } from './db.js'

// ── Types ──────────────────────────────────────────────────

export interface StoredUser {
  id: string
  fullName: string
  email: string
  planIds: string[]
  password: string
  planExpiresAt?: Record<string, string>
  subscriptionIds?: Record<string, string>
  planCancelledAt?: Record<string, string>
}

interface UserRow {
  id: string
  full_name: string
  email: string
  password: string
  plan_ids: string[]
  plan_expires_at: Record<string, string>
  subscription_ids: Record<string, string>
  plan_cancelled_at: Record<string, string>
}

function rowToUser(row: UserRow): StoredUser {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    password: row.password,
    planIds: row.plan_ids ?? [],
    planExpiresAt: row.plan_expires_at ?? {},
    subscriptionIds: row.subscription_ids ?? {},
    planCancelledAt: row.plan_cancelled_at ?? {},
  }
}

// ── Public API ─────────────────────────────────────────────

export async function listUsers(): Promise<StoredUser[]> {
  const { rows } = await query<UserRow>('SELECT * FROM users ORDER BY id')
  return rows.map(rowToUser)
}

export async function upsertUser(
  data: Partial<StoredUser> & { id: string; email: string },
): Promise<StoredUser> {
  const existing = await findByEmail(data.email)
  const merged: StoredUser = {
    fullName: data.fullName ?? existing?.fullName ?? '',
    planIds: data.planIds ?? existing?.planIds ?? [],
    password: data.password ?? existing?.password ?? '',
    ...existing,
    id: data.id,
    email: data.email,
    ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
    ...(data.planIds !== undefined ? { planIds: data.planIds } : {}),
    ...(data.password !== undefined ? { password: data.password } : {}),
    ...(data.planExpiresAt !== undefined
      ? { planExpiresAt: { ...(existing?.planExpiresAt ?? {}), ...data.planExpiresAt } }
      : {}),
    ...(data.subscriptionIds !== undefined
      ? { subscriptionIds: { ...(existing?.subscriptionIds ?? {}), ...data.subscriptionIds } }
      : {}),
    ...(data.planCancelledAt !== undefined
      ? { planCancelledAt: { ...(existing?.planCancelledAt ?? {}), ...data.planCancelledAt } }
      : {}),
  }

  await query(
    `INSERT INTO users (id, full_name, email, password, plan_ids, plan_expires_at, subscription_ids, plan_cancelled_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       full_name = EXCLUDED.full_name,
       email = EXCLUDED.email,
       password = EXCLUDED.password,
       plan_ids = EXCLUDED.plan_ids,
       plan_expires_at = EXCLUDED.plan_expires_at,
       subscription_ids = EXCLUDED.subscription_ids,
       plan_cancelled_at = EXCLUDED.plan_cancelled_at`,
    [
      merged.id,
      merged.fullName,
      merged.email,
      merged.password,
      JSON.stringify(merged.planIds),
      JSON.stringify(merged.planExpiresAt),
      JSON.stringify(merged.subscriptionIds),
      JSON.stringify(merged.planCancelledAt),
    ],
  )

  return merged
}

export async function removeUser(id: string): Promise<void> {
  await query('DELETE FROM users WHERE id = $1', [id])
}

export async function findByEmail(email: string): Promise<StoredUser | null> {
  const { rows } = await query<UserRow>('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email])
  return rows.length > 0 ? rowToUser(rows[0]) : null
}
