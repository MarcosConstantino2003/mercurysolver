import bcrypt from 'bcryptjs'
import { pool, ensureTables } from '../_lib/db.js'
import { normalizeEmail } from '../_lib/validation.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  await ensureTables()

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const email = normalizeEmail(body.email || '')
  const code = String(body.code || '').trim()

  if (!email || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Código inválido' })
  }

  const userResult = await pool.query(
    'SELECT id, verification_code_hash, verification_expires_at FROM users WHERE email = $1',
    [email],
  )

  if (userResult.rows.length === 0) {
    return res.status(404).json({ error: 'Usuario no encontrado' })
  }

  const user = userResult.rows[0]
  if (!user.verification_code_hash || !user.verification_expires_at) {
    return res.status(400).json({ error: 'No hay verificación pendiente' })
  }

  if (new Date(user.verification_expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: 'El código expiró' })
  }

  const valid = await bcrypt.compare(code, user.verification_code_hash)
  if (!valid) {
    return res.status(400).json({ error: 'Código incorrecto' })
  }

  await pool.query(
    `
      UPDATE users
      SET is_verified = TRUE,
          verification_code_hash = NULL,
          verification_expires_at = NULL,
          updated_at = NOW()
      WHERE id = $1
    `,
    [user.id],
  )

  return res.status(200).json({ ok: true, message: 'Cuenta verificada correctamente' })
}
