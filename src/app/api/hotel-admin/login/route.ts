// POST /api/hotel-admin/login

import { NextRequest, NextResponse } from 'next/server';
import { hotelAdminLogin } from '@/lib/hotel-admin/auth';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();

    if (
      typeof body !== 'object' ||
      body === null ||
      typeof (body as Record<string, unknown>).hotel_slug !== 'string' ||
      typeof (body as Record<string, unknown>).username !== 'string' ||
      typeof (body as Record<string, unknown>).password !== 'string'
    ) {
      return NextResponse.json({ error: 'hotel_slug, username ve password zorunludur.' }, { status: 400 });
    }

    const { hotel_slug, username, password } = body as Record<string, string>;

    const result = await hotelAdminLogin(hotel_slug, username, password);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      user: result.user,
    });
  } catch (err) {
    console.error('[hotel-admin/login]', err);
    return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 });
  }
}
