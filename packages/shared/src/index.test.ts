import { describe, expect, it } from 'vitest'

import { canAccessSection, resolveOnboardingDecision } from './index'

describe('shared access rules', () => {
  it('blocks community for level 1 users', () => {
    expect(canAccessSection('nivel1', 'comunidade')).toBe(false)
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
