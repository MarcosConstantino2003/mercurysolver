import dotenv from 'dotenv'
import express from 'express'
import { GoogleGenAI } from '@google/genai'

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT || 8787)
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const apiKey = process.env.GEMINI_API_KEY
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null

app.use(express.json({ limit: '25mb' }))

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    model: MODEL,
    geminiConfigured: Boolean(apiKey),
  })
})

app.post('/api/chat', async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no configurada en .env' })
  }

  const { message, history, attachments } = req.body ?? {}

  const normalizedHistory = Array.isArray(history) ? history : []
  const normalizedAttachments = Array.isArray(attachments) ? attachments : []
  const textMessage = typeof message === 'string' ? message.trim() : ''

  if (!textMessage && normalizedAttachments.length === 0) {
    return res.status(400).json({ error: 'Mensaje o adjuntos requeridos' })
  }

  const contents = []

  for (const chatMessage of normalizedHistory) {
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

  for (const attachment of normalizedAttachments) {
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

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [...contents, { role: 'user', parts: userParts }],
    })

    const text = response.text?.trim() || 'No pude generar una respuesta en este momento.'
    return res.json({ text })
  } catch (error) {
    console.error('Gemini error:', error)

    if (error?.status === 429) {
      return res.status(429).json({
        error:
          'Gemini devolvió quota exceeded (429). Revisa facturación/cuotas o cambia GEMINI_MODEL en .env.',
      })
    }

    if (error?.status === 400) {
      return res.status(400).json({
        error: 'Solicitud inválida para Gemini. Verifica modelo y formato de adjuntos.',
      })
    }

    return res.status(500).json({ error: 'Error consultando Gemini' })
  }
})

app.listen(PORT, () => {
  console.log(`Gemini backend running on http://localhost:${PORT}`)
  console.log(`Using model: ${MODEL}`)
})
