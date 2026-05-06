import { Resend } from 'resend'

let _resend: Resend | null = null

function getResend(): Resend {
  if (_resend) return _resend
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not set')
  _resend = new Resend(key)
  return _resend
}

export async function sendEmail(opts: {
  to: string | string[]
  subject: string
  html: string
  text?: string
}): Promise<{ ok: boolean; id: string | null; error: string | null }> {
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
  try {
    const result = await getResend().emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    })
    return { ok: true, id: result.data?.id ?? null, error: null }
  } catch (e) {
    console.error('[email] send failed', e)
    return { ok: false, id: null, error: (e as Error).message }
  }
}
