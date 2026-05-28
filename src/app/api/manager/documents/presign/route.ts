import { NextResponse } from 'next/server';
import { getManagerOrHotelAdmin } from '@/lib/hotel-admin/auth';
import { getDemoHotelSupabase } from '@/lib/supabase-client';
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant';
import { randomUUID } from 'crypto';

const BUCKET = 'hotel_documents';
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

/**
 * Türkçe karakterleri ve boşlukları ASCII-güvenli karakterlere dönüştürür,
 * dosya uzantısını korur.
 */
function sanitizeFileName(name: string): string {
  const map: Record<string, string> = {
    ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I',
    ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U',
  };
  return name
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-');
}

// POST — Supabase Storage direct upload için signed URL üret
export async function POST(request: Request) {
  try {
    const session = await getManagerOrHotelAdmin();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: { fileName?: unknown; fileMime?: unknown; fileSize?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Geçersiz JSON gövdesi' }, { status: 400 });
    }

    const { fileName, fileMime, fileSize } = body;

    // --- Validation ---
    if (typeof fileName !== 'string' || fileName.trim().length === 0) {
      return NextResponse.json({ error: 'fileName zorunludur' }, { status: 400 });
    }
    if (fileName.length > 255) {
      return NextResponse.json({ error: 'fileName en fazla 255 karakter olabilir' }, { status: 400 });
    }
    if (typeof fileMime !== 'string' || !ALLOWED_MIME.includes(fileMime)) {
      return NextResponse.json(
        { error: `Geçersiz MIME türü. İzin verilenler: ${ALLOWED_MIME.join(', ')}` },
        { status: 400 }
      );
    }
    if (typeof fileSize !== 'number' || fileSize <= 0) {
      return NextResponse.json({ error: 'fileSize geçerli bir pozitif sayı olmalıdır' }, { status: 400 });
    }
    if (fileSize > MAX_SIZE) {
      return NextResponse.json({ error: 'Dosya 10 MB sınırını aşıyor' }, { status: 400 });
    }

    // --- Storage path oluştur ---
    const sanitized = sanitizeFileName(fileName.trim());
    const storagePath = `uploads/${randomUUID()}-${sanitized}`;

    // --- Signed upload URL al (tenant-aware) ---
    const supabase = session.hotel_slug
      ? (await resolveTenantBySlug(session.hotel_slug)).hotelSupabase
      : getDemoHotelSupabase();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      console.error('createSignedUploadUrl error:', error);
      return NextResponse.json(
        { error: error?.message ?? 'Signed URL alınamadı' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: storagePath,
      bucket: BUCKET,
    });
  } catch (err) {
    console.error('POST /api/manager/documents/presign error:', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
