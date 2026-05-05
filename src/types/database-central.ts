/**
 * Type definitions for Central Supabase tables.
 * Module 2 will replace this with auto-generated types from Supabase CLI.
 */

export interface Package {
  id: string;
  code: 'basic' | 'full' | 'premium';
  display_name: string;
  description: string | null;
  features: Record<string, unknown>;
  monthly_price_usd: number | null;
  is_active: boolean;
}

export interface Hotel {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string | null;
  package_id: string;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_months: number | null;
  monthly_revenue_usd: number;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  status: 'active' | 'suspended' | 'cancelled' | 'demo';
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface BridgeCredentials {
  id: string;
  hotel_id: string;
  supabase_url_encrypted: string;
  supabase_anon_key_encrypted: string;
  supabase_service_key_encrypted: string;
  is_healthy: boolean;
  last_verified_at: string | null;
}

export interface ChannelRouting {
  id: string;
  hotel_id: string;
  channel_type: 'whatsapp' | 'telegram' | 'instagram';
  channel_identifier: string;
  is_active: boolean;
}

export interface MasterAdmin {
  id: string;
  username: string;
  password_hash: string;
  full_name: string;
  email: string | null;
  role: 'super_admin' | 'admin' | 'support' | 'default_admin';
  is_active: boolean;
  last_login_at: string | null;
}
