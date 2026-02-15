import jwt from 'jsonwebtoken'
import { parse, serialize } from 'cookie'

const cookieName = 'ms_auth'

function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET no configurada')
  return secret
}

export function signSession(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' })
}

export function readSession(req) {
  const cookies = parse(req.headers.cookie || '')
  const token = cookies[cookieName]
  if (!token) return null

  try {
    return jwt.verify(token, getJwtSecret())
  } catch {
    return null
  }
}

export function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    serialize(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    }),
  )
}

export function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    serialize(cookieName, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(0),
    }),
  )
}
