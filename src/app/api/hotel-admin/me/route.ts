// GET /api/hotel-admin/me

import { NextResponse } from 'next/server';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';

export async function GET(): Promise<NextResponse> {
  const user = await getHotelAdminFromCookie();
  if (!user) {
    return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });
  }
  return NextResponse.json({ user });
}
