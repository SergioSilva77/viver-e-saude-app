// ── Internal logger ────────────────────────────────────────
// Sends log entries to the Vite dev server (/__log__) which
// writes them to .admin-logs.txt on disk.
// Nothing is printed to the browser console or DevTools.

type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  context?: string
}

async function send(entry: LogEntry): Promise<void> {
  try {
    await fetch('/__log__', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    })
  } catch {
    // Silently discard — logging must never throw or surface to the user
  }
}

export const logger = {
  info: (message: string, context?: string) => send({ level: 'info', message, context }),
  warn: (message: string, context?: string) => send({ level: 'warn', message, context }),
  error: (message: string, context?: string) => send({ level: 'error', message, context }),
}
