import { SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// Departman bazli DETAYLI rapor -> her departman ayri sheet'li xlsx Buffer.
//
// Dogrulanmis kolon adlari (migrations/tenant/*):
//   bot_messages:      id, conversation_id, direction, text, created_at
//   conversations:     id, verified_inhouse_guest_id
//   inhouse_guests_v2: id, room_number, guest_name
//   ai_intents:        id, conversation_id, classified_department,
//                      guest_message_id, created_at
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

interface ReportRow {
  Tarih: string;
  Departman: string;
  Oda: string;
  Misafir: string;
  Talep: string;
}

export async function buildRaporExcel(
  hotelClient: SupabaseClient,
  range: { startIso: string; endIso: string; label: string }
): Promise<Buffer> {
  // 1) Pencere icindeki ai_intents kayitlari
  const { data: intentsData } = await hotelClient
    .from('ai_intents')
    .select('id, conversation_id, classified_department, guest_message_id, created_at')
    .gte('created_at', range.startIso)
    .lte('created_at', range.endIso)
    .order('created_at', { ascending: true });

  const intents = (intentsData ?? []) as IntentRow[];

  // --- Talep metni eslestirme ---
  // (a) guest_message_id olanlar -> bot_messages.id ile dogrudan
  const guestMsgIds = Array.from(
    new Set(intents.map((i) => i.guest_message_id).filter((v): v is string => !!v))
  );
  const textByMsgId = new Map<string, string>();
  if (guestMsgIds.length > 0) {
    const { data: msgs } = await hotelClient
      .from('bot_messages')
      .select('id, text')
      .in('id', guestMsgIds);
    for (const m of (msgs ?? []) as { id: string; text: string | null }[]) {
      textByMsgId.set(m.id, m.text ?? '');
    }
  }

  // (b) guest_message_id olmayanlar -> conversation'in son inbound mesaji
  const convIdsNeedingFallback = Array.from(
    new Set(
      intents
        .filter((i) => !i.guest_message_id && i.conversation_id)
        .map((i) => i.conversation_id as string)
    )
  );
  const lastInboundByConv = new Map<string, string>();
  if (convIdsNeedingFallback.length > 0) {
    const { data: inbound } = await hotelClient
      .from('bot_messages')
      .select('conversation_id, text, created_at')
      .eq('direction', 'inbound')
      .in('conversation_id', convIdsNeedingFallback)
      .order('created_at', { ascending: true });
    // asc sirali -> her conversation icin sonuncu (en yeni) kalir
    for (const m of (inbound ?? []) as {
      conversation_id: string;
      text: string | null;
      created_at: string | null;
    }[]) {
      lastInboundByConv.set(m.conversation_id, m.text ?? '');
    }
  }

  // --- Oda + misafir eslestirme ---
  // conversations.verified_inhouse_guest_id -> inhouse_guests_v2(room_number, guest_name)
  const convIds = Array.from(
    new Set(intents.map((i) => i.conversation_id).filter((v): v is string => !!v))
  );
  const inhouseIdByConv = new Map<string, string>();
  if (convIds.length > 0) {
    const { data: convs } = await hotelClient
      .from('conversations')
      .select('id, verified_inhouse_guest_id')
      .in('id', convIds);
    for (const c of (convs ?? []) as {
      id: string;
      verified_inhouse_guest_id: string | null;
    }[]) {
      if (c.verified_inhouse_guest_id) inhouseIdByConv.set(c.id, c.verified_inhouse_guest_id);
    }
  }

  const inhouseIds = Array.from(new Set(inhouseIdByConv.values()));
  const guestByInhouseId = new Map<string, { room: string; name: string }>();
  if (inhouseIds.length > 0) {
    const { data: guests } = await hotelClient
      .from('inhouse_guests_v2')
      .select('id, room_number, guest_name')
      .in('id', inhouseIds);
    for (const g of (guests ?? []) as {
      id: string;
      room_number: string | null;
      guest_name: string | null;
    }[]) {
      guestByInhouseId.set(g.id, { room: g.room_number ?? '', name: g.guest_name ?? '' });
    }
  }

  // 4) Satirlari kur + departmana gore grupla
  const groups = new Map<string, ReportRow[]>();
  const counts = new Map<string, number>();

  for (const it of intents) {
    const label = deptLabel(it.classified_department);

    // talep metni: once guest_message_id, sonra conversation fallback
    let requestText = '';
    if (it.guest_message_id && textByMsgId.has(it.guest_message_id)) {
      requestText = textByMsgId.get(it.guest_message_id) ?? '';
    } else if (it.conversation_id && lastInboundByConv.has(it.conversation_id)) {
      requestText = lastInboundByConv.get(it.conversation_id) ?? '';
    }

    // oda + misafir
    let room = '';
    let guest = '';
    if (it.conversation_id) {
      const inhouseId = inhouseIdByConv.get(it.conversation_id);
      if (inhouseId) {
        const info = guestByInhouseId.get(inhouseId);
        if (info) {
          room = info.room;
          guest = info.name;
        }
      }
    }

    const row: ReportRow = {
      Tarih: fmtTr(it.created_at),
      Departman: label,
      Oda: room,
      Misafir: guest,
      Talep: requestText,
    };

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(row);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  // 5) Workbook olustur
  const wb = XLSX.utils.book_new();

  if (intents.length === 0) {
    const ws = XLSX.utils.json_to_sheet([{ Durum: 'Kayit yok' }]);
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName('Ozet'));
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  // Ilk sheet: Ozet (departman -> adet)
  const ozetRows = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([dept, adet]) => ({ Departman: dept, Adet: adet }));
  const ozetWs = XLSX.utils.json_to_sheet(ozetRows);
  XLSX.utils.book_append_sheet(wb, ozetWs, safeSheetName('Ozet'));

  // Her departman icin ayri sheet (sheet adi cakismasina karsi tekillestir)
  const usedNames = new Set<string>(['Ozet']);
  for (const [label, rows] of groups.entries()) {
    let name = safeSheetName(label);
    if (usedNames.has(name)) {
      // benzersizlestir: sona kisa ek
      const base = name.slice(0, 28);
      let n = 2;
      while (usedNames.has(`${base} ${n}`)) n++;
      name = `${base} ${n}`;
    }
    usedNames.add(name);
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  // 6) Buffer dondur
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
