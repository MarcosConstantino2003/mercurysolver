import { pool, ensureTables } from '../_lib/db.js'
import { readSession } from '../_lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  await ensureTables()

  const session = readSession(req)
  if (!session?.userId) {
    return res.status(401).json({ error: 'No autenticado' })
  }

  const result = await pool.query(
    'SELECT email, name, birth_year FROM users WHERE id = $1',
    [session.userId],
  )

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Sesión inválida' })
  }

  const user = result.rows[0]
  return res.status(200).json({
    ok: true,
    user: {
      email: user.email,
      name: user.name || '',
      birthYear: user.birth_year || null,
    },
  })
}
