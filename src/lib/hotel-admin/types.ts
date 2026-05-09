// Modül 8 — Hotel Admin Shared Types

export type HotelAdminRole =
  | 'hotel_owner'
  | 'front_office_manager'
  | 'housekeeping_manager'
  | 'technical_manager'
  | 'fb_manager'
  | 'guest_relation_manager'
  | 'spa_manager'
  | 'animation_manager';

export type DepartmentKey =
  | 'front_office'
  | 'housekeeping'
  | 'technical'
  | 'fb'
  | 'guest_relation'
  | 'spa'
  | 'animation';

export interface HotelAdminUser {
  id: string;
  username: string;
  full_name: string;
  role: HotelAdminRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Staff {
  id: string;
  department_key: DepartmentKey;
  full_name: string;
  role_title: string | null;
  telegram_user_id: string | null;
  telegram_username: string | null;
  whatsapp_id: string | null;
  shift_start: string | null; // "HH:MM:SS"
  shift_end: string | null;   // "HH:MM:SS"
  days_off: string[];          // ['mon','tue',...]
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffInput {
  id?: string; // present → update, absent → insert
  department_key: DepartmentKey;
  full_name: string;
  role_title?: string;
  telegram_user_id?: string;
  telegram_username?: string;
  whatsapp_id?: string;
  shift_start?: string; // "HH:MM"
  shift_end?: string;   // "HH:MM"
  days_off?: string[];
  is_active?: boolean;
  notes?: string;
}

/** Role → accessible department keys */
export function getAllowedDepartments(role: HotelAdminRole): DepartmentKey[] {
  if (role === 'hotel_owner') {
    return ['front_office', 'housekeeping', 'technical', 'fb', 'guest_relation', 'spa', 'animation'];
  }
  const map: Record<string, DepartmentKey> = {
    front_office_manager: 'front_office',
    housekeeping_manager: 'housekeeping',
    technical_manager: 'technical',
    fb_manager: 'fb',
    guest_relation_manager: 'guest_relation',
    spa_manager: 'spa',
    animation_manager: 'animation',
  };
  const dept = map[role];
  return dept ? [dept] : [];
}

/** Role → Türkçe label */
export function roleLabel(role: HotelAdminRole): string {
  const labels: Record<HotelAdminRole, string> = {
    hotel_owner: 'Otel Sahibi',
    front_office_manager: 'Ön Büro Müdürü',
    housekeeping_manager: 'Housekeeping Müdürü',
    technical_manager: 'Teknik Müdürü',
    fb_manager: 'F&B Müdürü',
    guest_relation_manager: 'Guest Relation Müdürü',
    spa_manager: 'SPA Müdürü',
    animation_manager: 'Animasyon Müdürü',
  };
  return labels[role] ?? role;
}

/** Department key → Türkçe label */
export function deptLabel(key: DepartmentKey): string {
  const labels: Record<DepartmentKey, string> = {
    front_office: '🛎️ Ön Büro',
    housekeeping: '🧹 Housekeeping',
    technical: '🔧 Teknik Servis',
    fb: '🍽️ F&B',
    guest_relation: '💼 Guest Relation',
    spa: '💆 SPA',
    animation: '🎭 Animasyon',
  };
  return labels[key] ?? key;
}

/** JWT payload stored in cookie */
export interface HotelAdminJwtPayload {
  sub: string;         // user id
  username: string;
  full_name: string;
  role: HotelAdminRole;
  hotel_slug: string;
  hotel_id: string;
}
