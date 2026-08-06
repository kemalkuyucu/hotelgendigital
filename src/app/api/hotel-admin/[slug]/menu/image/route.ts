// GET/PUT /api/hotel-admin/[slug]/menu/image
//   Room-service menu gorseli (fiyat listesi) — hotel_settings.menu_image_urls (JSONB dizi).
//   Gorsel dosyasi menu/upload-image ile yuklenir (public URL doner); bu route yalnizca
//   donen URL'leri saklar/okur.
//
// Yetki: menu/items + menu/upload-image ile ayni (hotel_owner / front_office_manager / fb_manager).
// authAndTenant o dosyalarda export edilmedigi icin ayni mantik burada tekrar tanimli.

import { NextRequest, NextResponse } from 'next/server';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant';
import { invalidateSummary } from '@/lib/knowledge/cache';

const ALLOWED_ROLES = ['hotel_owner', 'front_office_manager', 'fb_manager'];

// auth + tenant cozumu (menu/items/route.ts ile ayni desen)
async function authAndTenant(slug: string) {
  const admin = await getHotelAdminFromCookie();
  if (!admin || !ALLOWED_ROLES.includes(admin.role) || slug !== admin.hotel_slug) {
    return { error: NextResponse.json({ error: 'Yetkisiz' }, { status: 403 }) };
  }
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) {
    return { error: NextResponse.json({ error: 'Otel bulunamadi' }, { status: 404 }) };
  }
  return { supa: tenant.hotelSupabase, hotelId: tenant.hotelId };
}

function isHttpUrl(raw: unknown): boolean {
  if (typeof raw !== 'string' || raw.trim() === '') return false;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// GET → mevcut menu gorselleri. hotel_settings singleton (hotel_id kolonu YOK).
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const ctx = await authAndTenant(slug);
    if (ctx.error) return ctx.error;
    const { supa } = ctx;

    const { data, error } = await supa
      .from('hotel_settings')
      .select('menu_image_urls')
      .maybeSingle();
    if (error) {
      console.error('[menu-image]', error);
      return NextResponse.json({ error: 'Menu gorseli alinamadi' }, { status: 500 });
    }

    const urls = Array.isArray(data?.menu_image_urls) ? data.menu_image_urls : [];
    return NextResponse.json({ menu_image_urls: urls });
  } catch (err) {
    console.error('[menu-image]', err);
    return NextResponse.json({ error: 'Beklenmeyen hata' }, { status: 500 });
  }
}

// PUT → menu gorsellerini degistir. Body: { menu_image_urls: string[] }
// Bos dizi gecerli — menu gorselini kaldirmak icin kullanilir.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const ctx = await authAndTenant(slug);
    if (ctx.error) return ctx.error;
    const { supa, hotelId } = ctx;

    let body: { menu_image_urls?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Gecersiz JSON' }, { status: 400 });
    }

    const raw = body.menu_image_urls;
    if (!Array.isArray(raw)) {
      return NextResponse.json({ error: 'menu_image_urls dizi olmali' }, { status: 400 });
    }
    if (!raw.every(isHttpUrl)) {
      return NextResponse.json({ error: 'Her eleman http(s) URL olmali' }, { status: 400 });
    }
    const urls = raw.map((u) => String(u).trim());

    // Singleton tablo: WHERE'siz UPDATE yerine tek satirin id'sini cekip ona yaz.
    const { data: existing, error: selErr } = await supa
      .from('hotel_settings')
      .select('id')
      .maybeSingle();
    if (selErr) {
      console.error('[menu-image]', selErr);
      return NextResponse.json({ error: 'Ayar kaydi okunamadi' }, { status: 500 });
    }
    if (!existing?.id) {
      // hotel_name NOT NULL — bos tabloya buradan INSERT etmek dogru degil.
      return NextResponse.json({ error: 'Otel ayarlari kaydi yok' }, { status: 404 });
    }

    const { error: updErr } = await supa
      .from('hotel_settings')
      .update({ menu_image_urls: urls })
      .eq('id', existing.id);
    if (updErr) {
      console.error('[menu-image]', updErr);
      return NextResponse.json({ error: 'Menu gorseli kaydedilemedi' }, { status: 500 });
    }

    // Bot bayat bilgi servis etmesin (menu/items route'undaki ile ayni)
    invalidateSummary(hotelId);

    return NextResponse.json({ ok: true, menu_image_urls: urls });
  } catch (err) {
    console.error('[menu-image]', err);
    return NextResponse.json({ error: 'Beklenmeyen hata' }, { status: 500 });
  }
}
