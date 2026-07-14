import { NextRequest, NextResponse } from 'next/server';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant';
import { invalidateSummary } from '@/lib/knowledge/cache';

const ALLOWED_ROLES = ['hotel_owner', 'front_office_manager', 'fb_manager'];

function normalizeCurrency(raw: unknown): string {
  const s = String(raw ?? '').trim().toUpperCase();
  if (['TRY', 'TL', '₺'].includes(s)) return 'TRY';
  if (['EUR', '€', 'EURO'].includes(s)) return 'EUR';
  if (['USD', '$', 'DOLAR', 'DOLLAR'].includes(s)) return 'USD';
  return 'TRY';
}

function parsePrice(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  const cleaned = String(raw).replace(/[^0-9.,]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// auth + tenant cozumu; her metot bunu cagirir
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

// GET → tum urunler (pasifler dahil), category + display_order siralamasi
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const ctx = await authAndTenant(slug);
    if (ctx.error) return ctx.error;
    const { supa } = ctx;

    const { data, error } = await supa
      .from('menu_items')
      .select('*')
      .order('category', { ascending: true })
      .order('display_order', { ascending: true });
    if (error) {
      return NextResponse.json({ error: 'Liste alinamadi: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: 'Beklenmeyen hata: ' + (err as Error).message }, { status: 500 });
  }
}

// POST → tek urun ekle. Body: { item_name, category, price, currency, is_paid }
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const ctx = await authAndTenant(slug);
    if (ctx.error) return ctx.error;
    const { supa, hotelId } = ctx;

    const body = await req.json();
    const itemName = String(body.item_name ?? '').trim();
    if (!itemName) {
      return NextResponse.json({ error: 'Urun adi zorunlu' }, { status: 400 });
    }

    const category = body.category != null && String(body.category).trim() !== ''
      ? String(body.category).trim()
      : null;
    const isPaid = body.is_paid === undefined ? true : Boolean(body.is_paid);
    const price = isPaid ? parsePrice(body.price) : 0; // ucretsiz ise fiyat 0
    const currency = normalizeCurrency(body.currency);

    // display_order = o kategorideki max display_order + 1
    let q = supa.from('menu_items').select('display_order').order('display_order', { ascending: false }).limit(1);
    q = category === null ? q.is('category', null) : q.eq('category', category);
    const { data: maxRows } = await q;
    const nextOrder = (maxRows && maxRows.length > 0 ? Number(maxRows[0].display_order ?? 0) : 0) + 1;

    const { data, error } = await supa
      .from('menu_items')
      .insert({
        item_name: itemName,
        category,
        price,
        currency,
        is_paid: isPaid,
        is_active: true,
        display_order: nextOrder,
        item_code: String(body.item_code ?? '').trim() || null,
        image_url: body.image_url ?? null,
        description: body.description ?? null,
      })
      .select('*')
      .single();
    if (error) {
      return NextResponse.json({ error: 'Urun eklenemedi: ' + error.message }, { status: 500 });
    }

    invalidateSummary(hotelId);
    return NextResponse.json({ item: data });
  } catch (err) {
    return NextResponse.json({ error: 'Beklenmeyen hata: ' + (err as Error).message }, { status: 500 });
  }
}

// PATCH → tek urun guncelle. Sadece gelen alanlari update et
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const ctx = await authAndTenant(slug);
    if (ctx.error) return ctx.error;
    const { supa, hotelId } = ctx;

    const body = await req.json();
    const id = body.id;
    if (!id) {
      return NextResponse.json({ error: 'id zorunlu' }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    if (body.item_name !== undefined) patch.item_name = String(body.item_name).trim();
    if (body.category !== undefined) {
      patch.category = body.category != null && String(body.category).trim() !== ''
        ? String(body.category).trim()
        : null;
    }
    if (body.currency !== undefined) patch.currency = normalizeCurrency(body.currency);
    if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);
    if (body.is_paid !== undefined) patch.is_paid = Boolean(body.is_paid);
    if (body.price !== undefined) patch.price = parsePrice(body.price);
    // is_paid=false geldiyse fiyati sifirla (import mantigiyla tutarli)
    if (patch.is_paid === false) patch.price = 0;

    // Katalog alanlari (023_menu_catalog): bos string -> null (unique index bos kodu saymaz)
    if (body.item_code !== undefined) patch.item_code = String(body.item_code ?? '').trim() || null;
    if (body.image_url !== undefined) patch.image_url = body.image_url ?? null;
    if (body.description !== undefined) patch.description = body.description ?? null;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Guncellenecek alan yok' }, { status: 400 });
    }

    const { data, error } = await supa
      .from('menu_items')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      return NextResponse.json({ error: 'Guncellenemedi: ' + error.message }, { status: 500 });
    }

    invalidateSummary(hotelId);
    return NextResponse.json({ item: data });
  } catch (err) {
    return NextResponse.json({ error: 'Beklenmeyen hata: ' + (err as Error).message }, { status: 500 });
  }
}

// DELETE → soft delete (is_active=false). hard=true ise SADECE zaten pasif urunu gercekten sil
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const ctx = await authAndTenant(slug);
    if (ctx.error) return ctx.error;
    const { supa, hotelId } = ctx;

    const body = await req.json();
    const id = body.id;
    const hard = body.hard === true;
    if (!id) {
      return NextResponse.json({ error: 'id zorunlu' }, { status: 400 });
    }

    if (hard) {
      // Guvenlik: sadece ZATEN soft-delete edilmis (is_active=false) urun kalici silinebilir
      const { data: existing, error: fetchErr } = await supa
        .from('menu_items')
        .select('id, is_active')
        .eq('id', id)
        .maybeSingle();
      if (fetchErr) {
        return NextResponse.json({ error: 'Kayit okunamadi: ' + fetchErr.message }, { status: 500 });
      }
      if (!existing) {
        return NextResponse.json({ error: 'Kayit bulunamadi' }, { status: 404 });
      }
      if (existing.is_active) {
        return NextResponse.json({ error: 'Once menuden kaldirin, sonra kalici silin' }, { status: 400 });
      }
      const { error: delErr } = await supa.from('menu_items').delete().eq('id', id);
      if (delErr) {
        return NextResponse.json({ error: 'Kalici silinemedi: ' + delErr.message }, { status: 500 });
      }
      invalidateSummary(hotelId);
      return NextResponse.json({ ok: true, hard: true });
    }

    const { error } = await supa
      .from('menu_items')
      .update({ is_active: false })
      .eq('id', id);
    if (error) {
      return NextResponse.json({ error: 'Silinemedi: ' + error.message }, { status: 500 });
    }

    invalidateSummary(hotelId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Beklenmeyen hata: ' + (err as Error).message }, { status: 500 });
  }
}
