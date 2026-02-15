import { Resend } from 'resend'

let resendClient = null

function getResendClient() {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) throw new Error('RESEND_API_KEY no configurada')
    resendClient = new Resend(apiKey)
  }
  return resendClient
}

export async function sendVerificationCode(email, code) {
  const from = process.env.RESEND_FROM_EMAIL
  if (!from) throw new Error('RESEND_FROM_EMAIL no configurada')

  await getResendClient().emails.send({
    from,
    to: email,
    subject: 'Código de verificación MercurySolver',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px">
        <h2>Verificación de cuenta</h2>
        <p>Tu código de verificación es:</p>
        <div style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</div>
        <p>El código expira en 10 minutos.</p>
      </div>
    `,
  })
}
