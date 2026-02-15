import { pool, ensureTables } from '../_lib/db.js'
import { readSession } from '../_lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  await ensureTables()

  const session = readSession(req)
  if (!session?.userId) {
    return res.status(401).json({ error: 'No autenticado' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : ''
  const birthYear = body.birthYear === null || body.birthYear === '' ? null : Number(body.birthYear)

  if (birthYear !== null && (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > new Date().getFullYear())) {
    return res.status(400).json({ error: 'Año de nacimiento inválido' })
  }

  await pool.query(
    `
      UPDATE users
      SET name = $2,
          birth_year = $3,
          updated_at = NOW()
      WHERE id = $1
    `,
    [session.userId, name, birthYear],
  )

  return res.status(200).json({ ok: true, user: { email: session.email, name, birthYear } })
}
