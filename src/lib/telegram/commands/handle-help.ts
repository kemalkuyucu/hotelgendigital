export async function handleHelp(hotelName: string): Promise<string> {
  return `🏨 *${hotelName} — Yönetici Paneli*

Komutlar:
\`/rapor\` — Bugünkü mesaj/intent özeti
\`/durum\` — Sistem sağlığı
\`/aktif_konusmalar\` — Son 24 saatte aktif misafirler
\`/son_mesajlar [N]\` — Son N misafir mesajı (default 10)
\`/help\` — Bu mesaj

ℹ️ Bu bot yalnızca senin chat ID'nle (${process.env.NODE_ENV === 'production' ? 'prod' : 'dev'}) konuşur.`;
}
