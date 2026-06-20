import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant';

const ALLOWED_ROLES = ['hotel_owner', 'front_office_manager'];

interface RateMapping {
  room_type_col: string;
  capacity_col: string;
  kind_col: string;
  period_start_col: string;
  period_end_col: string;
  price_col: string;
  currency_col: string;
  board_col: string;
}

function parsePrice(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  const cleaned = String(raw).replace(/[^0-9.,]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function normalizeCurrency(raw: unknown): string {
  const s = String(raw ?? '').trim().toUpperCase();
  if (['TRY', 'TL', '₺'].includes(s)) return 'TRY';
  if (['EUR', '€', 'EURO'].includes(s)) return 'EUR';
  if (['USD', '$', 'DOLAR', 'DOLLAR'].includes(s)) return 'USD';
  return 'TRY';
}

function parseKind(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase();
  if (['gunubirlik', 'günübirlik', 'daily', 'gunluk', 'günlük'].includes(s)) return 'gunubirlik';
  return 'konaklama';
}

function parseDate(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(raw).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const tr = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (tr) return `${tr[3]}-${tr[2].padStart(2, '0')}-${tr[1].padStart(2, '0')}`;
  return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const admin = await getHotelAdminFromCookie();
    if (!admin || !ALLOWED_ROLES.includes(admin.role) || slug !== admin.hotel_slug) {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
    }
    const body = await req.json();
    const mapping = body.mapping as RateMapping;
    const fileBase64 = body.file_base64 as string;
    if (!mapping || !fileBase64) return NextResponse.json({ error: 'Eksik veri' }, { status: 400 });

    const tenant = await resolveTenantBySlug(slug);
    if (!tenant) return NextResponse.json({ error: 'Otel bulunamadi' }, { status: 404 });
    const supa = tenant.hotelSupabase;

    const buffer = Buffer.from(fileBase64, 'base64');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    const rateRows: any[] = [];
    let order = 0;
    for (const row of rows) {
      const roomType = String(row[mapping.room_type_col] ?? '').trim();
      const ps = parseDate(row[mapping.period_start_col]);
      const pe = parseDate(row[mapping.period_end_col]);
      if (!roomType || !ps || !pe) continue;
      order += 1;
      rateRows.push({
        room_type: roomType,
        capacity: String(row[mapping.capacity_col] ?? '').trim() || null,
        rate_kind: parseKind(row[mapping.kind_col]),
        period_start: ps,
        period_end: pe,
        price: parsePrice(row[mapping.price_col]),
        currency: normalizeCurrency(row[mapping.currency_col]),
        board_type: String(row[mapping.board_col] ?? '').trim() || null,
        is_active: true,
        display_order: order,
      });
    }

    if (rateRows.length === 0) {
      return NextResponse.json({ error: 'Excel\'de gecerli fiyat satiri bulunamadi (oda tipi + iki tarih zorunlu)' }, { status: 400 });
    }

    const { error: delError } = await supa.from('room_rates').delete().not('id', 'is', null);
    if (delError) return NextResponse.json({ error: 'Eski liste silinemedi: ' + delError.message }, { status: 500 });

    const { error: insError } = await supa.from('room_rates').insert(rateRows);
    if (insError) return NextResponse.json({ error: 'Yeni liste yazilamadi: ' + insError.message }, { status: 500 });

    return NextResponse.json({ ok: true, count: rateRows.length });
  } catch (err) {
    return NextResponse.json({ error: 'Beklenmeyen hata: ' + (err as Error).message }, { status: 500 });
  }
}
