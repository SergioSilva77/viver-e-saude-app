import { query } from './db.js'
import type { UserRole } from './userStore.js'

// ── Tabela consultant_profiles ──────────────────────────────
// Guarda os dados específicos de quem é consultor (especialidade,
// bio, status de presença). Nome/foto continuam vindo de `users`.

export type ConsultantStatus = 'offline' | 'online' | 'in_call'

export interface ConsultantProfile {
  userId: string
  specialty: string
  bio: string
  status: ConsultantStatus
  maxConcurrentUsers: number
  updatedAt: string
}

interface ConsultantProfileRow {
  user_id: string
  specialty: string
  bio: string
  status: ConsultantStatus
  max_concurrent_users: number
  updated_at: string
}

function rowToProfile(row: ConsultantProfileRow): ConsultantProfile {
  return {
    userId: row.user_id,
    specialty: row.specialty ?? '',
    bio: row.bio ?? '',
    status: row.status ?? 'offline',
    maxConcurrentUsers: row.max_concurrent_users ?? 1,
    updatedAt: row.updated_at,
  }
}

/** Define o papel do usuário (user/consultant). Se virar consultor, garante que exista um consultant_profiles. */
export async function setUserRole(
  userId: string,
  role: UserRole,
  data?: { specialty?: string; bio?: string },
): Promise<void> {
  await query('UPDATE users SET role = $1 WHERE id = $2', [role, userId])

  if (role === 'consultant') {
    await query(
      `INSERT INTO consultant_profiles (user_id, specialty, bio)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET
         specialty = COALESCE($2, consultant_profiles.specialty),
         bio = COALESCE($3, consultant_profiles.bio),
         updated_at = NOW()`,
      [userId, data?.specialty ?? '', data?.bio ?? ''],
    )
  }
}

export async function listConsultants(): Promise<
  Array<{ userId: string; fullName: string; email: string; photoUrl: string; profile: ConsultantProfile }>
> {
  const { rows } = await query<{
    id: string
    full_name: string
    email: string
    photo_url: string
    user_id: string
    specialty: string
    bio: string
    status: ConsultantStatus
    max_concurrent_users: number
    updated_at: string
  }>(
    `SELECT u.id, u.full_name, u.email, u.photo_url,
            cp.user_id, cp.specialty, cp.bio, cp.status, cp.max_concurrent_users, cp.updated_at
     FROM users u
     JOIN consultant_profiles cp ON cp.user_id = u.id
     WHERE u.role = 'consultant'
     ORDER BY u.full_name`,
  )

  return rows.map((row) => ({
    userId: row.id,
    fullName: row.full_name,
    email: row.email,
    photoUrl: row.photo_url ?? '',
    profile: rowToProfile(row as unknown as ConsultantProfileRow),
  }))
}

export async function getConsultantProfile(userId: string): Promise<ConsultantProfile | null> {
  const { rows } = await query<ConsultantProfileRow>(
    'SELECT * FROM consultant_profiles WHERE user_id = $1 LIMIT 1',
    [userId],
  )
  return rows.length > 0 ? rowToProfile(rows[0]) : null
}

/** Mapa userId -> perfil, usado para enriquecer listagens (ex: GET /api/admin/users). */
export async function getAllConsultantProfilesMap(): Promise<Record<string, ConsultantProfile>> {
  const { rows } = await query<ConsultantProfileRow>('SELECT * FROM consultant_profiles')
  const map: Record<string, ConsultantProfile> = {}
  for (const row of rows) {
    map[row.user_id] = rowToProfile(row)
  }
  return map
}

export async function setConsultantStatus(userId: string, status: ConsultantStatus): Promise<void> {
  await query(
    'UPDATE consultant_profiles SET status = $1, updated_at = NOW() WHERE user_id = $2',
    [status, userId],
  )
}
