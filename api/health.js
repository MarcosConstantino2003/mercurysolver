export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY)

  return res.status(200).json({
    ok: true,
    model,
    geminiConfigured,
    runtime: 'vercel-function',
  })
}
