// POST /api/hotel-admin/[slug]/menu/upload-image
//   multipart/form-data, alan adi: 'file'
//   Menu urun gorselini public bucket'a yukler ve PUBLIC URL doner.
//   DB'ye YAZMAZ — donen image_url'i panel, menu/items POST/PATCH ile kaydeder.
//
// Yetki: menu/items/route.ts ile ayni (hotel_owner / front_office_manager / fb_manager).
// authAndTenant orada export edilmedigi icin ayni mantik burada tekrar tanimli.

import { NextRequest, NextResponse } from 'next/server';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant';

const ALLOWED_ROLES = ['hotel_owner', 'front_office_manager', 'fb_manager'];

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const BUCKET = 'BN-RoomServis'; // public bucket

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const ctx = await authAndTenant(slug);
    if (ctx.error) return ctx.error;
    const { supa, hotelId } = ctx;

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Form verisi okunamadi' }, { status: 400 });
    }

    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Dosya zorunlu' }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Sadece PNG/JPEG/WebP gorseli' }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'Gorsel 5 MB limitini asiyor' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${hotelId}/menu/${Date.now()}_${safeName}`;

    const { error: storageError } = await supa.storage
      .from(BUCKET)
      .upload(storagePath, fileBytes, {
        contentType: file.type,
        upsert: false,
      });

    if (storageError) {
      return NextResponse.json(
        { error: 'Gorsel yuklenemedi: ' + storageError.message },
        { status: 500 },
      );
    }

    const { data } = supa.storage.from(BUCKET).getPublicUrl(storagePath);

    return NextResponse.json({ image_url: data.publicUrl }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: 'Beklenmeyen hata: ' + (err as Error).message },
      { status: 500 },
    );
  }
}
