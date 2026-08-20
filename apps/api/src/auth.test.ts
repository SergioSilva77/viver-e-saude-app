import { describe, it, expect } from 'vitest'
import { signUserToken, verifyUserToken } from './auth.js'

describe('auth (JWT de usuário)', () => {
  it('assina e verifica um token válido, preservando o payload', () => {
    const token = signUserToken({ sub: 'user-123', role: 'user', tokenVersion: 0 })
    const payload = verifyUserToken(token)

    expect(payload.sub).toBe('user-123')
    expect(payload.role).toBe('user')
    expect(payload.tokenVersion).toBe(0)
  })

  it('preserva o papel de consultor no token', () => {
    const token = signUserToken({ sub: 'consultant-1', role: 'consultant', tokenVersion: 2 })
    const payload = verifyUserToken(token)

    expect(payload.role).toBe('consultant')
    expect(payload.tokenVersion).toBe(2)
  })

  it('rejeita um token adulterado', () => {
    const token = signUserToken({ sub: 'user-123', role: 'user', tokenVersion: 0 })
    const tampered = token.slice(0, -2) + 'xx'

    expect(() => verifyUserToken(tampered)).toThrow()
  })

  it('rejeita um token completamente inválido', () => {
    expect(() => verifyUserToken('nao-e-um-jwt')).toThrow()
  })
})
