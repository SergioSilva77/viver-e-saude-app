import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import type { IncomingMessage } from 'node:http'
import type { Plugin } from 'vite'

// ── Dev user store ─────────────────────────────────────────
// Shared between web (5173) and admin (5174 → proxy).
// Writes to .dev-users.json so data survives restarts.

const DEV_STORE_PATH = resolve(__dirname, '.dev-users.json')

interface DevUser {
  id: string
  fullName: string
  email: string
  /** Array of granted plan levels. Supersedes legacy planId. */
  planIds: string[]
  password: string
}

function readStore(): DevUser[] {
  try {
    if (!existsSync(DEV_STORE_PATH)) return []
    return JSON.parse(readFileSync(DEV_STORE_PATH, 'utf-8')) as DevUser[]
  } catch {
    return []
  }
}

function writeStore(users: DevUser[]): void {
  writeFileSync(DEV_STORE_PATH, JSON.stringify(users, null, 2), 'utf-8')
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => {
      try { resolve(JSON.parse(body)) } catch { resolve({}) }
    })
  })
}

function devStorePlugin(): Plugin {
  return {
    name: 'dev-user-store',
    configureServer(server) {
      server.middlewares.use('/__dev__/users', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') {
          res.writeHead(204).end()
          return
        }

        if (req.method === 'GET') {
          res.writeHead(200).end(JSON.stringify(readStore()))
          return
        }

        if (req.method === 'POST') {
          const body = await readBody(req) as { id?: string; email?: string; fullName?: string; planIds?: string[]; planId?: string | null; password?: string }
          if (!body.id || !body.email) {
            res.writeHead(400).end(JSON.stringify({ error: 'id e email são obrigatórios.' }))
            return
          }
          const existing = readStore()
          const prev = existing.find((u) => u.id === body.id)
          // Preserve password from existing record if not provided (plan update)
          const password = body.password ?? prev?.password ?? ''
          if (!password) {
            res.writeHead(400).end(JSON.stringify({ error: 'password é obrigatório para novos usuários.' }))
            return
          }
          // Normalize legacy planId to planIds array
          const incomingPlanIds: string[] = Array.isArray(body.planIds)
            ? body.planIds
            : body.planId != null ? [body.planId] : (prev?.planIds ?? [])

          const merged: DevUser = {
            fullName: body.fullName ?? prev?.fullName ?? '',
            ...prev,
            id: body.id,
            email: body.email,
            planIds: incomingPlanIds,
            password,
          }
          const users = existing.filter((u) => u.id !== body.id)
          users.unshift(merged)
          writeStore(users)
          res.writeHead(201).end(JSON.stringify({ ok: true }))
          return
        }

        if (req.method === 'DELETE') {
          const body = await readBody(req) as { id?: string }
          if (body.id) {
            writeStore(readStore().filter((u) => u.id !== body.id))
          }
          res.writeHead(200).end(JSON.stringify({ ok: true }))
          return
        }

        res.writeHead(405).end(JSON.stringify({ error: 'Method not allowed' }))
      })

      server.middlewares.use('/__dev__/auth', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') {
          res.writeHead(204).end()
          return
        }

        if (req.method !== 'POST') {
          res.writeHead(405).end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        const body = await readBody(req) as { email?: string; password?: string }
        const users = readStore()

        if (!users.length) {
          res.writeHead(401).end(JSON.stringify({ error: 'Nenhum usuário cadastrado. Crie um no painel admin.' }))
          return
        }

        const user = users.find((u) => u.email.toLowerCase() === (body.email ?? '').toLowerCase())

        if (!user) {
          res.writeHead(401).end(JSON.stringify({ error: 'E-mail ou senha incorretos.' }))
          return
        }

        if (user.password !== body.password) {
          res.writeHead(401).end(JSON.stringify({ error: 'E-mail ou senha incorretos.' }))
          return
        }

        res.writeHead(200).end(JSON.stringify({
          ok: true,
          userId: user.id,
          email: user.email,
          planIds: user.planIds ?? [],
        }))
      })
    },
  }
}

// ── Vite config ────────────────────────────────────────────

export default defineConfig({
  plugins: [react(), devStorePlugin()],
  resolve: {
    alias: {
      '@viver-saude/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Forward /api/* to the local API server in development
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
