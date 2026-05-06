export function hotelWelcomeEmail(params: {
  hotelName: string
  contactName: string | null
  adminUrl: string
}): { html: string; text: string } {
  const greeting = params.contactName ? `Sayın ${params.contactName}` : 'Merhaba'
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
      <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #1e40af; font-size: 24px; margin: 0;">🏨 HotelGen</h1>
          <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0;">Otel Otomasyon Platformu</p>
        </div>
        <h2 style="color: #111827; font-size: 18px;">HotelGen'e Hoş Geldiniz!</h2>
        <p style="color: #374151;">${greeting},</p>
        <p style="color: #374151;">
          <strong style="color: #111827;">${params.hotelName}</strong> oteli HotelGen sistemine
          başarıyla eklenmiştir. Artık yapay zeka destekli otel otomasyon platformumuzdan
          yararlanmaya başlayabilirsiniz.
        </p>
        <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="margin: 0; color: #1d4ed8; font-size: 14px;">
            ✅ Sisteme eklendi<br/>
            🔐 Bridge credentials ayarlanabilir<br/>
            📊 Raporlama ve analitik hazır
          </p>
        </div>
        <p style="color: #374151; margin-bottom: 24px;">
          Yönetim panelinize erişmek için aşağıdaki butona tıklayın:
        </p>
        <div style="text-align: center;">
          <a href="${params.adminUrl}"
             style="background: #2563eb; color: white; padding: 14px 28px; text-decoration: none;
                    border-radius: 8px; display: inline-block; font-weight: 600; font-size: 15px;">
            Yönetim Paneline Git →
          </a>
        </div>
        <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e7eb;"/>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
          Bu e-posta HotelGen sisteminden otomatik olarak gönderilmiştir.<br/>
          HotelGen Multi-Tenant Hotel Automation Platform
        </p>
      </div>
    </div>
  `
  const text = `${greeting},\n\n${params.hotelName} oteli HotelGen sistemine başarıyla eklenmiştir.\n\nYönetim paneli: ${params.adminUrl}\n\nHotelGen Otel Otomasyon Platformu`
  return { html, text }
}
