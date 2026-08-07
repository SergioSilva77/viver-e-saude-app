import pg from 'pg'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/viversaude'
const API_DIR = resolve(process.cwd(), 'apps/api')

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL })

  console.log('[migrate] Conectando ao PostgreSQL...')
  await pool.query('SELECT 1')
  console.log('[migrate] Conectado!')

  // ── Users ────────────────────────────────────────────────
  const usersPath = resolve(API_DIR, 'users.json')
  try {
    const users = JSON.parse(readFileSync(usersPath, 'utf-8'))
    console.log(`[migrate] Importando ${users.length} usuário(s)...`)
    for (const u of users) {
      await pool.query(
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
          u.id,
          u.fullName ?? '',
          u.email,
          u.password ?? '',
          JSON.stringify(u.planIds ?? []),
          JSON.stringify(u.planExpiresAt ?? {}),
          JSON.stringify(u.subscriptionIds ?? {}),
          JSON.stringify(u.planCancelledAt ?? {}),
        ],
      )
    }
    console.log('[migrate] Usuários OK!')
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log('[migrate] users.json não encontrado, pulando...')
    } else {
      throw e
    }
  }

  // ── Community links ──────────────────────────────────────
  const linksPath = resolve(API_DIR, 'community-links.json')
  try {
    const links = JSON.parse(readFileSync(linksPath, 'utf-8'))
    console.log(`[migrate] Importando ${links.length} link(s) da comunidade...`)
    for (const l of links) {
      await pool.query(
        `INSERT INTO community_links (id, title, platform, audience, href, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           platform = EXCLUDED.platform,
           audience = EXCLUDED.audience,
           href = EXCLUDED.href`,
        [l.id, l.title, l.platform, JSON.stringify(l.audience ?? []), l.href, l.createdAt ?? new Date().toISOString()],
      )
    }
    console.log('[migrate] Links da comunidade OK!')
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log('[migrate] community-links.json não encontrado, pulando...')
    } else {
      throw e
    }
  }

  // ── Recipes ──────────────────────────────────────────────
  const recipesPath = resolve(API_DIR, 'recipes.json')
  try {
    const recipes = JSON.parse(readFileSync(recipesPath, 'utf-8'))
    console.log(`[migrate] Importando ${recipes.length} receita(s)...`)
    for (const r of recipes) {
      await pool.query(
        `INSERT INTO recipes (id, title, description, content, audience, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           content = EXCLUDED.content,
           audience = EXCLUDED.audience,
           updated_at = EXCLUDED.updated_at`,
        [r.id, r.title, r.description ?? '', r.content, JSON.stringify(r.audience ?? []), r.createdAt ?? new Date().toISOString(), r.updatedAt ?? new Date().toISOString()],
      )
    }
    console.log('[migrate] Receitas OK!')
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log('[migrate] recipes.json não encontrado, pulando...')
    } else {
      throw e
    }
  }

  // ── Token usage ──────────────────────────────────────────
  const tokenPath = resolve(API_DIR, 'token-usage.json')
  try {
    const tokenData = JSON.parse(readFileSync(tokenPath, 'utf-8'))
    const records = tokenData.records ?? []
    console.log(`[migrate] Importando ${records.length} registro(s) de tokens...`)
    for (const r of records) {
      await pool.query(
        `INSERT INTO token_usage (user_id, user_email, date, input_tokens, output_tokens, provider, model)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [r.userId, r.userEmail, r.date, r.inputTokens, r.outputTokens, r.provider, r.model],
      )
    }
    // Migrate quota
    if (tokenData.quota !== undefined && tokenData.quota !== null) {
      await pool.query(
        `INSERT INTO config (key, value) VALUES ('token_quota', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [JSON.stringify(tokenData.quota)],
      )
    }
    console.log('[migrate] Tokens OK!')
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log('[migrate] token-usage.json não encontrado, pulando...')
    } else {
      throw e
    }
  }

  await pool.end()
  console.log('[migrate] Migração concluída com sucesso!')
}

main().catch((err) => {
  console.error('[migrate] ERRO:', err.message)
  process.exit(1)
})
