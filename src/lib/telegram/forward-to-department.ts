// Modül 6 — Departman grubuna mesaj forward
// Modül 8 ile güncellendi: grup mesajı + vardiyadaki aktif personele bireysel DM
// Modül 8.1 ile güncellendi: front-office CC + console.log + BigInt cast + 3 ayrı mesaj şablonu

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
  guestName: string;
  guestMessage: string;
  aiResponse: string;
  confidence: number;
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
  } = input;

  // Türkiye saati — Intl.DateTimeFormat ile güvenilir
  const trDateStr = getTurkishDateStr();

  const confidencePercent = Math.round(confidence * 100);
  const reroutedNote = wasRerouted
    ? '\n⚠️ <i>Off-hours veya sınıflandırılamadı — resepsiyona yönlendirildi</i>'
    : '';

  const deptDisplayLabel = DEPT_LABELS[targetDept] ?? targetDept;

  // ─── 1. GRUP MESAJI ──────────────────────────────────────────────────────
  console.log(`[forward] starting forward → dept=${targetDept} chatId=${targetChatId}`);

  const groupMsgText = formatGroupMessage({
    guestName,
    guestMessage,
    aiResponse,
    targetDept,
    deptDisplayLabel,
    confidencePercent,
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

  // targetDept valid DepartmentKey mi kontrol et
  const validDepts: DepartmentKey[] = [
    'front_office', 'housekeeping', 'technical', 'fb',
    'guest_relation', 'spa', 'animation',
  ];

  const deptKey = targetDept as DepartmentKey;

  if (validDepts.includes(deptKey)) {
    console.log(`[forward] checking active staff for dept=${targetDept}...`);
    try {
      const activeStaff = await getActiveStaffNow(hotelSupa, deptKey);
      console.log(`[forward] found ${activeStaff.length} active staff for ${targetDept}`);

      for (const staff of activeStaff) {
        if (!staff.telegram_user_id) {
          console.log(`[forward] skipping ${staff.full_name} — no telegram_user_id`);
          continue;
        }

        const dmText = formatStaffDmMessage({
          staffFullName: staff.full_name,
          guestName,
          guestMessage,
          deptDisplayLabel,
          trDateStr,
        });

        // BigInt cast — DB target_chat_id bigint, telegram_user_id text olarak saklanıyor
        let dmChatId: number;
        try {
          dmChatId = Number(BigInt(staff.telegram_user_id));
        } catch {
          console.error(`[forward] invalid telegram_user_id for ${staff.full_name}: ${staff.telegram_user_id}`);
          continue;
        }

        console.log(`[forward] sending DM to ${staff.full_name} (${staff.telegram_user_id})...`);
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

          console.log(`[forward] DM sent to ${staff.full_name} → messageId=${dmSent.message_id}`);
        } catch (dmErr) {
          // DM başarısız (kullanıcı bot'u block etmiş olabilir) → logla ve DB'ye yaz, devam et
          const dmErrMsg = dmErr instanceof Error ? dmErr.message : String(dmErr);
          console.error(`[forward] DM failed for ${staff.full_name} (${staff.telegram_user_id}):`, dmErrMsg);

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
      // Vardiya hesabı başarısız → sadece logla, asıl forward etkilenmesin
      console.error('[forward] getActiveStaffNow error:', staffErr instanceof Error ? staffErr.message : staffErr);
    }
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
          guestName,
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

/** Şablon 1: Departman grubuna — eylem talebi */
function formatGroupMessage(args: {
  guestName: string;
  guestMessage: string;
  aiResponse: string;
  targetDept: string;
  deptDisplayLabel: string;
  confidencePercent: number;
  trDateStr: string;
  reroutedNote: string;
}): string {
  return [
    `🆕 <b>Misafir Talebi</b>`,
    ``,
    `👤 Misafir: ${escapeHtml(args.guestName)}`,
    `📝 Mesaj: ${escapeHtml(args.guestMessage)}`,
    `🤖 AI Cevabı: ${escapeHtml(args.aiResponse)}`,
    `📊 Departman: <code>${args.targetDept}</code> | Güven: %${args.confidencePercent}`,
    `🕐 ${args.trDateStr}`,
    args.reroutedNote,
  ]
    .filter((l) => l !== undefined)
    .join('\n');
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
    ``,
    `Bu mesaj size özel iletildi. İlgili departman grubunda da kayıtlıdır.`,
  ].join('\n');
}

/** Şablon 3: Resepsiyon (front_office) CC — bilgilendirme, eylem değil */
function formatFrontOfficeCcMessage(args: {
  guestName: string;
  guestMessage: string;
  deptDisplayLabel: string;
  trDateStr: string;
}): string {
  return [
    `ℹ️ <b>BİLGİLENDİRME</b>`,
    ``,
    `Aşağıdaki talep <b>${escapeHtml(args.deptDisplayLabel)}</b> departmanına iletildi.`,
    ``,
    `👤 Misafir: ${escapeHtml(args.guestName)}`,
    `📝 Talep: "${escapeHtml(args.guestMessage)}"`,
    `🕐 Saat: ${args.trDateStr}`,
    ``,
    `Bu mesaj sadece haberdar olmanız içindir.`,
    `İlgili departman aksiyon alacaktır. Aksi durumda SLA aşımında bilgilendirileceksiniz.`,
  ].join('\n');
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
