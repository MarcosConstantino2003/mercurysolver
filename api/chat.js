import { GoogleGenAI } from '@google/genai'

const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

function toContents(history, textMessage, attachments) {
  const contents = []

  for (const chatMessage of history) {
    if (!chatMessage || typeof chatMessage.text !== 'string' || !chatMessage.text.trim()) continue

    contents.push({
      role: chatMessage.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: chatMessage.text.trim() }],
    })
  }

  const userParts = []

  if (textMessage) {
    userParts.push({ text: textMessage })
  }

  for (const attachment of attachments) {
    if (
      !attachment ||
      typeof attachment.data !== 'string' ||
      !attachment.data ||
      typeof attachment.mimeType !== 'string' ||
      !attachment.mimeType
    ) {
      continue
    }

    userParts.push({
      inlineData: {
        mimeType: attachment.mimeType,
        data: attachment.data,
      },
    })
  }

  return [...contents, { role: 'user', parts: userParts }]
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no configurada en Vercel' })
  }

  let body = {}

  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  } catch {
    return res.status(400).json({ error: 'Body JSON inválido' })
  }

  const { message, history, attachments } = body

  const normalizedHistory = Array.isArray(history) ? history : []
  const normalizedAttachments = Array.isArray(attachments) ? attachments : []
  const textMessage = typeof message === 'string' ? message.trim() : ''

  if (!textMessage && normalizedAttachments.length === 0) {
    return res.status(400).json({ error: 'Mensaje o adjuntos requeridos' })
  }

  const ai = new GoogleGenAI({ apiKey })
  const contents = toContents(normalizedHistory, textMessage, normalizedAttachments)

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
    })

    const text = response.text?.trim() || 'No pude generar una respuesta en este momento.'
    return res.status(200).json({ text })
  } catch (error) {
    if (error?.status === 429) {
      return res.status(429).json({
        error: 'Gemini devolvió quota exceeded (429). Revisa facturación/cuotas o cambia GEMINI_MODEL en .env.',
      })
    }

    if (error?.status === 400) {
      return res.status(400).json({
        error: 'Solicitud inválida para Gemini. Verifica modelo y formato de adjuntos.',
      })
    }

    return res.status(500).json({ error: 'Error consultando Gemini' })
  }
}
