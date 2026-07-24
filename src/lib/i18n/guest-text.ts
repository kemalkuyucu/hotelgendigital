// ── MISAFIRE DONUK SABIT METIN — DIL SECIMI (TEK KAYNAK) ─────────────────────
//
// SAF MODUL: IO yok, ag yok, LLM yok. Misafire giden SABIT metinlerin dil-basina
// karsiligini tutar. "Hangi dil" karari KODDA (KALICI KARAR #3); metnin kendisi
// STATIK — forward'i/akisi yoneten kapinin metnini LLM YAZAMAZ (SAHTE VAAT YASAGI).
//
// Desteklenen kume tr/en/de/ru/ar: route.ts'teki mevcut dogrulama sozluklerinin
// (getVerificationAskMsg / getVerificationSuccessMsg) dil kumesiyle AYNI — ikinci
// bir dil kumesi acmak iki gercek uretir.
//
// BILINMEYEN kod -> 'en' (TR DEGIL): misafir Turkce yazmadigini zaten gosterdi;
// anlamadigi Turkce yerine EN daha yuksek anlasilma sansi verir. TR'ye dusurmek
// isteyen cagiran taraf kendi fallback'ini ONCE uygular.

export type GuestLang = 'tr' | 'en' | 'de' | 'ru' | 'ar';

const SUPPORTED: readonly string[] = ['tr', 'en', 'de', 'ru', 'ar'];

/**
 * Herhangi bir dil kodunu ("EN", "en-US", "English", "de_DE") desteklenen 5 dilden
 * birine indirger. Tanimadigi her sey -> 'en'.
 */
export function normalizeGuestLang(code: string | null | undefined): GuestLang {
  const c = String(code ?? '').trim().toLowerCase().slice(0, 2);
  return SUPPORTED.includes(c) ? (c as GuestLang) : 'en';
}

export type GuestTextKey =
  | 'name_match_failed'   // 17.7-B: coklu eslesmede isim tutmadi, on buro devrede
  | 'reverify_updated'    // re-verify basarili: yeni oda kaydedildi, talep iletilsin mi
  | 'reverify_no_match'   // re-verify: in-house listesinde eslesme yok
  | 'already_verified'    // salt-dogrulama tekrari (forward YOK)
  // IS 18 — etkinlik/organizasyon lead akisi (bkz. src/lib/lead/lead-capture.ts).
  // Misafir turu ayrimi YOK: inhouse da olsa disaridan da yazsa AYNI metinler gider.
  | 'lead_ask_all'        // acilis: isim + soyisim + telefon TEK seferde istenir
  | 'lead_ask_phone'      // yalniz telefon eksik
  | 'lead_ask_name'       // yalniz isim-soyisim eksik
  | 'lead_close'          // misafir vazgecti: kart DUSMEZ -> iletim VAAT EDILMEZ
  | 'lead_thanks';        // isim+telefon tamam: kart dustu -> "ilettim" DOGRU

