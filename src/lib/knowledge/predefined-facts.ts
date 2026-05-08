/**
 * ============================================================================
 * KNOWLEDGE BASE — Predefined Fact Keys
 * ============================================================================
 * Admin panelinde dropdown olarak gösterilecek hazır anahtarlar.
 * Kullanıcı bunlardan birini seçer veya kendi key'ini yazar.
 * ============================================================================
 */

import type { FactCategory } from './types';

export const PREDEFINED_FACTS = [
  // pool
  { key: 'pool_open_time', label: 'Havuz Açılış Saati', category: 'pool' as FactCategory },
  { key: 'pool_close_time', label: 'Havuz Kapanış Saati', category: 'pool' as FactCategory },
  { key: 'pool_kids_open_time', label: 'Çocuk Havuzu Açılış', category: 'pool' as FactCategory },
  { key: 'pool_kids_close_time', label: 'Çocuk Havuzu Kapanış', category: 'pool' as FactCategory },
  // restaurant
  { key: 'restaurant_breakfast_start', label: 'Kahvaltı Başlangıç', category: 'restaurant' as FactCategory },
  { key: 'restaurant_breakfast_end', label: 'Kahvaltı Bitiş', category: 'restaurant' as FactCategory },
  { key: 'restaurant_lunch_start', label: 'Öğle Yemeği Başlangıç', category: 'restaurant' as FactCategory },
  { key: 'restaurant_lunch_end', label: 'Öğle Yemeği Bitiş', category: 'restaurant' as FactCategory },
  { key: 'restaurant_dinner_start', label: 'Akşam Yemeği Başlangıç', category: 'restaurant' as FactCategory },
  { key: 'restaurant_dinner_end', label: 'Akşam Yemeği Bitiş', category: 'restaurant' as FactCategory },
  // spa
  { key: 'spa_open_time', label: 'Spa Açılış', category: 'spa' as FactCategory },
  { key: 'spa_close_time', label: 'Spa Kapanış', category: 'spa' as FactCategory },
  { key: 'gym_open_time', label: 'Fitness Açılış', category: 'spa' as FactCategory },
  { key: 'gym_close_time', label: 'Fitness Kapanış', category: 'spa' as FactCategory },
  // rooms
  { key: 'check_in_time', label: 'Check-in Saati', category: 'rooms' as FactCategory },
  { key: 'check_out_time', label: 'Check-out Saati', category: 'rooms' as FactCategory },
  { key: 'total_rooms', label: 'Toplam Oda Sayısı', category: 'rooms' as FactCategory },
  // wifi
  { key: 'wifi_ssid', label: 'Wi-Fi Ağ Adı', category: 'wifi' as FactCategory },
  { key: 'wifi_password', label: 'Wi-Fi Şifresi', category: 'wifi' as FactCategory },
  // contact
  { key: 'hotel_phone', label: 'Otel Telefonu', category: 'contact' as FactCategory },
  { key: 'hotel_address', label: 'Otel Adresi', category: 'contact' as FactCategory },
  { key: 'hotel_email', label: 'Otel E-posta', category: 'contact' as FactCategory },
  // beach
  { key: 'beach_distance', label: 'Plaja Mesafe', category: 'beach' as FactCategory },
  { key: 'beach_access', label: 'Plaj Erişimi', category: 'beach' as FactCategory },
] as const;

export type PredefinedFact = (typeof PREDEFINED_FACTS)[number];
