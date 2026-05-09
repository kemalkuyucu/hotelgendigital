// POST /api/hotel-admin/logout

import { NextResponse } from 'next/server';
import { hotelAdminLogout } from '@/lib/hotel-admin/auth';

export async function POST(): Promise<NextResponse> {
  await hotelAdminLogout();
  return NextResponse.json({ ok: true });
}
