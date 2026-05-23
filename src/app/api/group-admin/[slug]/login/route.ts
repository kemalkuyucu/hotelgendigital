// POST /api/group-admin/[slug]/login
// Modül 22 — Grup Yöneticisi Girişi

import { NextRequest, NextResponse } from 'next/server';
import { groupManagerLogin } from '@/lib/group-admin/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  try {
    const { slug } = await params;
    const body: unknown = await req.json();

    if (
      typeof body !== 'object' ||
      body === null ||
      typeof (body as Record<string, unknown>).username !== 'string' ||
      typeof (body as Record<string, unknown>).password !== 'string'
    ) {
      return NextResponse.json(
        { error: 'username ve password zorunludur.' },
        { status: 400 }
      );
    }

    const { username, password } = body as Record<string, string>;

    const result = await groupManagerLogin(slug, username, password);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, redirect: result.redirect });
  } catch (err) {
    console.error('[group-admin/login]', err);
    return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 });
  }
}
