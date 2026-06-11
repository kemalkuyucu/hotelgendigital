import { NextRequest, NextResponse } from 'next/server';
import { getHotelAdminFromCookie } from '@/lib/hotel-admin/auth';
import { resolveTenantBySlug } from '@/lib/hotel-admin/tenant';

// GET /api/hotel-admin/[slug]/eskalasyon?department=<code|all>&start=YYYY-MM-DD&end=YYYY-MM-DD
// Sadece SORUNLU SLA olaylarini doner:
//   escalated_at IS NOT NULL  (departman SLA'yi kacirdi -> resepsiyona eskale)
//   VEYA final_status = 'no_response'  (resepsiyon da kacirdi -> oto-kapandi)
// Tamamlanan/saglikli talepler bu listeye girmez (zaten raporda).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const admin = await getHotelAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (admin.hotel_slug !== slug) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const departmentParam = (url.searchParams.get('department') || 'all').trim();
  const startParam = (url.searchParams.get('start') || '').trim();
  const endParam = (url.searchParams.get('end') || '').trim();

  // TR saat dilimi (+03:00) — group-admin report ile ayni mantik
  const TR = '+03:00';
  let startIso: string | null = null;
  let endIso: string | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(startParam)) {
    startIso = new Date(`${startParam}T00:00:00${TR}`).toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(endParam)) {
    const d = new Date(`${endParam}T00:00:00${TR}`);
    d.setDate(d.getDate() + 1); // bitis gunu dahil
    endIso = d.toISOString();
  }

  let tenant;
  try {
    tenant = await resolveTenantBySlug(slug);
  } catch {
    return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });
  }

  let query = tenant.hotelSupabase
    .from('sla_events')
    .select(
      'id, room_number, guest_full_name, request_text, department_code, forwarded_at, sla_deadline, responded_at, escalated_at, reception_sla_deadline, reception_responded_at, final_status, closed_at, created_at'
    )
    // Sadece sorunlular: eskale edilmis VEYA cevapsiz kapanmis
    .or('escalated_at.not.is.null,final_status.eq.no_response')
    .order('created_at', { ascending: false });

  if (departmentParam && departmentParam !== 'all') {
    query = query.eq('department_code', departmentParam);
  }
  if (startIso) query = query.gte('created_at', startIso);
  if (endIso) query = query.lt('created_at', endIso);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'query_failed', detail: error.message }, { status: 500 });
  }

  const now = Date.now();
  const rows = (data || []).map((e) => {
    // Neden: resepsiyon da cevap vermediyse no_response, degilse departman SLA asimi
    const receptionMissed = e.final_status === 'no_response';
    const reason: 'no_response' | 'sla_exceeded' = receptionMissed ? 'no_response' : 'sla_exceeded';

    // Gecen sure (dk): yanitsiz gecen sure. Kapandiysa closed_at'e kadar, acikta ise simdiye kadar.
    // Referans baslangic: eskalasyon zamani (yoksa forward zamani).
    const startRef = e.escalated_at || e.forwarded_at || e.created_at;
    const endRef = e.closed_at || (reason === 'no_response' ? e.closed_at : null);
    const startMs = startRef ? new Date(startRef).getTime() : now;
    const endMs = endRef ? new Date(endRef).getTime() : now;
    const elapsedMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));

    return {
      id: e.id,
      department_code: e.department_code,
      room_number: e.room_number,
      guest_full_name: e.guest_full_name,
      request_text: e.request_text,
      created_at: e.created_at,
      forwarded_at: e.forwarded_at,
      escalated_at: e.escalated_at,
      reception_responded_at: e.reception_responded_at,
      final_status: e.final_status,
      closed_at: e.closed_at,
      reason,
      elapsed_minutes: elapsedMinutes,
      still_open: !e.closed_at,
    };
  });

  return NextResponse.json({ count: rows.length, rows });
}
