import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * WEBHOOK-GIRISI update_id DEDUP (backlog #3).
 *
 * KOK SORUN: Telegram, yaniti gec/hatali gorurse AYNI update'i TEKRAR gonderir.
 * Bugune kadar koruma her akisin KENDI state'indeydi: `order:` akisinda M1 atomik
 * claim, `note:` / `hk:` akislarinda yalniz damga (`v`). Damga BAYAT BUTON korumasidir
 * — ayni damgayi tasiyan bir RETRY'i gecirir. Bu modul retry'i TEK GIRISTE, akislardan
 * BAGIMSIZ keser.
 *
 * M1 ile ILISKI — TAMAMLAYICI, ikisi de kalir:
 *   M1  = misafirin hizli CIFT TIK'i -> IKI FARKLI update_id, ayni conversation.
 *         Bu modul onu goremez (iki ayri update, ikisi de "ilk kez").
 *   Bu  = Telegram'in AYNI update'i tekrar teslimi -> ayni update_id.
 *         M1 bunu ancak siparis akisinda yakalar; note:/hk:/mesaj yolunda koruma YOKTU.
 *
 * ANAHTAR (hotel_slug, update_id): update_id BOT BAZINDA artar, global degil. Iki
 * otelin botlari ayni sayiyi uretebilir -> slug olmadan bir otelin update'i digerini
 * susturabilirdi.
 */

/**
 * Telegram govdesinden update_id cikarir — SAF (IO/LLM/zaman YOK).
 *
 * Kabul: tam sayi >= 0, ve yalniz-rakam string ("456"). Telegram JSON'da sayi
 * gonderir; string kabulu araya giren bir proxy/gateway'in sayiyi string'e cevirmesine
 * karsi savunmadir.
 * Red (null): alan yok · null/undefined · ondalik · negatif · harf iceren string
 * ("12a") · nesne olmayan govde. null = "kimlik okunamadi" -> cagiran dedup'i ATLAR
 * (fail-safe: mesaji islemek, sessizce yutmaktan iyidir).
 */
export function extractUpdateId(update: unknown): number | null {
  if (typeof update !== 'object' || update === null || Array.isArray(update)) return null;
  const raw = (update as Record<string, unknown>).update_id;

  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw >= 0 ? raw : null;
  }
  if (typeof raw === 'string' && /^\d+$/.test(raw)) {
    return Number(raw);
  }
  return null;
}

/**
 * Bu update'i BU otel icin ILK KEZ mi goruyoruz? (IO — tenant DB)
 *
 * true  = ilk gorulme, isleme DEVAM et
 * false = tekrar teslim (retry), akisi ATLA
 *
 * ATOMIKLIK: karar PRIMARY KEY (hotel_slug, update_id) catismasindan gelir; okuma-
 * sonra-yazma YOK. `ignoreDuplicates: true` upsert catismada satiri DONDURMEZ ->
 * donen dizi bos = bu update'i baska bir invocation almis.
 *
 * FAIL-SAFE: DB hatasinda (tablo yok / gecici hata) `true` doneriz — yani dedup'siz
 * ESKI davranisa duseriz. Ters yon (false) bir misafir talebini SESSIZCE YUTARDI.
 */
export async function claimTelegramUpdate(
  supa: SupabaseClient,
  hotelSlug: string,
  updateId: number,
): Promise<boolean> {
  const { data, error } = await supa
    .from('processed_telegram_updates')
    .upsert(
      { hotel_slug: hotelSlug, update_id: updateId },
      { onConflict: 'hotel_slug,update_id', ignoreDuplicates: true },
    )
    .select('update_id');

  if (error) {
    console.log('[update-dedup] claim-error, devam', error.message);
    return true;
  }

  const firstSeen = Array.isArray(data) && data.length > 0;
  console.log(
    firstSeen
      ? `[update-dedup] first-seen update_id=${updateId} slug=${hotelSlug}`
      : `[update-dedup] skip duplicate update_id=${updateId} slug=${hotelSlug}`,
  );
  return firstSeen;
}
