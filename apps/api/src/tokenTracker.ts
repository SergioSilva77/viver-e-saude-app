import { query } from './db.js'

// ── Types ──────────────────────────────────────────────────

export interface TokenRecord {
  userId: string
  userEmail: string
  date: string
  inputTokens: number
  outputTokens: number
  provider: string
  model: string
}

export interface UserTokenStats {
  userId: string
  userEmail: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  requestCount: number
  lastUsedAt: string
  byModel: ModelStats[]
}

export interface ModelStats {
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  requestCount: number
  lastUsedAt: string
}

export interface TokenUsageStats {
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  quota: number | null
  remainingTokens: number | null
  requestCount: number
  byUser: UserTokenStats[]
  byModel: ModelStats[]
  recentRecords: TokenRecord[]
}

interface TokenRow {
  user_id: string
  user_email: string
  date: string
  input_tokens: number
  output_tokens: number
  provider: string
  model: string
}

// ── Public API ─────────────────────────────────────────────

const MAX_RECORDS = 10_000
const RECENT_RECORDS = 50

export async function recordUsage(record: TokenRecord): Promise<void> {
  await query(
    `INSERT INTO token_usage (user_id, user_email, date, input_tokens, output_tokens, provider, model)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [record.userId, record.userEmail, record.date, record.inputTokens, record.outputTokens, record.provider, record.model],
  )

  // Evict oldest records if over limit
  const { rows } = await query<{ cnt: string }>('SELECT COUNT(*)::text AS cnt FROM token_usage')
  const count = parseInt(rows[0].cnt, 10)
  if (count > MAX_RECORDS) {
    await query(
      `DELETE FROM token_usage WHERE id NOT IN (
        SELECT id FROM token_usage ORDER BY date DESC LIMIT $1
      )`,
      [MAX_RECORDS],
    )
  }
}

export async function getQuota(): Promise<number | null> {
  const { rows } = await query<{ value: any }>("SELECT value FROM config WHERE key = 'token_quota' LIMIT 1")
  return rows.length > 0 ? (rows[0].value as number) : null
}

export async function setQuota(quota: number | null): Promise<void> {
  await query(
    `INSERT INTO config (key, value) VALUES ('token_quota', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(quota)],
  )
}

export async function getUsageStats(): Promise<TokenUsageStats> {
  const quota = await getQuota()

  const { rows: records } = await query<TokenRow>('SELECT * FROM token_usage ORDER BY date DESC')
  const { rows: totalRow } = await query<{ ti: string; to_: string }>(
    'SELECT COALESCE(SUM(input_tokens),0)::text AS ti, COALESCE(SUM(output_tokens),0)::text AS to_ FROM token_usage',
  )
  const { rows: countRow } = await query<{ cnt: string }>('SELECT COUNT(*)::text AS cnt FROM token_usage')

  const totalInputTokens = parseInt(totalRow[0].ti, 10)
  const totalOutputTokens = parseInt(totalRow[0].to_, 10)
  const totalTokens = totalInputTokens + totalOutputTokens
  const requestCount = parseInt(countRow[0].cnt, 10)

  // Per-user aggregation
  const userMap = new Map<string, { stats: UserTokenStats; modelMap: Map<string, ModelStats> }>()
  const globalModelMap = new Map<string, ModelStats>()

  for (const r of records) {
    upsertModelStats(globalModelMap, r)

    const entry = userMap.get(r.user_id)
    if (entry) {
      entry.stats.inputTokens += r.input_tokens
      entry.stats.outputTokens += r.output_tokens
      entry.stats.totalTokens += r.input_tokens + r.output_tokens
      entry.stats.requestCount += 1
      if (r.date > entry.stats.lastUsedAt) entry.stats.lastUsedAt = r.date
      upsertModelStats(entry.modelMap, r)
    } else {
      const modelMap = new Map<string, ModelStats>()
      upsertModelStats(modelMap, r)
      userMap.set(r.user_id, {
        stats: {
          userId: r.user_id,
          userEmail: r.user_email,
          inputTokens: r.input_tokens,
          outputTokens: r.output_tokens,
          totalTokens: r.input_tokens + r.output_tokens,
          requestCount: 1,
          lastUsedAt: r.date,
          byModel: [],
        },
        modelMap,
      })
    }
  }

  const byUser: UserTokenStats[] = [...userMap.values()]
    .map(({ stats, modelMap }) => ({
      ...stats,
      byModel: [...modelMap.values()].sort((a, b) => b.totalTokens - a.totalTokens),
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens)

  const recentRecords: TokenRecord[] = records.slice(0, RECENT_RECORDS).map((r) => ({
    userId: r.user_id,
    userEmail: r.user_email,
    date: r.date,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    provider: r.provider,
    model: r.model,
  }))

  return {
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    quota,
    remainingTokens: quota !== null ? Math.max(0, quota - totalTokens) : null,
    requestCount,
    byUser,
    byModel: [...globalModelMap.values()].sort((a, b) => b.totalTokens - a.totalTokens),
    recentRecords,
  }
}

function modelKey(provider: string, model: string): string {
  return `${provider}::${model}`
}

function upsertModelStats(map: Map<string, ModelStats>, r: TokenRow): void {
  const key = modelKey(r.provider, r.model)
  const existing = map.get(key)
  const delta = r.input_tokens + r.output_tokens

  if (existing) {
    existing.inputTokens += r.input_tokens
    existing.outputTokens += r.output_tokens
    existing.totalTokens += delta
    existing.requestCount += 1
    if (r.date > existing.lastUsedAt) existing.lastUsedAt = r.date
  } else {
    map.set(key, {
      provider: r.provider,
      model: r.model,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
      totalTokens: delta,
      requestCount: 1,
      lastUsedAt: r.date,
    })
  }
}
