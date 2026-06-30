import { sendEmail } from './client'

// ---------------------------------------------------------------------------
// Yonetici rapor e-postasi: ozet HTML govde + Excel eki.
// WhatsApp/Telegram ozet metni (ham) parametre olarak gelir; burada temiz bir
// HTML kabuga sarilir. Detay = ekteki Excel. (Karar A: sade govde + Excel eki.)
// Cagiran taraf hata yutar (izole); bu fonksiyon da kendi icinde asla throw etmez.
// ---------------------------------------------------------------------------

// Telegram ozet metnindeki basit isaretleri (HTML <b> vb. + emoji) koru ama
// satir sonlarini <br> yap ki mail govdesinde okunakli dursun.
function summaryToHtml(summary: string): string {
  const escaped = summary
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped.replace(/\n/g, '<br>')
}

export async function sendRaporEmail(opts: {
  to: string[]
  hotelName: string
  rangeLabel: string
  summaryText: string
  excelBuffer: Buffer
  excelFilename: string
}): Promise<{ sent: number; failed: number }> {
  if (!opts.to || opts.to.length === 0) {
    return { sent: 0, failed: 0 }
  }

  const subject = `${opts.hotelName} — Rapor (${opts.rangeLabel})`

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:28px;border-radius:14px">
  <div style="font-size:20px;font-weight:700;color:#f1f5f9;margin-bottom:6px">${opts.hotelName}</div>
  <div style="font-size:14px;color:#94a3b8;margin-bottom:20px">Rapor dönemi: <b style="color:#a5b4fc">${opts.rangeLabel}</b></div>
  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:18px;font-size:14px;line-height:1.7;color:#e2e8f0">
    ${summaryToHtml(opts.summaryText)}
  </div>
  <div style="font-size:13px;color:#94a3b8;margin-top:18px">📎 Departman bazlı detaylı döküm ekteki Excel dosyasındadır.</div>
  <div style="font-size:11px;color:#64748b;margin-top:24px;border-top:1px solid rgba(255,255,255,0.08);padding-top:14px">Bu e-posta HotelGen otomatik raporlama sistemi tarafından gönderilmiştir.</div>
</div>`.trim()

  let sent = 0
  let failed = 0
  for (const addr of opts.to) {
    try {
      const res = await sendEmail({
        to: addr,
        subject,
        html,
        attachments: [{ filename: opts.excelFilename, content: opts.excelBuffer }],
      })
      if (res.ok) sent++
      else failed++
    } catch {
      failed++
    }
  }
  return { sent, failed }
}
