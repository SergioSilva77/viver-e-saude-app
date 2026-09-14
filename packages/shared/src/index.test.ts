import { describe, expect, it } from 'vitest'

import { canAccessSection, resolveOnboardingDecision } from './index'

describe('shared access rules', () => {
  it('opens community and recipes tabs for any subscriber (items filter by audience)', () => {
    expect(canAccessSection('nivel1', 'comunidade')).toBe(true)
    expect(canAccessSection('nivel1', 'receitas')).toBe(true)
  })

  it('keeps consultor locked without a plan and free for subscribers', () => {
    expect(canAccessSection(null, 'consultor')).toBe(false)
    expect(canAccessSection('nivel1', 'consultor')).toBe(true)
  })

  it('keeps MeuGuardião available on the free tier', () => {
    expect(canAccessSection(null, 'meuguardiao')).toBe(true)
  })

  it('redirects unpaid users to checkout', () => {
    expect(
      resolveOnboardingDecision({
        planId: 'nivel1',
        paymentConfirmed: false,
        subscriptionActive: false,
      }).nextStep,
    ).toBe('checkout')
  })
})
