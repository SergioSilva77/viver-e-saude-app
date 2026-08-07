import { query } from './db.js'

// ── Types ──────────────────────────────────────────────────

export type CommunityPlatform = 'whatsapp' | 'telegram' | 'youtube' | 'discord' | 'other'

export interface CommunityLink {
  id: string
  title: string
  platform: CommunityPlatform
  audience: string[]
  href: string
  createdAt: string
}

interface LinkRow {
  id: string
  title: string
  platform: CommunityPlatform
  audience: string[]
  href: string
  created_at: string
}

function rowToLink(row: LinkRow): CommunityLink {
  return {
    id: row.id,
    title: row.title,
    platform: row.platform,
    audience: row.audience ?? [],
    href: row.href,
    createdAt: row.created_at,
  }
}

// ── Public API ─────────────────────────────────────────────

export async function listCommunityLinks(): Promise<CommunityLink[]> {
  const { rows } = await query<LinkRow>('SELECT * FROM community_links ORDER BY created_at DESC')
  return rows.map(rowToLink)
}

export async function upsertCommunityLink(
  data: Omit<CommunityLink, 'createdAt'> & { createdAt?: string },
): Promise<CommunityLink> {
  const existing = await query<LinkRow>(
    'SELECT * FROM community_links WHERE id = $1 LIMIT 1',
    [data.id],
  )
  const now = new Date().toISOString()
  const createdAt = data.createdAt ?? (existing.rows.length > 0 ? existing.rows[0].created_at : now)

  await query(
    `INSERT INTO community_links (id, title, platform, audience, href, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       platform = EXCLUDED.platform,
       audience = EXCLUDED.audience,
       href = EXCLUDED.href`,
    [data.id, data.title, data.platform, JSON.stringify(data.audience), data.href, createdAt],
  )

  return { ...data, createdAt }
}

export async function removeCommunityLink(id: string): Promise<void> {
  await query('DELETE FROM community_links WHERE id = $1', [id])
}
