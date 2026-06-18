import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant';

const ALLOWED_ROLES = ['hotel_owner', 'front_office_manager'];

interface MenuColumnMapping {
  item_name_col: string;
  category_col: string;
  price_col: string;
  currency_col: string;
  is_paid_col: string;
}

interface MenuRow {
  item_name: string;
  category: string | null;
  price: number;
  currency: string;
  is_paid: boolean;
  display_order: number;
}

// "evet/yes/true/1/ucretli" => true ; "hayir/no/false/0/ucretsiz/bedava" => false
function parseIsPaid(raw: unknown): boolean {
  const s = String(raw ?? '').trim().toLowerCase();
  if (['hayir', 'hayır', 'no', 'false', '0', 'ucretsiz', 'ücretsiz', 'bedava', 'free'].includes(s)) return false;
  if (['evet', 'yes', 'true', '1', 'ucretli', 'ücretli', 'paid'].includes(s)) return true;
  // bos/bilinmeyen => fiyat>0 ise ucretli varsay, degilse ucretsiz (asagida price ile netlesir)
  return true;
}

function parsePrice(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  // "250", "250 TL", "250,00", "₺250" gibi degerleri temizle
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const admin = await getHotelAdminFromCookie();
    if (!admin || !ALLOWED_ROLES.includes(admin.role) || slug !== admin.hotel_slug) {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
    }

    const body = await req.json();
    const mapping = body.mapping as MenuColumnMapping;
    const fileBase64 = body.file_base64 as string;
    if (!mapping || !fileBase64) {
      return NextResponse.json({ error: 'Eksik veri (mapping veya dosya)' }, { status: 400 });
    }

    const tenant = await resolveTenantBySlug(slug);
    if (!tenant) {
      return NextResponse.json({ error: 'Otel bulunamadi' }, { status: 404 });
    }
    const supa = tenant.hotelSupabase;

    // Excel parse
    const buffer = Buffer.from(fileBase64, 'base64');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    const menuRows: MenuRow[] = [];
    let order = 0;
    for (const row of rows) {
      const name = String(row[mapping.item_name_col] ?? '').trim();
      if (!name) continue; // bos satir atla
      order += 1;
      const price = parsePrice(row[mapping.price_col]);
      const isPaid = parseIsPaid(row[mapping.is_paid_col]);
      menuRows.push({
        item_name: name,
        category: String(row[mapping.category_col] ?? '').trim() || null,
        price: isPaid ? price : 0, // ucretsiz ise fiyat 0
        currency: normalizeCurrency(row[mapping.currency_col]),
        is_paid: isPaid,
        display_order: order,
      });
    }

    if (menuRows.length === 0) {
      return NextResponse.json({ error: 'Excel\'de gecerli urun bulunamadi' }, { status: 400 });
    }

    // MIMARI: eski menuyu sil + yeni bas (diff yok)
    const { error: delError } = await supa.from('menu_items').delete().not('id', 'is', null);
    if (delError) {
      return NextResponse.json({ error: 'Eski menu silinemedi: ' + delError.message }, { status: 500 });
    }

    const { error: insError } = await supa.from('menu_items').insert(
      menuRows.map((r) => ({
        item_name: r.item_name,
        category: r.category,
        price: r.price,
        currency: r.currency,
        is_paid: r.is_paid,
        is_active: true,
        display_order: r.display_order,
      })),
    );
    if (insError) {
      return NextResponse.json({ error: 'Yeni menu yazilamadi: ' + insError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, count: menuRows.length });
  } catch (err) {
    return NextResponse.json({ error: 'Beklenmeyen hata: ' + (err as Error).message }, { status: 500 });
  }
}
