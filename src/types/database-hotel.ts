/**
 * Type definitions for Hotel Supabase tables (per-hotel DB).
 */

export type DepartmentCode =
  | 'front_office'
  | 'housekeeping'
  | 'technical'
  | 'fb'
  | 'guest_relation'
  | 'spa'
  | 'animation';

export type ChannelType = 'whatsapp' | 'telegram' | 'instagram';

export interface InhouseGuest {
  id: string;
  room_number: string;
  full_name: string;
  agency: string | null;
  voucher: string | null;
  pax: number;
  check_in_date: string;
  check_out_date: string;
  channel_ids: string[];
  language: string | null;
  vip_status: 'standard' | 'repeat' | 'loyalty' | 'vip';
  is_active: boolean;
}

export interface CustomerFacts {
  id: string;
  channel_type: ChannelType;
  channel_id: string;
  guest_id: string | null;
  full_name: string | null;
  room_number: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  language: string | null;
  allergies: string[];
  dietary_preferences: string[];
  special_requests: string[];
  open_complaint: string | null;
  vip_status: string | null;
  metadata: Record<string, unknown>;
  last_updated_at: string;
}

export interface Department {
  id: string;
  code: DepartmentCode;
  display_name: string;
  is_enabled: boolean;
  sla_minutes: number;
  working_hours: Array<{ day: number; start: string; end: string }>;
  off_hours_behavior: 'forward_to_reception' | 'wait_until_business' | 'reject';
  notification_channel_priority: 'whatsapp' | 'telegram' | 'both';
}

export interface Request {
  id: string;
  ticket_number: string | null;
  channel_type: ChannelType | null;
  channel_id: string | null;
  guest_id: string | null;
  room_number: string | null;
  full_name: string | null;
  request_text: string;
  request_text_tr: string | null;
  language: string;
  intent: string | null;
  department_id: string | null;
  status: 'pending' | 'acknowledged_now' | 'acknowledged_later' | 'in_progress' | 'resolved' | 'escalated' | 'cancelled';
  priority: 'normal' | 'high' | 'emergency';
  is_emergency: boolean;
  is_off_hours: boolean;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_minutes: number | null;
  sla_breached: boolean;
}
