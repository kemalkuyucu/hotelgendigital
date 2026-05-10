/**
 * ============================================================================
 * MODÜL 9 — Document Client (CRUD)
 * ============================================================================
 * knowledge_documents tablosu üzerinde tüm DB işlemleri.
 * SupabaseClient alır (hotel-specific).
 * ============================================================================
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DepartmentKey } from '@/lib/hotel-admin/types';

export type DocumentType =
  | 'fact_sheet'
  | 'concept'
  | 'price_list'
  | 'menu'
  | 'reservation'
  | 'allergen'
  | 'schedule'
  | 'custom';

export type ParseStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface KnowledgeDocument {
  id: string;
  department_key: DepartmentKey;
  document_type: DocumentType;
  title: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  uploaded_by_user_id: string | null;
  uploaded_at: string;
  parsed_content: string | null;
  parse_status: ParseStatus;
  parse_error: string | null;
  is_active: boolean;
  version: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

export async function listDocuments(
  hotelSupa: SupabaseClient,
  departmentKey?: DepartmentKey
): Promise<KnowledgeDocument[]> {
  let query = hotelSupa
    .from('knowledge_documents')
    .select('*')
    .order('uploaded_at', { ascending: false });

  if (departmentKey) {
    query = query.eq('department_key', departmentKey);
  }

  const { data, error } = await query;
  if (error) throw new Error(`listDocuments hatası: ${error.message}`);
  return (data ?? []) as KnowledgeDocument[];
}

// ---------------------------------------------------------------------------
// GET ONE
// ---------------------------------------------------------------------------

export async function getDocument(
  hotelSupa: SupabaseClient,
  documentId: string
): Promise<KnowledgeDocument | null> {
  const { data, error } = await hotelSupa
    .from('knowledge_documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (error) return null;
  return data as KnowledgeDocument;
}

// ---------------------------------------------------------------------------
// CREATE (after upload)
// ---------------------------------------------------------------------------

export interface CreateDocumentInput {
  department_key: DepartmentKey;
  document_type: DocumentType;
  title: string;
  file_name: string;
  file_path: string;
  file_size_bytes?: number;
  mime_type?: string;
  uploaded_by_user_id?: string;
  notes?: string;
}

export async function createDocument(
  hotelSupa: SupabaseClient,
  input: CreateDocumentInput
): Promise<KnowledgeDocument> {
  // Önce aynı dept + type'ın mevcut aktif versiyonunu bul
  const { data: existing } = await hotelSupa
    .from('knowledge_documents')
    .select('id, version')
    .eq('department_key', input.department_key)
    .eq('document_type', input.document_type)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = existing ? existing.version + 1 : 1;

  // Eskiyi deactive et
  if (existing) {
    await deactivateDocumentAndSections(hotelSupa, existing.id);
  }

  const { data, error } = await hotelSupa
    .from('knowledge_documents')
    .insert({
      department_key: input.department_key,
      document_type: input.document_type,
      title: input.title,
      file_name: input.file_name,
      file_path: input.file_path,
      file_size_bytes: input.file_size_bytes ?? null,
      mime_type: input.mime_type ?? null,
      uploaded_by_user_id: input.uploaded_by_user_id ?? null,
      notes: input.notes ?? null,
      parse_status: 'pending',
      is_active: true,
      version: nextVersion,
    })
    .select('*')
    .single();

  if (error) throw new Error(`createDocument hatası: ${error.message}`);
  if (!data) throw new Error('createDocument: kayıt dönmedi');
  return data as KnowledgeDocument;
}

// ---------------------------------------------------------------------------
// SOFT DELETE
// ---------------------------------------------------------------------------

export async function deactivateDocumentAndSections(
  hotelSupa: SupabaseClient,
  documentId: string
): Promise<void> {
  const now = new Date().toISOString();

  // Belgeyi deactive et
  await hotelSupa
    .from('knowledge_documents')
    .update({ is_active: false, updated_at: now })
    .eq('id', documentId);

  // Bu belgeden oluşturulan section'ları da deactive et
  await hotelSupa
    .from('knowledge_sections')
    .update({ is_active: false, updated_at: now })
    .eq('source_document_id', documentId);
}

// ---------------------------------------------------------------------------
// UPDATE PARSE STATUS
// ---------------------------------------------------------------------------

export async function setParseStatus(
  hotelSupa: SupabaseClient,
  documentId: string,
  status: ParseStatus,
  opts?: { parsedContent?: string; parseError?: string }
): Promise<void> {
  const payload: Record<string, unknown> = {
    parse_status: status,
    updated_at: new Date().toISOString(),
  };
  if (opts?.parsedContent !== undefined) payload.parsed_content = opts.parsedContent;
  if (opts?.parseError !== undefined) payload.parse_error = opts.parseError;

  const { error } = await hotelSupa
    .from('knowledge_documents')
    .update(payload)
    .eq('id', documentId);

  if (error) throw new Error(`setParseStatus hatası: ${error.message}`);
}

// ---------------------------------------------------------------------------
// COUNT BY DEPARTMENT (dashboard kartı için)
// ---------------------------------------------------------------------------

export async function countDocumentsByDept(
  hotelSupa: SupabaseClient
): Promise<Record<string, number>> {
  const { data, error } = await hotelSupa
    .from('knowledge_documents')
    .select('department_key')
    .eq('is_active', true);

  if (error) throw new Error(`countDocumentsByDept hatası: ${error.message}`);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const key = (row as { department_key: string }).department_key;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
