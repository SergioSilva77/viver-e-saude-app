import Stripe from 'stripe'
import { getPlan, plans, type PlanId } from '@viver-saude/shared'

import { config, getStripeConfig, hasStripeConfig } from './config.js'
import { findByEmail, upsertUser, listUsers } from './userStore.js'
import { sendRegistrationLink } from './emailService.js'

type RegisterIntentInput = {
  email: string
  password: string
  fullName: string
  planId: PlanId
}

export function getStripeClient(): Stripe {
  const { secretKey } = getStripeConfig()
  if (!secretKey) {
    throw new Error('As credenciais do Stripe ainda não foram configuradas.')
  }
  return new Stripe(secretKey)
}

export async function registerPendingUser(input: RegisterIntentInput) {
  return {
    persisted: false,
    mode: 'local' as const,
    message: 'Cadastro será processado após pagamento.',
  }
}

export async function createCheckoutSession(planId: PlanId, customerEmail?: string, customerFullName?: string) {
  const stripe = getStripeClient()
  const stripeConf = getStripeConfig()
  const plan = getPlan(planId)
  const mode = plan.billingInterval === 'monthly' ? 'subscription' : 'payment'
  const configuredPriceId = stripeConf[`priceId${planId.charAt(0).toUpperCase()}${planId.slice(1)}` as keyof typeof stripeConf] as string

  return stripe.checkout.sessions.create({
    mode,
    ...(customerEmail ? { customer_email: customerEmail } : {}),
    success_url: `${config.appUrl}/?checkout=success&plan=${planId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${config.appUrl}/?checkout=cancelled`,
    metadata: {
      planId,
      app: 'viver-saude',
      ...(customerFullName ? { fullName: customerFullName } : {}),
    },
    ...(configuredPriceId
      ? {
          line_items: [{ price: configuredPriceId, quantity: 1 }],
        }
      : {
          line_items: [
            {
              price_data: {
                currency: 'brl',
                product_data: {
                  name: plan.label,
                  description: plan.description,
                },
                recurring: plan.billingInterval === 'monthly' ? { interval: 'month' } : undefined,
                unit_amount: plan.priceInCents,
              },
              quantity: 1,
            },
          ],
        }),
  })
}

// ── Expiry helpers ─────────────────────────────────────────

function calcPlanExpiry(planId: PlanId): string | null {
  const plan = getPlan(planId)
  if (plan.billingInterval === 'one_time') return null
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30)
  return expiresAt.toISOString()
}

// ── Webhook handler ────────────────────────────────────────

export async function applyWebhookCheckoutCompleted(session: Stripe.Checkout.Session) {
  const email = session.customer_details?.email ?? session.customer_email

  if (!email) {
    throw new Error('Sessão do Stripe sem email associado.')
  }

  const planId = (session.metadata?.planId as PlanId | undefined) ?? 'nivel1'
  const fullName = (session.metadata?.fullName as string | undefined) ?? session.customer_details?.name ?? 'Cliente'
  const expiresAt = calcPlanExpiry(planId)

  // ── 1. Update local PostgreSQL users ──
  const localUser = await findByEmail(email)
  if (localUser) {
    const updatedPlanIds = localUser.planIds.includes(planId)
      ? localUser.planIds
      : [...localUser.planIds, planId]

    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null

    const updatedCancelledAt = { ...(localUser.planCancelledAt ?? {}) }
    delete updatedCancelledAt[planId]

    await upsertUser({
      id: localUser.id,
      email: localUser.email,
      planIds: updatedPlanIds,
      planExpiresAt: expiresAt ? { [planId]: expiresAt } : undefined,
      subscriptionIds: subscriptionId ? { [planId]: subscriptionId } : undefined,
      planCancelledAt: updatedCancelledAt,
    })
  }

  // ── 2. Send registration e-mail (fire-and-forget) ────────
  if (!localUser) {
    setImmediate(() => {
      sendRegistrationLink({
        to: email,
        fullName,
        sessionId: session.id,
        planId,
      }).catch(() => { /* already logged inside sendRegistrationLink */ })
    })
  }

  return {
    persisted: localUser !== null,
    message: localUser
      ? 'Pagamento confirmado e acesso liberado.'
      : 'Webhook recebido. E-mail de ativação enviado (se SMTP configurado).',
  }
}

/**
 * Called when Stripe fires `customer.subscription.deleted`.
 * Removes the cancelled plan from the user's active plan list.
 */
export async function applyWebhookSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id

  if (!customerId) return { skipped: true, reason: 'No customer ID in subscription event.' }

  const users = await listUsers()
  const user = users.find((u) =>
    Object.values(u.subscriptionIds ?? {}).includes(subscription.id)
  )

  if (!user) return { skipped: true, reason: 'No user found with this subscription ID.' }

  const planId = Object.entries(user.subscriptionIds ?? {}).find(
    ([, subId]) => subId === subscription.id
  )?.[0]

  if (!planId) return { skipped: true, reason: 'Could not map subscription to a plan.' }

  const updatedPlanIds = user.planIds.filter((id) => id !== planId)
  const updatedSubscriptionIds = { ...(user.subscriptionIds ?? {}) }
  delete updatedSubscriptionIds[planId]
  const updatedCancelledAt = { ...(user.planCancelledAt ?? {}) }
  delete updatedCancelledAt[planId]
  const updatedPlanExpiresAt = { ...(user.planExpiresAt ?? {}) }
  delete updatedPlanExpiresAt[planId]

  await upsertUser({
    id: user.id,
    email: user.email,
    planIds: updatedPlanIds,
    subscriptionIds: updatedSubscriptionIds,
    planCancelledAt: updatedCancelledAt,
    planExpiresAt: updatedPlanExpiresAt,
  })

  return { ok: true, userId: user.id, planId, message: `Plano ${planId} removido após cancelamento no Stripe.` }
}

/**
 * Cancels a Stripe subscription at period end.
 * Returns the period end date so the frontend can display it.
 */
export async function cancelSubscriptionAtPeriodEnd(userId: string, planId: string): Promise<{ cancelAt: string }> {
  const users = await listUsers()
  const user = users.find((u) => u.id === userId)

  if (!user) throw new Error('Usuário não encontrado.')

  const subscriptionId = user.subscriptionIds?.[planId]
  if (!subscriptionId) {
    throw new Error(
      'Este plano não possui assinatura recorrente no Stripe. ' +
      'Se foi criado manualmente, remova o acesso pelo painel administrativo.'
    )
  }

  const stripe = getStripeClient()
  await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end
    ?? subscription.items?.data?.[0]?.current_period_end
    ?? Math.floor(Date.now() / 1000) + 30 * 86400

  const cancelAt = new Date(periodEnd * 1000).toISOString()

  await upsertUser({
    id: user.id,
    email: user.email,
    planCancelledAt: { [planId]: cancelAt },
  })

  return { cancelAt }
}

export function getCatalog() {
  return plans.map((plan) => ({
    ...plan,
    formattedPrice: (plan.priceInCents / 100).toFixed(2).replace('.', ','),
  }))
}