// Yer tutucular: {name} misafir adi, {room} oda numarasi.
// TR metinler mevcut route.ts karsiliklarindan BIREBIR tasindi (hitap dahil) —
// davranis-notr; ceviri EKLENDI, Turkce metin DEGISMEDI.
const TEXTS: Record<GuestTextKey, Record<GuestLang, string>> = {
  name_match_failed: {
    tr: 'İsminizi eşleştiremedik. Ön büromuz sizinle iletişime geçecek, lütfen bekleyiniz.',
    en: "We couldn't match your name. Our front desk will contact you shortly, please wait.",
    de: 'Wir konnten Ihren Namen nicht zuordnen. Unsere Rezeption meldet sich in Kürze bei Ihnen, bitte warten Sie.',
    ru: 'Мы не смогли найти ваше имя. Наша стойка регистрации свяжется с вами, пожалуйста, подождите.',
    ar: 'لم نتمكن من مطابقة اسمك. سيتواصل معك مكتب الاستقبال قريبًا، يرجى الانتظار.',
  },
  reverify_updated: {
    tr: 'Bilgilerinizi güncelledim, {name} Bey. Şu an {room} numaralı odada konakladığınızı kayıt ettim. Talebinizi iletmemi ister misiniz?',
    en: "I've updated your information, {name}. I've recorded that you are now in room {room}. Would you like me to forward your request?",
    de: 'Ihre Informationen wurden aktualisiert, {name}. Ich habe notiert, dass Sie nun in Zimmer {room} sind. Soll ich Ihre Anfrage weiterleiten?',
    ru: 'Я обновил ваши данные, {name}. Записал, что вы сейчас в номере {room}. Передать ваш запрос?',
    ar: 'لقد حدّثت بياناتك، {name}. سجّلت أنك الآن في الغرفة {room}. هل تريد أن أحيل طلبك؟',
  },
  reverify_no_match: {
    tr: 'Verdiğiniz bilgilerle in-house listesinde eşleşme bulamadım. Ön büromuza yönlendiriyorum, sizinle ilgilenecekler.',
    en: "I couldn't find a match for the details you provided. Our front desk will assist you.",
    de: 'Die von Ihnen angegebenen Daten konnten nicht gefunden werden. Unsere Rezeption wird Ihnen helfen.',
    ru: 'Я не нашёл совпадения по указанным данным. Передаю вас на стойку регистрации, вам помогут.',
    ar: 'لم أجد تطابقًا للبيانات التي قدمتها. سأحيلك إلى مكتب الاستقبال وسيساعدونك.',
  },
  already_verified: {
    tr: 'Bilgileriniz zaten doğrulanmış, {name} Bey. Bir talebiniz olduğunda yazmanız yeterli.',
    en: "You're already verified, {name}. Just send your request whenever you need something.",
    de: 'Sie sind bereits verifiziert, {name}. Schreiben Sie einfach Ihre Anfrage, wann immer Sie etwas brauchen.',
    ru: 'Ваши данные уже подтверждены, {name}. Просто напишите, когда вам что-то понадобится.',
    ar: 'تم التحقق من بياناتك بالفعل، {name}. اكتب لي متى احتجت أي شيء.',
  },
  // ── IS 18 lead metinleri ────────────────────────────────────────────────────
  // Yer tutucu YOK: metin misafirin adiyla kisisellestirilmez (isim daha yeni
  // soruluyor; yanlis/eksik ada hitap etmek riskli).
  lead_ask_all: {
    tr: 'Organizasyon veya toplantı salonu için fiyat almak istiyorsanız, sizi ilgili sorumluya aktarabilmem için isim, soyisim ve telefon bilgilerinizi rica ediyorum.',
    en: "If you'd like to get pricing for an event or meeting room, could you please share your name, surname and phone number so I can connect you with the relevant person?",
    de: 'Wenn Sie einen Preis für eine Veranstaltung oder einen Tagungsraum erhalten möchten, teilen Sie mir bitte Ihren Vornamen, Nachnamen und Ihre Telefonnummer mit, damit ich Sie an die zuständige Person weiterleiten kann.',
    ru: 'Если вы хотите узнать стоимость проведения мероприятия или аренды конференц-зала, пожалуйста, укажите ваше имя, фамилию и номер телефона, чтобы я мог передать вас ответственному сотруднику.',
    ar: 'إذا كنت ترغب في الحصول على سعر لتنظيم فعالية أو قاعة اجتماعات، فيرجى تزويدي باسمك واسم عائلتك ورقم هاتفك حتى أتمكن من تحويلك إلى الشخص المسؤول.',
  },
  lead_ask_phone: {
    tr: 'Teşekkürler. Sizi sorumluya aktarabilmem için bir de telefon numaranızı rica ediyorum.',
    en: 'Thank you. Could you also share your phone number so I can connect you with the relevant person?',
    de: 'Danke. Bitte teilen Sie mir auch Ihre Telefonnummer mit, damit ich Sie weiterleiten kann.',
    ru: 'Спасибо. Пожалуйста, укажите также номер телефона, чтобы я мог передать вас ответственному сотруднику.',
    ar: 'شكرًا لك. يرجى تزويدي أيضًا برقم هاتفك حتى أتمكن من تحويلك إلى الشخص المسؤول.',
  },
  lead_ask_name: {
    tr: 'Teşekkürler. Sizi sorumluya aktarabilmem için isim ve soyisminizi de rica ediyorum.',
    en: 'Thank you. Could you also share your name and surname so I can connect you with the relevant person?',
    de: 'Danke. Bitte teilen Sie mir auch Ihren Vor- und Nachnamen mit, damit ich Sie weiterleiten kann.',
    ru: 'Спасибо. Пожалуйста, сообщите также ваше имя и фамилию, чтобы я мог передать вас ответственному сотруднику.',
    ar: 'شكرًا لك. يرجى تزويدي أيضًا باسمك واسم عائلتك حتى أتمكن من تحويلك إلى الشخص المسؤول.',
  },
  // VAZGECME: kart DUSMEDIGI icin "ilettim/ekibimiz ilgilenecek" DENMEZ (SAHTE VAAT
  // YASAGI) — iletilmemis bir talebi iletilmis gibi gostermek yalan olurdu.
  lead_close: {
    tr: 'Sorun değil. Dilediğiniz zaman tekrar yazabilirsiniz, yardımcı olmaktan memnuniyet duyarım.',
    en: 'No problem. You can write to me again anytime; I would be glad to help.',
    de: 'Kein Problem. Sie können mir jederzeit wieder schreiben, ich helfe Ihnen gerne.',
    ru: 'Хорошо. Вы можете написать мне снова в любое время, буду рад помочь.',
    ar: 'لا مشكلة. يمكنك مراسلتي مرة أخرى في أي وقت، ويسعدني مساعدتك.',
  },
  // TAMAMLANDI: kart On Buro'ya DUSTU -> "ilettim" DOGRU (vaat degil, olmus is).
  lead_thanks: {
    tr: 'Teşekkürler, bilgilerinizi ilettim; ekibimiz en kısa sürede sizinle iletişime geçecek.',
    en: "Thank you, I've passed your details on; our team will contact you shortly.",
    de: 'Vielen Dank, ich habe Ihre Angaben weitergeleitet; unser Team wird sich in Kürze bei Ihnen melden.',
    ru: 'Спасибо, я передал ваши данные; наша команда свяжется с вами в ближайшее время.',
    ar: 'شكرًا لك، لقد أرسلت بياناتك؛ سيتواصل معك فريقنا في أقرب وقت.',
  },
};

/**
 * Sabit misafir metnini istenen dilde dondurur.
 * `params` yer tutuculari doldurur ({name}, {room}); verilmeyen yer tutucu BOS string olur
 * (mevcut route.ts davranisi: `${firstName ?? ''}`).
 */
export function guestText(
  key: GuestTextKey,
  lang: string | null | undefined,
  params?: Record<string, string | null | undefined>,
): string {
  const tpl = TEXTS[key][normalizeGuestLang(lang)];
  if (!params) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_m, k: string) => String(params[k] ?? ''));
}
