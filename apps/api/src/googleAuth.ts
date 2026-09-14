import { OAuth2Client, type TokenPayload } from 'google-auth-library'

const DEFAULT_CLIENT_IDS = [
  // Web (GIS) + serverClientId do app Flutter
  '886426639076-k402g862lsjr5ql76vpefovl9arlmgb2.apps.googleusercontent.com',
  // Android (release / debug hashes no google-services.json)
  '886426639076-kijvjfab31hkoutme9dvn2pjl60e6ugn.apps.googleusercontent.com',
  '886426639076-q6rgjt50c6ikd3p495mekv692klime2q.apps.googleusercontent.com',
]

function audienceList(): string[] {
  const extra = (process.env.GOOGLE_CLIENT_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  return [...new Set([...DEFAULT_CLIENT_IDS, ...extra])]
}

const client = new OAuth2Client()

export interface GoogleIdentity {
  email: string
  fullName: string
  photoUrl: string
  googleId: string
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: audienceList(),
  })
  const payload = ticket.getPayload()
  if (!payload) {
    throw new Error('Token do Google inválido.')
  }
  return fromPayload(payload)
}

export async function verifyGoogleAccessToken(accessToken: string): Promise<GoogleIdentity> {
  const tokenInfoUrl = new URL('https://oauth2.googleapis.com/tokeninfo')
  tokenInfoUrl.searchParams.set('access_token', accessToken)
  const tokenInfoRes = await fetch(tokenInfoUrl)
  if (!tokenInfoRes.ok) {
    throw new Error('Token do Google inválido.')
  }
  const tokenInfo = await tokenInfoRes.json() as {
    aud?: string
    azp?: string
    audience?: string
    issued_to?: string
    email?: string
    email_verified?: boolean | string
    sub?: string
  }
  const allowed = audienceList()
  const audience = tokenInfo.aud || tokenInfo.azp || tokenInfo.audience || tokenInfo.issued_to
  if (!audience || !allowed.includes(audience)) {
    throw new Error('Token do Google inválido.')
  }

  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!userInfoRes.ok) {
    throw new Error('Token do Google inválido.')
  }
  const userInfo = await userInfoRes.json() as {
    email?: string
    email_verified?: boolean | string
    name?: string
    picture?: string
    sub?: string
  }
  const email = (userInfo.email || tokenInfo.email || '').trim().toLowerCase()
  const verified = userInfo.email_verified ?? tokenInfo.email_verified
  if (!email || verified === false || verified === 'false') {
    throw new Error('A conta Google não possui um e-mail verificado.')
  }
  return {
    email,
    fullName: (userInfo.name ?? email.split('@')[0] ?? 'Usuário').trim().slice(0, 100) || 'Usuário',
    photoUrl: userInfo.picture ?? '',
    googleId: userInfo.sub || tokenInfo.sub || email,
  }
}

function fromPayload(payload: TokenPayload): GoogleIdentity {
  const email = payload.email?.trim().toLowerCase()
  if (!email || payload.email_verified === false) {
    throw new Error('A conta Google não possui um e-mail verificado.')
  }
  return {
    email,
    fullName: (payload.name ?? email.split('@')[0] ?? 'Usuário').trim().slice(0, 100) || 'Usuário',
    photoUrl: payload.picture ?? '',
    googleId: payload.sub,
  }
}
