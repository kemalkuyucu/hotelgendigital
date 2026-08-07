/**
 * POST /api/csp-report — CSP ihlal raporlarini toplar (Faz 1, Report-Only).
 *
 * Tarayici, `report-uri` (eski, application/csp-report) VE `report-to`/Reporting-API
 * (yeni, application/reports+json) formatlarinda AUTH'SUZ POST eder — bu yuzden auth YOK.
 * Sadece Vercel log'una tek satir yazar: [csp-report] directive=... blocked=... doc=...
 *
 * Koruma: (directive|blocked) bazli in-memory dedup (yalniz ILK gorus loglanir) +
 * key ust siniri + body-size guard (flood + PII sizinti yuzeyini kucultur).
 * Her zaman 204 doner (tarayici retry etmesin); parse hatasi YUTULMAZ, loglanir.
 *
 * NOT: middleware matcher'i /api'yi HARIC tutar -> bu endpoint CSP header'i ALMAZ
 * ve webhook hot-path'e dokunmaz.
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Vercel instance basina in-memory dedup (kalici degil — amac log gurultusunu kesmek).
const seen = new Map<string, number>();
const MAX_KEYS = 500;
const MAX_BODY = 64 * 1024; // 64KB — CSP raporu bundan cok kucuktur; buyugu flood/PII riski.

function firstSight(key: string): boolean {
  const n = seen.get(key) ?? 0;
  seen.set(key, n + 1);
  if (seen.size > MAX_KEYS) seen.clear(); // basit tasma korumasi (sinirsiz buyumeyi onler)
  return n === 0;
}

interface ParsedReport {
  directive: string;
  blocked: string;
  doc: string;
}

function no(v: unknown): string {
  return typeof v === 'string' && v.length > 0 ? v : '?';
}

export async function POST(req: NextRequest) {
  // Body-size guard (once Content-Length ile ucuz kontrol).
  const clen = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(clen) && clen > MAX_BODY) {
    console.warn(`[csp-report] body-too-large len=${clen}, atlandi`);
    return new NextResponse(null, { status: 204 });
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    console.warn('[csp-report] body okunamadi');
    return new NextResponse(null, { status: 204 });
  }
  if (raw.length > MAX_BODY) {
    console.warn('[csp-report] body-too-large (text), atlandi');
    return new NextResponse(null, { status: 204 });
  }

  const reports: ParsedReport[] = [];
  try {
    const json = JSON.parse(raw);
    if (json && typeof json === 'object' && json['csp-report']) {
      // Eski format: { "csp-report": { "violated-directive", "blocked-uri", ... } }
      const r = json['csp-report'];
      reports.push({
        directive: no(r['effective-directive'] ?? r['violated-directive']),
        blocked: no(r['blocked-uri']),
        doc: no(r['document-uri']),
      });
    } else if (Array.isArray(json)) {
      // Yeni Reporting-API: [ { type: 'csp-violation', body: { effectiveDirective, blockedURL, documentURL } } ]
      for (const item of json) {
        if (item && item.type === 'csp-violation' && item.body) {
          const b = item.body;
          reports.push({
            directive: no(b.effectiveDirective ?? b.violatedDirective),
            blocked: no(b.blockedURL),
            doc: no(b.documentURL),
          });
        }
      }
    }
  } catch {
    console.warn('[csp-report] parse-error (gecersiz JSON)');
    return new NextResponse(null, { status: 204 });
  }

  for (const rep of reports) {
    const key = `${rep.directive}|${rep.blocked}`;
    if (firstSight(key)) {
      console.log(`[csp-report] directive=${rep.directive} blocked=${rep.blocked} doc=${rep.doc}`);
    }
  }
  return new NextResponse(null, { status: 204 });
}
