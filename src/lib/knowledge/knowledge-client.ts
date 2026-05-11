/**
 * ============================================================================
 * KNOWLEDGE BASE — Database Client
 * ============================================================================
 * Demo Hotel Supabase üzerinden hotel_facts ve knowledge_sections
 * okuma/yazma işlemleri. getHotelClient() ile bağlanır.
 *
 * Soft delete: is_active = false (audit için kayıt silinmez)
 * ============================================================================
 */

import { getHotelClient } from '@/lib/tenant/get-hotel-client';
import type { HotelFact, HotelFactInput, KnowledgeSection, KnowledgeSectionInput } from './types';

// ----------------------------------------------------------------------------
// FACTS
// ----------------------------------------------------------------------------

export async function listFacts(hotelId: string): Promise<HotelFact[]> {
  const supa = await getHotelClient(hotelId);
  if (!supa) throw new Error(`Hotel client alınamadı: ${hotelId}`);

  const { data, error } = await supa
    .from('hotel_facts')
    .select('id, fact_key, fact_value, fact_label, category, is_active, display_order, created_at, updated_at')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error(`listFacts hatası: ${error.message}`);
  return (data ?? []) as HotelFact[];
}

export async function upsertFact(hotelId: string, fact: HotelFactInput): Promise<HotelFact> {
  const supa = await getHotelClient(hotelId);
  if (!supa) throw new Error(`Hotel client alınamadı: ${hotelId}`);

  const { data, error } = await supa
    .from('hotel_facts')
    .upsert(
      {
        fact_key: fact.fact_key,
        fact_value: fact.fact_value,
        fact_label: fact.fact_label,
        category: fact.category,
        display_order: fact.display_order ?? 0,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'fact_key', ignoreDuplicates: false }
    )
    .select('id, fact_key, fact_value, fact_label, category, is_active, display_order, created_at, updated_at')
    .single();

  if (error) throw new Error(`upsertFact hatası: ${error.message}`);
  if (!data) throw new Error('upsertFact: kayıt dönmedi');
  return data as HotelFact;
}

export async function updateFact(
  hotelId: string,
  factId: string,
  patch: Partial<HotelFactInput>
): Promise<HotelFact> {
  const supa = await getHotelClient(hotelId);
  if (!supa) throw new Error(`Hotel client alınamadı: ${hotelId}`);

  const { data, error } = await supa
    .from('hotel_facts')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', factId)
    .eq('is_active', true)
    .select('id, fact_key, fact_value, fact_label, category, is_active, display_order, created_at, updated_at')
    .single();

  if (error) throw new Error(`updateFact hatası: ${error.message}`);
  if (!data) throw new Error('updateFact: kayıt bulunamadı');
  return data as HotelFact;
}

export async function deleteFact(hotelId: string, factId: string): Promise<void> {
  const supa = await getHotelClient(hotelId);
  if (!supa) throw new Error(`Hotel client alınamadı: ${hotelId}`);

  // Soft delete — audit için kayıt silinmez
  const { error } = await supa
    .from('hotel_facts')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', factId);

  if (error) throw new Error(`deleteFact hatası: ${error.message}`);
}

// ----------------------------------------------------------------------------
// SECTIONS
// ----------------------------------------------------------------------------

export async function listSections(hotelId: string): Promise<KnowledgeSection[]> {
  const supa = await getHotelClient(hotelId);
  if (!supa) throw new Error(`Hotel client alınamadı: ${hotelId}`);

  const { data, error } = await supa
    .from('knowledge_sections')
    .select('id, title, content, category, is_active, display_order, created_at, updated_at')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false }); // DESC: yeni belgeler önce

  if (error) throw new Error(`listSections hatası: ${error.message}`);
  return (data ?? []) as KnowledgeSection[];
}

export async function createSection(
  hotelId: string,
  section: KnowledgeSectionInput
): Promise<KnowledgeSection> {
  const supa = await getHotelClient(hotelId);
  if (!supa) throw new Error(`Hotel client alınamadı: ${hotelId}`);

  const { data, error } = await supa
    .from('knowledge_sections')
    .insert({
      title: section.title,
      content: section.content,
      category: section.category ?? null,
      display_order: section.display_order ?? 0,
      is_active: true,
    })
    .select('id, title, content, category, is_active, display_order, created_at, updated_at')
    .single();

  if (error) throw new Error(`createSection hatası: ${error.message}`);
  if (!data) throw new Error('createSection: kayıt dönmedi');
  return data as KnowledgeSection;
}

export async function updateSection(
  hotelId: string,
  sectionId: string,
  patch: Partial<KnowledgeSectionInput>
): Promise<KnowledgeSection> {
  const supa = await getHotelClient(hotelId);
  if (!supa) throw new Error(`Hotel client alınamadı: ${hotelId}`);

  const { data, error } = await supa
    .from('knowledge_sections')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', sectionId)
    .eq('is_active', true)
    .select('id, title, content, category, is_active, display_order, created_at, updated_at')
    .single();

  if (error) throw new Error(`updateSection hatası: ${error.message}`);
  if (!data) throw new Error('updateSection: kayıt bulunamadı');
  return data as KnowledgeSection;
}

export async function deleteSection(hotelId: string, sectionId: string): Promise<void> {
  const supa = await getHotelClient(hotelId);
  if (!supa) throw new Error(`Hotel client alınamadı: ${hotelId}`);

  // Soft delete
  const { error } = await supa
    .from('knowledge_sections')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', sectionId);

  if (error) throw new Error(`deleteSection hatası: ${error.message}`);
}
