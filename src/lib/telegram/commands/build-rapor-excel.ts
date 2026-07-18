import { SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// Yonetici DETAYLI rapor -> xlsx Buffer.
//   Ozet sekmesi: ai_intents departman dagilimi (counts).
//   Departman sekmeleri + birlesik SLA Detay: sla_events.
// Kolon adlari migrations/tenant/003_sla_events.sql'den dogrulandi.
// ---------------------------------------------------------------------------

// Departman kodu -> TR etiketi (ASCII, sheet adi olarak da kullanilir, <=31 krk)
const DEPT_LABELS: Record<string, string> = {
  front_office: 'On Buro',
  housekeeping: 'Housekeeping',
  technical: 'Teknik Servis',
  fb: 'FB',
  spa: 'SPA',
  guest_relation: 'Misafir Iliskileri',
  animation: 'Animasyon',
};

function deptLabel(code: string | null): string {
  if (!code) return 'Diger';
  return DEPT_LABELS[code] ?? 'Diger';
}

// Europe/Istanbul okunabilir tarih (ASCII): "DD.MM.YYYY HH:mm"
function fmtTr(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
}

// Excel sheet adi: ASCII, yasakli karakterleri temizle, max 31 krk, bos ise fallback.
function safeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').trim();
  const trimmed = cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned;
  return trimmed.length > 0 ? trimmed : 'Sheet';
}

interface IntentRow {
  id: string;
  conversation_id: string | null;
  classified_department: string | null;
  guest_message_id: string | null;
  created_at: string | null;
}

export async function buildRaporExcel(
  hotelClient: SupabaseClient,
  range: { startIso: string; endIso: string; label: string }
): Promise<Buffer> {
  // 1) Ozet counts icin ai_intents departman dagilimi (yalniz sayim)
  const { data: intentsData } = await hotelClient
    .from('ai_intents')
    .select('id, conversation_id, classified_department, guest_message_id, created_at')
    .gte('created_at', range.startIso)
    .lte('created_at', range.endIso)
    .order('created_at', { ascending: true });
  const intents = (intentsData ?? []) as IntentRow[];

  const counts = new Map<string, number>();
  for (const it of intents) {
    const label = deptLabel(it.classified_department);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  // 2) sla_events -> birlesik SLA Detay satirlari + departman bazli sekmeler
  const { data: slaData } = await hotelClient
    .from('sla_events')
    .select('department_code, request_text, forwarded_at, responded_at, final_status, reception_response_text, created_at')
    .gte('created_at', range.startIso)
    .lte('created_at', range.endIso)
    .order('created_at', { ascending: true });
  const slaSheetRows = ((slaData ?? []) as {
    department_code: string | null;
    request_text: string | null;
    forwarded_at: string | null;
    responded_at: string | null;
    final_status: string | null;
    reception_response_text: string | null;
    created_at: string | null;
  }[]).map((e) => {
    let yanitDk = '';
    if (e.responded_at && e.forwarded_at) {
      const diff = new Date(e.responded_at).getTime() - new Date(e.forwarded_at).getTime();
      if (diff >= 0) yanitDk = String(Math.round(diff / 60000));
    }
    return {
      Tarih: fmtTr(e.created_at),
      Departman: deptLabel(e.department_code),
      Talep: e.request_text ?? '',
      Iletildi: fmtTr(e.forwarded_at),
      'Yanit dk': yanitDk,
      Durum: e.final_status ?? '',
      'Resepsiyon Aciklamasi': e.reception_response_text ?? '',
    };
  });

  // Birlesik SLA Detay (tum departmanlar, Departman kolonu dahil)
  const slaWs = XLSX.utils.json_to_sheet(
    slaSheetRows.length > 0 ? slaSheetRows : [{ Durum: 'SLA kaydi yok' }]
  );

  // Departman bazli gruplama (sla_events); tekil sheet'te Departman kolonu tekrarlanmaz
  const slaByDept = new Map<string, typeof slaSheetRows>();
  for (const r of slaSheetRows) {
    if (!slaByDept.has(r.Departman)) slaByDept.set(r.Departman, []);
    slaByDept.get(r.Departman)!.push(r);
  }

  // 3) Workbook olustur
  const wb = XLSX.utils.book_new();

  // Ilk sheet: Ozet (ai_intents departman -> adet); bos ise "Kayit yok"
  const ozetRows = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([dept, adet]) => ({ Departman: dept, Adet: adet }));
  const ozetWs = XLSX.utils.json_to_sheet(
    ozetRows.length > 0 ? ozetRows : [{ Durum: 'Kayit yok' }]
  );
  XLSX.utils.book_append_sheet(wb, ozetWs, safeSheetName('Ozet'));

  // Her departman icin ayri sheet (sla_events) — isim cakismasina karsi tekillestir
  const usedNames = new Set<string>(['Ozet']);
  for (const [label, rows] of slaByDept.entries()) {
    let name = safeSheetName(label);
    if (usedNames.has(name)) {
      const base = name.slice(0, 28);
      let n = 2;
      while (usedNames.has(`${base} ${n}`)) n++;
      name = `${base} ${n}`;
    }
    usedNames.add(name);
    // Departman kolonunu tekil sheet'ten cikar (sheet zaten o departmanin)
    const sheetRows = rows.map(({ Departman, ...rest }) => rest);
    const ws = XLSX.utils.json_to_sheet(
      sheetRows.length > 0 ? sheetRows : [{ Durum: 'Kayit yok' }]
    );
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  // Birlesik SLA Detay sheet'i (tum departmanlar) — departman sheet'lerinden sonra
  XLSX.utils.book_append_sheet(wb, slaWs, safeSheetName('SLA Detay'));

  // 4) Buffer dondur
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
