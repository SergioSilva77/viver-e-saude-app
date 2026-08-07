import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { appendFileSync } from 'node:fs'
import type { Plugin } from 'vite'

// ── Internal log file ──────────────────────────────────────
// Receives log entries from the browser via POST /__log__
// and appends them to a local .txt file — never exposed in DevTools.

const LOG_FILE = resolve(__dirname, '.admin-logs.txt')

function appendLog(level: string, message: string, context?: string): void {
  const timestamp = new Date().toISOString()
  const ctx = context ? ` [${context}]` : ''
  const line = `[${timestamp}] ${level.toUpperCase()}${ctx}: ${message}\n`
  appendFileSync(LOG_FILE, line, 'utf-8')
}

function devLogPlugin(): Plugin {
  return {
    name: 'admin-log-writer',
    configureServer(server) {
      server.middlewares.use('/__log__', async (req, res) => {
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

        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString() })
        req.on('end', () => {
          try {
            const entry = JSON.parse(body) as { level?: string; message?: string; context?: string }
            appendLog(entry.level ?? 'info', entry.message ?? '', entry.context)
            res.writeHead(200).end(JSON.stringify({ ok: true }))
          } catch {
            res.writeHead(400).end(JSON.stringify({ error: 'Invalid JSON' }))
          }
        })
      })
    },
  }
}

// ── Vite config ────────────────────────────────────────────

export default defineConfig({
  plugins: [react(), devLogPlugin()],
  resolve: {
    alias: {
      '@viver-saude/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      // Forward /api/* to the local API server in development
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      // Keep dev-store bridge for web app auth plugin (dev only)
      '/__dev__': {
        target: 'http://localhost:5173',
        changeOrigin: true,
      },
    },
  },
})
