import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';

const ALLOWED_ROLES = ['hotel_owner', 'spa_manager'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const admin = await getHotelAdminFromCookie();
    if (!admin || !ALLOWED_ROLES.includes(admin.role) || slug !== admin.hotel_slug) {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Dosya bulunamadi' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Excel bos' }, { status: 400 });
    }

    const headers = Object.keys(rows[0]);
    const sampleRows = rows.slice(0, 3);

    return NextResponse.json({ headers, sample_rows: sampleRows, total_rows: rows.length });
  } catch (err) {
    console.error('[spa-parse-excel]', err);
    return NextResponse.json({ error: 'Parse hatasi' }, { status: 500 });
  }
}
