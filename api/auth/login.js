import bcrypt from 'bcryptjs'
import { pool, ensureTables } from '../_lib/db.js'
import { signSession, setSessionCookie } from '../_lib/auth.js'
import { normalizeEmail } from '../_lib/validation.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await ensureTables()

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const email = normalizeEmail(body.email || '')
    const password = body.password || ''

    console.log('[AUTH][LOGIN] request', { email, passwordLength: password.length })

    const result = await pool.query(
      `
        SELECT id, email, password_hash, is_verified, name, birth_year
        FROM users
        WHERE email = $1
      `,
      [email],
    )

    if (result.rows.length === 0) {
      console.warn('[AUTH][LOGIN] user not found', { email })
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    const user = result.rows[0]
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      console.warn('[AUTH][LOGIN] invalid password', { email })
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    if (!user.is_verified) {
      console.warn('[AUTH][LOGIN] email not verified', { email })
      return res.status(403).json({ error: 'Primero verifica tu mail con el código de 6 dígitos' })
    }

    const token = signSession({ userId: user.id, email: user.email })
    setSessionCookie(res, token)
    console.log('[AUTH][LOGIN] login success', { email, userId: user.id })

    return res.status(200).json({
      ok: true,
      user: {
        email: user.email,
        name: user.name || '',
        birthYear: user.birth_year || null,
      },
    })
  } catch (error) {
    console.error('[AUTH][LOGIN] unexpected error', error)
    return res.status(500).json({ error: 'Error interno durante el login' })
  }
}
