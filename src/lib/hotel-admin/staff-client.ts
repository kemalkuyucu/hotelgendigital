// Modül 8 — Staff Client: CRUD + Vardiya Hesabı
// Türkiye saatini (Europe/Istanbul) kullanır

import { SupabaseClient } from '@supabase/supabase-js';
import type { Staff, StaffInput, DepartmentKey } from './types';

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

export async function listStaff(
  hotelSupa: SupabaseClient,
  departmentKey?: DepartmentKey
): Promise<Staff[]> {
  let query = hotelSupa
    .from('department_staff')
    .select('*')
    .order('full_name');

  if (departmentKey) {
    query = query.eq('department_key', departmentKey);
  }

  const { data, error } = await query;
  if (error) throw new Error(`listStaff error: ${error.message}`);
  return (data ?? []) as Staff[];
}

// ---------------------------------------------------------------------------
// UPSERT (create or update)
// ---------------------------------------------------------------------------

export async function upsertStaff(
  hotelSupa: SupabaseClient,
  staff: StaffInput
): Promise<Staff> {
  const now = new Date().toISOString();

  if (staff.id) {
    // UPDATE
    const { data, error } = await hotelSupa
      .from('department_staff')
      .update({
        full_name: staff.full_name,
        role_title: staff.role_title ?? null,
        telegram_user_id: staff.telegram_user_id ?? null,
        telegram_username: staff.telegram_username ?? null,
        whatsapp_id: staff.whatsapp_id ?? null,
        shift_start: staff.shift_start ?? null,
        shift_end: staff.shift_end ?? null,
        days_off: staff.days_off ?? [],
        is_active: staff.is_active ?? true,
        notes: staff.notes ?? null,
        updated_at: now,
      })
      .eq('id', staff.id)
      .select()
      .single();

    if (error) throw new Error(`upsertStaff update error: ${error.message}`);
    return data as Staff;
  } else {
    // INSERT
    const { data, error } = await hotelSupa
      .from('department_staff')
      .insert({
        department_key: staff.department_key,
        full_name: staff.full_name,
        role_title: staff.role_title ?? null,
        telegram_user_id: staff.telegram_user_id ?? null,
        telegram_username: staff.telegram_username ?? null,
        whatsapp_id: staff.whatsapp_id ?? null,
        shift_start: staff.shift_start ?? null,
        shift_end: staff.shift_end ?? null,
        days_off: staff.days_off ?? [],
        is_active: staff.is_active ?? true,
        notes: staff.notes ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`upsertStaff insert error: ${error.message}`);
    return data as Staff;
  }
}

// ---------------------------------------------------------------------------
// SOFT DELETE
// ---------------------------------------------------------------------------

export async function deleteStaff(hotelSupa: SupabaseClient, id: string): Promise<void> {
  const { error } = await hotelSupa
    .from('department_staff')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`deleteStaff error: ${error.message}`);
}

// ---------------------------------------------------------------------------
// GET ACTIVE STAFF NOW (Vardiya hesabı)
// ---------------------------------------------------------------------------

/**
 * O anki Türkiye saatini (Europe/Istanbul) Intl.DateTimeFormat ile güvenilir şekilde döner.
 * toLocaleString + new Date() trick'i Vercel serverless'ta tutarsız davranabilir.
 */
function getCurrentTRTime(): { currentMinutes: number; todayKey: string } {
  const now = new Date();
  const trFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = trFormatter.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? 'Mon';

  const dayMap: Record<string, string> = {
    'Mon': 'mon', 'Tue': 'tue', 'Wed': 'wed', 'Thu': 'thu',
    'Fri': 'fri', 'Sat': 'sat', 'Sun': 'sun',
  };

  return {
    currentMinutes: hour * 60 + minute,
    todayKey: dayMap[weekday] ?? 'mon',
  };
}

/**
 * O anki Türkiye saatine (Europe/Istanbul) göre vardiyadaki aktif personeli döner.
 * 
 * Kurallar:
 * - is_active = true
 * - days_off içinde bugünkü gün YOKsa → potansiyel aktif
 * - shift_start ve shift_end NULL ise → 7/24 aktif
 * - Normal vardiya (start <= end): currentTime >= start AND currentTime < end
 * - Gece vardiyası (start > end, örn 22:00-06:00): currentTime >= start OR currentTime < end
 */
export async function getActiveStaffNow(
  hotelSupa: SupabaseClient,
  departmentKey: DepartmentKey
): Promise<Staff[]> {
  // Türkiye saati — Intl.DateTimeFormat ile güvenilir
  const { currentMinutes, todayKey } = getCurrentTRTime();

  // Tüm aktif personeli çek
  const { data, error } = await hotelSupa
    .from('department_staff')
    .select('*')
    .eq('department_key', departmentKey)
    .eq('is_active', true);

  if (error) throw new Error(`getActiveStaffNow error: ${error.message}`);
  const allStaff = (data ?? []) as Staff[];

  // "HH:MM:SS" formatını dakikaya çevir
  const parseTime = (t: string): number => {
    const parts = t.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  };

  // ─── A: Shift DOLU + aktif vardiyada + bugün izinde değil ─────────────────
  const shiftedStaff = allStaff.filter((staff) => {
    // İzin günü kontrolü
    if (staff.days_off && staff.days_off.includes(todayKey)) return false;
    // Shift NULL → bu katmana dahil etme
    if (staff.shift_start === null || staff.shift_end === null) return false;

    const startMin = parseTime(staff.shift_start);
    const endMin = parseTime(staff.shift_end);

    if (startMin <= endMin) {
      // Normal vardiya (örn: 08:00-16:00)
      return currentMinutes >= startMin && currentMinutes < endMin;
    } else {
      // Gece vardiyası (örn: 22:00-06:00)
      return currentMinutes >= startMin || currentMinutes < endMin;
    }
  });

  // Aktif vardiyalı personel varsa onu döndür
  if (shiftedStaff.length > 0) return shiftedStaff;

  // ─── B: Yedek sorumlu — shift_start ve shift_end NULL (7/24) ──────────────
  // Vardiyalı personel yoksa, shift tanımlı olmayan 7/24 yedek sorumluları dön.
  const fallbackStaff = allStaff.filter((staff) => {
    if (staff.days_off && staff.days_off.includes(todayKey)) return false;
    return staff.shift_start === null && staff.shift_end === null;
  });

  return fallbackStaff;
}
