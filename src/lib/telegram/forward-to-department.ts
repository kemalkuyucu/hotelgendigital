// Modül 6 — Departman grubuna mesaj forward
// Modül 8 ile güncellendi: grup mesajı + vardiyadaki aktif personele bireysel DM
// Modül 8.1 ile güncellendi: front-office CC + console.log + BigInt cast + 3 ayrı mesaj şablonu
// Modül 10.3 ile güncellendi: staff DM guard, template sadelestirme, misafir adı kaynağı

import { SupabaseClient } from '@supabase/supabase-js';
import { TelegramClient } from './client';
import { getActiveStaffNow } from '@/lib/hotel-admin/staff-client';
import type { DepartmentKey } from '@/lib/hotel-admin/types';

export interface ForwardInput {
  hotelSupa: SupabaseClient;     // Demo Hotel DB client
  tg: TelegramClient;            // Misafir bot TelegramClient (token'a sahip)
  aiIntentId: string | null;
  classifiedDepartment: string | null; // AI'ın sınıfladığı asıl departman (off-hours öncesi)
  targetDept: string;
  targetChatId: number;
  wasRerouted: boolean;          // off-hours sebebiyle yönlendirildiyse true
  isOffHours: boolean;           // O an off-hours muydu
  guestName: string;             // Telegram profil ismi (fallback)
  guestMessage: string;
  aiResponse: string;
  confidence: number;
  // Modül 10.3: Doğrulanmış misafir bilgisi — forward template'inde öncelikli kullanılır
  verifiedGuest?: {
    first_name: string | null;
    last_name: string | null;
    room_number: string | null;
  } | null;
  // Modül 10.3: Conversation'ın guest_telegram_id'si — staff DM guard için
  guestTelegramId?: string | null;
}

export interface ForwardResult {
  status: 'sent' | 'failed';
  telegramMessageId?: number;
  error?: string;
}

// Operasyonel departmanlar — talep iletildiğinde Demo_OnBuro CC alır
const CC_TO_FRONT_OFFICE: string[] = ['technical', 'housekeeping', 'fb'];

// Departman label'ları — CC ve DM mesajlarında kullanılır
const DEPT_LABELS: Record<string, string> = {
  front_office: '🛎️ Ön Büro',
  housekeeping: '🧹 Housekeeping',
  technical: '🔧 Teknik Servis',
  fb: '🍽️ F&B',
  guest_relation: '💼 Guest Relation',
  spa: '💆 SPA',
  animation: '🎭 Animasyon',
};

