import bcrypt from 'bcryptjs'
import { pool, ensureTables } from '../_lib/db.js'
import { readSession } from '../_lib/auth.js'
import { isStrongEnoughPassword } from '../_lib/validation.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  await ensureTables()

  const session = readSession(req)
  if (!session?.userId) {
    return res.status(401).json({ error: 'No autenticado' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const currentPassword = body.currentPassword || ''
  const newPassword = body.newPassword || ''

  if (!isStrongEnoughPassword(newPassword)) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' })
  }

  const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [session.userId])
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Usuario no encontrado' })
  }

  const isValidCurrent = await bcrypt.compare(currentPassword, result.rows[0].password_hash)
  if (!isValidCurrent) {
    return res.status(400).json({ error: 'Contraseña actual incorrecta' })
  }

  const newHash = await bcrypt.hash(newPassword, 12)
  await pool.query('UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1', [session.userId, newHash])

  return res.status(200).json({ ok: true, message: 'Contraseña actualizada' })
}
