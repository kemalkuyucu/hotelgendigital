import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant';

const ALLOWED_ROLES = ['hotel_owner', 'spa_manager'];

interface SpaColumnMapping {
  service_name_col: string;
  category_col: string;
  duration_col: string;
  price_col: string;
  currency_col: string;
  is_paid_col: string;
  description_col: string;
}

interface SpaRow {
  service_name: string;
  category: string | null;
  duration_min: number | null;
  price: number;
  currency: string;
  is_paid: boolean;
  description: string | null;
  display_order: number;
}

function parseIsPaid(raw: unknown): boolean {
  const s = String(raw ?? '').trim().toLowerCase();
  if (['hayir', 'hayır', 'no', 'false', '0', 'ucretsiz', 'ücretsiz', 'bedava', 'free'].includes(s)) return false;
  if (['evet', 'yes', 'true', '1', 'ucretli', 'ücretli', 'paid'].includes(s)) return true;
  return true;
}

function parsePrice(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  const cleaned = String(raw).replace(/[^0-9.,]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDuration(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const cleaned = String(raw).replace(/[^0-9]/g, '');
  if (cleaned === '') return null;
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
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
    const mapping = body.mapping as SpaColumnMapping;
    const fileBase64 = body.file_base64 as string;
    if (!mapping || !fileBase64) {
      return NextResponse.json({ error: 'Eksik veri (mapping veya dosya)' }, { status: 400 });
    }

    const tenant = await resolveTenantBySlug(slug);
    if (!tenant) {
      return NextResponse.json({ error: 'Otel bulunamadi' }, { status: 404 });
    }
    const supa = tenant.hotelSupabase;

    const buffer = Buffer.from(fileBase64, 'base64');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    const spaRows: SpaRow[] = [];
    let order = 0;
    for (const row of rows) {
      const name = String(row[mapping.service_name_col] ?? '').trim();
      if (!name) continue;
      order += 1;
      const price = parsePrice(row[mapping.price_col]);
      const isPaid = parseIsPaid(row[mapping.is_paid_col]);
      spaRows.push({
        service_name: name,
        category: String(row[mapping.category_col] ?? '').trim() || null,
        duration_min: parseDuration(row[mapping.duration_col]),
        price: isPaid ? price : 0,
        currency: normalizeCurrency(row[mapping.currency_col]),
        is_paid: isPaid,
        description: String(row[mapping.description_col] ?? '').trim() || null,
        display_order: order,
      });
    }

    if (spaRows.length === 0) {
      return NextResponse.json({ error: 'Excel\'de gecerli hizmet bulunamadi' }, { status: 400 });
    }

    const { error: delError } = await supa.from('spa_services').delete().not('id', 'is', null);
    if (delError) {
      console.error('[spa-import]', delError);
      return NextResponse.json({ error: 'Eski liste silinemedi' }, { status: 500 });
    }

    const { error: insError } = await supa.from('spa_services').insert(
      spaRows.map((r) => ({
        service_name: r.service_name,
        category: r.category,
        duration_min: r.duration_min,
        price: r.price,
        currency: r.currency,
        is_paid: r.is_paid,
        description: r.description,
        is_active: true,
        display_order: r.display_order,
      })),
    );
    if (insError) {
      console.error('[spa-import]', insError);
      return NextResponse.json({ error: 'Yeni liste yazilamadi' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, count: spaRows.length });
  } catch (err) {
    console.error('[spa-import]', err);
    return NextResponse.json({ error: 'Beklenmeyen hata' }, { status: 500 });
  }
}