export async function forwardToDepartment(input: ForwardInput): Promise<ForwardResult> {
  const {
    hotelSupa,
    tg,
    aiIntentId,
    classifiedDepartment,
    targetDept,
    targetChatId,
    wasRerouted,
    isOffHours,
    guestName,
    guestMessage,
    aiResponse,
    confidence,
    verifiedGuest,
    guestTelegramId,
  } = input;

  // Türkiye saati — Intl.DateTimeFormat ile güvenilir
  const trDateStr = getTurkishDateStr();

  const reroutedNote = wasRerouted
    ? '\n⚠️ <i>Off-hours veya sınıflandırılamadı — resepsiyona yönlendirildi</i>'
    : '';

  const deptDisplayLabel = DEPT_LABELS[targetDept] ?? targetDept;

  // Modül 10.3: Misafir adı önceliği — verifiedGuest (inhouse) > guestName (Telegram profil)
  const resolvedGuestName = resolveGuestName(verifiedGuest ?? null, guestName);
  const resolvedRoomNumber = verifiedGuest?.room_number ?? null;

  // ─── 1. GRUP MESAJI ──────────────────────────────────────────────────────
  console.log(`[forward] starting forward → dept=${targetDept} chatId=${targetChatId}`);

  const groupMsgText = formatGroupMessage({
    guestName: resolvedGuestName,
    roomNumber: resolvedRoomNumber,
    guestMessage,
    trDateStr,
    reroutedNote,
  });

  // forwarded_messages tablosuna pending kaydı oluştur (grup)
  const { data: fwdRow, error: insertError } = await hotelSupa
    .from('forwarded_messages')
    .insert({
      ai_intent_id: aiIntentId ?? null,
      source_department: classifiedDepartment ?? null,
      target_department: targetDept,
      target_chat_id: targetChatId,
      is_off_hours: isOffHours,
      status: 'pending',
      target_type: 'group',
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[forward] forwarded_messages group insert error:', insertError.message);
  }

  const fwdId = fwdRow?.id as string | undefined;

  // Telegram grubuna mesajı gönder
  let telegramMessageId: number | undefined;
  let sendError: string | undefined;

  try {
    const sent = await tg.sendMessage({
      chat_id: targetChatId,
      text: groupMsgText,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
    telegramMessageId = sent.message_id;
    console.log(`[forward] group message sent → messageId=${telegramMessageId}`);
  } catch (err) {
    sendError = err instanceof Error ? err.message : 'unknown send error';
    console.error('[forward] Telegram group send error:', sendError);
  }

  // forwarded_messages kaydını güncelle
  if (fwdId) {
    await hotelSupa
      .from('forwarded_messages')
      .update({
        status: sendError ? 'failed' : 'sent',
        telegram_message_id: telegramMessageId ?? null,
        error: sendError ?? null,
      })
      .eq('id', fwdId);
  }

  // ─── 2. BİREYSEL DM — Vardiyadaki aktif personele ────────────────────────

  const deptKey = targetDept as DepartmentKey;

  console.log(`[fwd] DM start dept=${targetDept}`);
  try {
    const activeStaff = await getActiveStaffNow(hotelSupa, deptKey);
    console.log(`[fwd] staff_count=${activeStaff.length}`);

    for (const staff of activeStaff) {
      if (!staff.telegram_user_id) {
        console.log(`[fwd] DM skip ${staff.full_name} — no telegram_user_id`);
        continue;
      }

      // Modül 10.3: GUARD — staff telegram_id, misafirin chat_id'siyle eşleşiyorsa DM atla
      if (guestTelegramId && String(staff.telegram_user_id) === String(guestTelegramId)) {
        console.log(`[fwd] DM GUARD: staff_telegram_id=${staff.telegram_user_id} matches guest_telegram_id — skipping DM to avoid sending to guest`);
        continue;
      }

      const dmText = formatStaffDmMessage({
        staffFullName: staff.full_name,
        guestName: resolvedGuestName,
        guestMessage,
        deptDisplayLabel,
        trDateStr,
      });

      // BigInt cast — telegram_user_id text olarak saklanıyor
      let dmChatId: number;
      try {
        dmChatId = Number(BigInt(staff.telegram_user_id));
      } catch {
        console.error(`[fwd] DM error: invalid telegram_user_id for ${staff.full_name}: ${staff.telegram_user_id}`);
        continue;
      }

      try {
        const dmSent = await tg.sendMessage({
          chat_id: dmChatId,
          text: dmText,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        });

        await hotelSupa
          .from('forwarded_messages')
          .insert({
            ai_intent_id: aiIntentId ?? null,
            source_department: classifiedDepartment ?? null,
            target_department: targetDept,
            target_chat_id: dmChatId,
            is_off_hours: isOffHours,
            status: 'sent',
            target_type: 'staff_dm',
            telegram_message_id: dmSent.message_id,
          });

        console.log(`[fwd] DM sent to ${dmChatId}`);
      } catch (dmErr) {
        // DM başarısız (kullanıcı bot'u block etmiş olabilir) → logla ve DB'ye yaz, devam et
        const dmErrMsg = dmErr instanceof Error ? dmErr.message : String(dmErr);
        console.error(`[fwd] DM error: ${dmErrMsg}`);

        await hotelSupa
          .from('forwarded_messages')
          .insert({
            ai_intent_id: aiIntentId ?? null,
            source_department: classifiedDepartment ?? null,
            target_department: targetDept,
            target_chat_id: dmChatId,
            is_off_hours: isOffHours,
            status: 'failed',
            target_type: 'staff_dm',
            error: dmErrMsg.slice(0, 500),
          });
      }
    }
  } catch (staffErr) {
    // Vardiya hesabı başarısız → full error logla (yutma)
    console.error(`[fwd] DM error: getActiveStaffNow FAILED: ${staffErr instanceof Error ? staffErr.stack ?? staffErr.message : String(staffErr)}`);
  }

  // ─── 3. RESEPSIYON CC — Operasyonel departmanlarda Demo_OnBuro haberdar edilir ──

  if (CC_TO_FRONT_OFFICE.includes(targetDept)) {
    console.log(`[forward] checking front_office CC for dept=${targetDept}...`);
    try {
      // front_office departmanının telegram_chat_id'sini DB'den çek
      const { data: foRow, error: foErr } = await hotelSupa
        .from('departments')
        .select('telegram_chat_id')
        .eq('code', 'front_office')
        .eq('is_enabled', true)
        .maybeSingle();

      if (foErr) {
        console.error('[forward] front_office dept query error:', foErr.message);
      } else if (!foRow?.telegram_chat_id) {
        console.log('[forward] front_office telegram_chat_id bulunamadı — CC atlandı');
      } else {
        const frontOfficeChatId = foRow.telegram_chat_id as number;

        const ccMsgText = formatFrontOfficeCcMessage({
          guestName: resolvedGuestName,
          roomNumber: resolvedRoomNumber,
          guestMessage,
          deptDisplayLabel,
          trDateStr,
        });

        const sent = await tg.sendMessage({
          chat_id: frontOfficeChatId,
          text: ccMsgText,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        });

        await hotelSupa
          .from('forwarded_messages')
          .insert({
            ai_intent_id: aiIntentId ?? null,
            source_department: classifiedDepartment ?? null,
            target_department: 'front_office',
            target_chat_id: frontOfficeChatId,
            is_off_hours: isOffHours,
            status: 'sent',
            target_type: 'group_cc',
            telegram_message_id: sent.message_id,
          });

        console.log(`[forward] front_office CC sent → chatId=${frontOfficeChatId} messageId=${sent.message_id}`);
      }
    } catch (ccErr) {
      console.error('[forward] front office CC failed:', ccErr instanceof Error ? ccErr.message : ccErr);
    }
  } else {
    console.log(`[forward] no CC for dept=${targetDept} (not in CC list)`);
  }

  // ─── SONUÇ ────────────────────────────────────────────────────────────────

  if (sendError) {
    return { status: 'failed', error: sendError };
  }
  return { status: 'sent', telegramMessageId };
}

// ─── MESAJ ŞABLONLARI ─────────────────────────────────────────────────────────

/**
 * Modül 10.3: Misafir adını çöz.
 * Öncelik: verifiedGuest (inhouse_guests) > fallbackName (Telegram profili)
 */
function resolveGuestName(
  verifiedGuest: { first_name: string | null; last_name: string | null } | null,
  fallbackName: string,
): string {
  if (verifiedGuest) {
    const name = `${verifiedGuest.first_name ?? ''} ${verifiedGuest.last_name ?? ''}`.trim();
    if (name) return name.toUpperCase();
  }
  return (fallbackName || '(bilinmiyor)').toUpperCase();
}

/** Şablon 1: Departman grubuna — eylem talebi (Modül 10.3: sadeleştirildi, 5 alan) */
function formatGroupMessage(args: {
  guestName: string;
  roomNumber: string | null;
  guestMessage: string;
  trDateStr: string;
  reroutedNote: string;
}): string {
  const roomLine = args.roomNumber ? `🚪 <b>Oda:</b> ${escapeHtml(args.roomNumber)}\n` : '';
  return (
    `🛎 <b>Misafir Talebi</b>\n\n` +
    roomLine +
    `👤 <b>Misafir:</b> ${escapeHtml(args.guestName)}\n` +
    `📝 <b>Talep:</b> "${escapeHtml(args.guestMessage)}"\n` +
    `🕐 <b>Saat:</b> ${escapeHtml(args.trDateStr)}` +
    args.reroutedNote
  );
}

/** Şablon 2: Vardiyadaki personele bireysel DM — kişiye özel */
function formatStaffDmMessage(args: {
  staffFullName: string;
  guestName: string;
  guestMessage: string;
  deptDisplayLabel: string;
  trDateStr: string;
}): string {
  return [
    `🔔 <b>VARDİYANIZDA TALEP</b>`,
    ``,
    `Sayın ${escapeHtml(args.staffFullName)},`,
    `Aşağıdaki talep şu an sizin vardiyanızda geldi.`,
    ``,
    `📂 Departman: ${escapeHtml(args.deptDisplayLabel)}`,
    `👤 Misafir: ${escapeHtml(args.guestName)}`,
    `📝 Talep: "${escapeHtml(args.guestMessage)}"`,
    `🕐 Saat: ${args.trDateStr}`,
  ].join('\n');
}

/** Şablon 3: Resepsiyon (front_office) CC — bilgilendirme (Modül 10.3: sadeleştirildi) */
function formatFrontOfficeCcMessage(args: {
  guestName: string;
  roomNumber: string | null;
  guestMessage: string;
  deptDisplayLabel: string;
  trDateStr: string;
}): string {
  const roomLine = args.roomNumber ? `🚪 <b>Oda:</b> ${escapeHtml(args.roomNumber)}\n` : '';
  return (
    `ℹ️ <b>Bilgilendirme:</b> ${escapeHtml(args.deptDisplayLabel)} departmanına iletildi.\n\n` +
    roomLine +
    `👤 <b>Misafir:</b> ${escapeHtml(args.guestName)}\n` +
    `📝 <b>Talep:</b> "${escapeHtml(args.guestMessage)}"\n` +
    `🕐 <b>Saat:</b> ${escapeHtml(args.trDateStr)}\n\n` +
    `<i>Bu mesaj sadece haberdar olmanız içindir. İlgili departman aksiyon alacaktır.</i>`
  );
}

// ─── YARDIMCI FONKSİYONLAR ───────────────────────────────────────────────────

/** Türkiye saatini (Europe/Istanbul) formatlar — Intl.DateTimeFormat ile güvenilir */
function getTurkishDateStr(): string {
  const now = new Date();
  const trFormatter = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return trFormatter.format(now) + ' (TR)';
}

/** HTML özel karakterleri kaçır (&, <, >, ", ') */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
