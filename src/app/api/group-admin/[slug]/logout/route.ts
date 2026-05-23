// POST /api/group-admin/[slug]/logout
// Modül 22 — Grup Yöneticisi Çıkış

import { NextRequest, NextResponse } from 'next/server';
import { groupManagerLogout } from '@/lib/group-admin/auth';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params;
  await groupManagerLogout();
  return NextResponse.redirect(new URL(`/group-admin/${slug}/login`, _req.url));
}
