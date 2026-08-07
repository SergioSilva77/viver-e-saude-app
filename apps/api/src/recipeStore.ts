import { query } from './db.js'

// ── Types ──────────────────────────────────────────────────

export interface Recipe {
  id: string
  title: string
  description: string
  content: string
  audience: string[]
  createdAt: string
  updatedAt: string
}

export type RecipeMeta = Omit<Recipe, 'content'>

interface RecipeRow {
  id: string
  title: string
  description: string
  content: string
  audience: string[]
  created_at: string
  updated_at: string
}

function rowToRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    content: row.content,
    audience: row.audience ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ── Public API ─────────────────────────────────────────────

export async function listRecipes(): Promise<Recipe[]> {
  const { rows } = await query<RecipeRow>('SELECT * FROM recipes ORDER BY created_at DESC')
  return rows.map(rowToRecipe)
}

export async function listRecipesMeta(): Promise<RecipeMeta[]> {
  const { rows } = await query<RecipeRow>('SELECT * FROM recipes ORDER BY created_at DESC')
  return rows.map((r) => {
    const { content: _c, ...meta } = rowToRecipe(r)
    return meta
  })
}

export async function getRecipeById(id: string): Promise<Recipe | undefined> {
  const { rows } = await query<RecipeRow>('SELECT * FROM recipes WHERE id = $1 LIMIT 1', [id])
  return rows.length > 0 ? rowToRecipe(rows[0]) : undefined
}

export async function upsertRecipe(
  data: Omit<Recipe, 'createdAt' | 'updatedAt'> & { createdAt?: string },
): Promise<Recipe> {
  const existing = await getRecipeById(data.id)
  const now = new Date().toISOString()
  const createdAt = data.createdAt ?? existing?.createdAt ?? now

  await query(
    `INSERT INTO recipes (id, title, description, content, audience, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       content = EXCLUDED.content,
       audience = EXCLUDED.audience,
       updated_at = EXCLUDED.updated_at`,
    [data.id, data.title, data.description, data.content, JSON.stringify(data.audience), createdAt, now],
  )

  return { ...data, createdAt, updatedAt: now }
}

export async function removeRecipe(id: string): Promise<void> {
  await query('DELETE FROM recipes WHERE id = $1', [id])
}
