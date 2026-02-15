import bcrypt from 'bcryptjs'
import { pool, ensureTables } from '../_lib/db.js'
import { isStrongEnoughPassword, isValidEmail, makeSixDigitCode, normalizeEmail } from '../_lib/validation.js'
import { sendVerificationCode } from '../_lib/email.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await ensureTables()

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const email = normalizeEmail(body.email || '')
    const password = body.password || ''

    console.log('[AUTH][REGISTER] request', { email, passwordLength: password.length })

    if (!isValidEmail(email)) {
      console.warn('[AUTH][REGISTER] invalid email format', { email })
      return res.status(400).json({ error: 'Mail inválido' })
    }

    if (!isStrongEnoughPassword(password)) {
      console.warn('[AUTH][REGISTER] weak password', { email, passwordLength: password.length })
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' })
    }

    const existing = await pool.query('SELECT id, is_verified FROM users WHERE email = $1', [email])
    if (existing.rows.length > 0 && existing.rows[0].is_verified) {
      console.warn('[AUTH][REGISTER] already verified user', { email })
      return res.status(409).json({ error: 'Ese mail ya está registrado' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const code = makeSixDigitCode()
    const codeHash = await bcrypt.hash(code, 10)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    if (existing.rows.length === 0) {
      await pool.query(
        `
          INSERT INTO users (email, password_hash, is_verified, verification_code_hash, verification_expires_at, name, birth_year)
          VALUES ($1, $2, FALSE, $3, $4, '', NULL)
        `,
        [email, passwordHash, codeHash, expiresAt],
      )
      console.log('[AUTH][REGISTER] user created', { email })
    } else {
      await pool.query(
        `
          UPDATE users
          SET password_hash = $2,
              verification_code_hash = $3,
              verification_expires_at = $4,
              is_verified = FALSE,
              updated_at = NOW()
          WHERE email = $1
        `,
        [email, passwordHash, codeHash, expiresAt],
      )
      console.log('[AUTH][REGISTER] existing unverified user updated', { email })
    }

    await sendVerificationCode(email, code)
    console.log('[AUTH][REGISTER] verification email sent', { email })

    return res.status(200).json({
      ok: true,
      message: 'Código de verificación enviado',
      email,
    })
  } catch (error) {
    console.error('[AUTH][REGISTER] unexpected error', error)
    return res.status(500).json({ error: 'Error interno durante el registro' })
  }
}
