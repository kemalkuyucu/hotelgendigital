// Modül 6 — Off-hours routing helper
// Sınıflandırılan departmanın mesai durumunu değerlendirir ve gerekirse yönlendirir.

export interface DeptRouteInfo {
  code: string;
  telegram_chat_id: number | null;
  working_hours: string | null;       // "09:00-18:00" formatı (opsiyonel)
  off_hours_behavior: string | null;  // "forward_to_reception" | null
}

export interface RoutingResult {
  targetDept: string;
  targetChatId: number;
  wasRerouted: boolean;   // off-hours sebebiyle yön değiştirildiyse true
}

/**
 * Sınıflandırılan departmanı ve off-hours kurallarını değerlendirerek
 * gerçek hedef departman ve chat_id'yi döner.
 *
 * Kural sırası:
 * 1. classifiedDept null → front_office
 * 2. classifiedDept'in chat_id yok → front_office
 * 3. off_hours_behavior = "forward_to_reception" ve şu an mesai dışı → front_office
 * 4. Aksi hâlde: classifiedDept direkt kullan
 */
export function resolveTargetDepartment(
  classifiedDept: string | null,
  departments: DeptRouteInfo[],
): RoutingResult | null {
  const deptMap = new Map<string, DeptRouteInfo>();
  for (const d of departments) deptMap.set(d.code, d);

  const frontOffice = deptMap.get('front_office');

  // Sınıflandırılamadıysa front_office'e gönder
  if (!classifiedDept) {
    if (!frontOffice?.telegram_chat_id) return null;
    return {
      targetDept: 'front_office',
      targetChatId: frontOffice.telegram_chat_id,
      wasRerouted: true,
    };
  }

  const dept = deptMap.get(classifiedDept);

  // Dept bulunamadı veya chat_id yok → front_office'e yönlendir
  if (!dept || !dept.telegram_chat_id) {
    if (!frontOffice?.telegram_chat_id) return null;
    return {
      targetDept: 'front_office',
      targetChatId: frontOffice.telegram_chat_id,
      wasRerouted: true,
    };
  }

  // Off-hours kontrolü (working_hours varsa)
  if (dept.off_hours_behavior === 'forward_to_reception' && dept.working_hours) {
    const isOffHours = checkIfOffHours(dept.working_hours);
    if (isOffHours && frontOffice?.telegram_chat_id) {
      return {
        targetDept: 'front_office',
        targetChatId: frontOffice.telegram_chat_id,
        wasRerouted: true,
      };
    }
  }

  return {
    targetDept: dept.code,
    targetChatId: dept.telegram_chat_id,
    wasRerouted: false,
  };
}

/**
 * working_hours: "09:00-18:00" formatını parse eder.
 * Türkiye saatine (UTC+3) göre hesaplar.
 * Hata olursa false döner (mesai içi sayılır).
 */
function checkIfOffHours(workingHours: string): boolean {
  try {
    const [startStr, endStr] = workingHours.split('-');
    if (!startStr || !endStr) return false;

    const [startH, startM] = startStr.trim().split(':').map(Number);
    const [endH, endM] = endStr.trim().split(':').map(Number);

    // UTC+3 (Türkiye)
    const now = new Date();
    const trHour = (now.getUTCHours() + 3) % 24;
    const trMinute = now.getUTCMinutes();
    const currentMinutes = trHour * 60 + trMinute;

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return currentMinutes < startMinutes || currentMinutes >= endMinutes;
  } catch {
    return false;
  }
}
