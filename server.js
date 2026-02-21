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
      config: {
        systemInstruction: `You are a strict, robotic mathematical solver.
YOUR ABSOLUTE RULES:
1. NO GREETINGS OR FAREWELLS. Never say "Hello", "Hi", etc.
2. NO CONVERSATIONAL FILLER. Never use phrases like "The result is", "Here is the calculation", "As you can see".
3. MANDATORY LATEX: Every single number, formula, equation, and variable MUST be formatted in LaTeX using $ or $$.
4. DIRECT ANSWER: Your output must contain ONLY the mathematical steps and the final answer. Start your response immediately with the math.
5. MANDATORY LINE BREAKS: You MUST add a double line break (\\n\\n) after EVERY SINGLE mathematical step, equation, or formula. NEVER put two formulas on the same line or right next to each other.
6. Example expected output for "Cuanto es 16!":
$$16! = 16 \\times 15 \\times \\dots \\times 1$$

$$16! = 20,922,789,888,000$$
7. OUT OF DOMAIN: If the query is not about math, physics, or statistics, reply EXACTLY with: "Solo puedo resolver problemas de matemáticas, física o estadística."`
      }
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
