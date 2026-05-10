/**
 * ============================================================================
 * MODÜL 9 — Belge Parser
 * ============================================================================
 * PDF, Word (docx), Excel (xlsx/xls) dosyalarından ham metin çıkarır.
 * Tüm parse hataları ok:false ile döner, throw yapmaz.
 * ============================================================================
 */

export type ParseResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export async function parseDocument(
  fileBuffer: Buffer,
  mimeType: string
): Promise<ParseResult> {
  try {
    // -------------------------------------------------------------------
    // PDF
    // -------------------------------------------------------------------
    if (mimeType === 'application/pdf') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (
        buf: Buffer,
        opts?: Record<string, unknown>
      ) => Promise<{ text: string; numpages: number }>;
      const result = await pdfParse(fileBuffer);
      const text = result.text?.trim() ?? '';
      if (!text) return { ok: false, error: 'PDF boş veya metin içermiyor (taranan PDF olabilir).' };
      return { ok: true, text };
    }

    // -------------------------------------------------------------------
    // Word (.docx / .doc)
    // -------------------------------------------------------------------
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      const text = result.value?.trim() ?? '';
      if (!text) return { ok: false, error: 'Word belgesi boş veya metin içermiyor.' };
      return { ok: true, text };
    }

    // -------------------------------------------------------------------
    // Excel (.xlsx / .xls)
    // -------------------------------------------------------------------
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel'
    ) {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const allText: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        const trimmed = csv.trim();
        if (trimmed) {
          allText.push(`=== ${sheetName} ===\n${trimmed}`);
        }
      }
      if (allText.length === 0) return { ok: false, error: 'Excel belgesi boş.' };
      return { ok: true, text: allText.join('\n\n') };
    }

    return { ok: false, error: `Desteklenmeyen format: ${mimeType}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Parse hatası: ${msg}` };
  }
}
