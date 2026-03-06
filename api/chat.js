import { GoogleGenAI } from '@google/genai'
import { readSession } from '../_lib/auth.js'

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

  const session = readSession(req)
  if (!session || !session.userId) {
    return res.status(401).json({ error: 'Inicia sesión para chatear' })
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

  let normalizedHistory = Array.isArray(history) ? history : []
  let normalizedAttachments = Array.isArray(attachments) ? attachments : []
  let textMessage = typeof message === 'string' ? message.trim() : ''

  if (textMessage.length > 5000) {
    textMessage = textMessage.substring(0, 5000)
  }
  if (normalizedHistory.length > 50) {
    normalizedHistory = normalizedHistory.slice(-50)
  }
  if (normalizedAttachments.length > 5) {
    normalizedAttachments = normalizedAttachments.slice(0, 5)
  }

  if (!textMessage && normalizedAttachments.length === 0) {
    return res.status(400).json({ error: 'Mensaje o adjuntos requeridos' })
  }

  const ai = new GoogleGenAI({ apiKey })
  const contents = toContents(normalizedHistory, textMessage, normalizedAttachments)

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
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
