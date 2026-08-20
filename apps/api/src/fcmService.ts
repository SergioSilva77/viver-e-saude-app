import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { App, ServiceAccount } from 'firebase-admin/app'

// ── Firebase Cloud Messaging (push notifications) — Módulo 4 ──
// Mesmo padrão de configuração já usado no projeto (.ai-config.json,
// .stripe-config.json): lê um arquivo de credenciais do cwd do processo.
// Se o arquivo não existir, o envio de push é silenciosamente desativado
// (o app continua funcionando 100% com notificações in-app) até alguém
// colocar o arquivo e reiniciar a API.

const SERVICE_ACCOUNT_PATH = resolve(process.cwd(), '.firebase-service-account.json')

let cachedApp: App | null | undefined // undefined = ainda não tentou

function readServiceAccount(): ServiceAccount | null {
  // Prioridade: variável de ambiente (JSON inteiro) → arquivo no cwd → não configurado.
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (fromEnv) {
    try {
      return JSON.parse(fromEnv) as ServiceAccount
    } catch {
      console.error('[FCM] FIREBASE_SERVICE_ACCOUNT_JSON inválido (não é um JSON válido).')
    }
  }
  if (existsSync(SERVICE_ACCOUNT_PATH)) {
    try {
      return JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8')) as ServiceAccount
    } catch {
      console.error('[FCM] .firebase-service-account.json inválido (não é um JSON válido).')
    }
  }
  return null
}

async function getApp(): Promise<App | null> {
  if (cachedApp !== undefined) return cachedApp

  const serviceAccount = readServiceAccount()
  if (!serviceAccount) {
    console.warn('[FCM] Não configurado — notificações push (FCM) desativadas. Notificações in-app continuam funcionando normalmente.')
    cachedApp = null
    return null
  }

  try {
    const { initializeApp, cert } = await import('firebase-admin/app')
    cachedApp = initializeApp({ credential: cert(serviceAccount) })
    console.log('[FCM] Configurado e pronto para enviar notificações push.')
    return cachedApp
  } catch (err) {
    console.error('[FCM] Falha ao inicializar Firebase Admin:', err instanceof Error ? err.message : err)
    cachedApp = null
    return null
  }
}

export async function isFcmConfigured(): Promise<boolean> {
  return (await getApp()) !== null
}

export interface PushPayload {
  title: string
  body: string
  data?: Record<string, string>
}

/**
 * Envia uma notificação push para uma lista de tokens de dispositivo.
 * Retorna os tokens que falharam (ex: desinstalado/expirado) para o
 * chamador poder removê-los do banco — nunca lança erro (best-effort).
 */
export async function sendPushToTokens(tokens: string[], payload: PushPayload): Promise<{ invalidTokens: string[] }> {
  if (tokens.length === 0) return { invalidTokens: [] }

  const app = await getApp()
  if (!app) return { invalidTokens: [] }

  try {
    const { getMessaging } = await import('firebase-admin/messaging')
    const response = await getMessaging(app).sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data ?? {},
      android: { priority: 'high' },
    })

    const invalidTokens: string[] = []
    response.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code ?? ''
        if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
          invalidTokens.push(tokens[i])
        }
        console.warn('[FCM] Falha ao enviar para um token:', r.error?.message)
      }
    })
    return { invalidTokens }
  } catch (err) {
    console.error('[FCM] Erro ao enviar push:', err instanceof Error ? err.message : err)
    return { invalidTokens: [] }
  }
}
