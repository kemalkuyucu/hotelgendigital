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
  | 'lead_thanks'         // isim+telefon tamam: kart dustu -> "ilettim" DOGRU
  // ── P7b Tier-1 — route.ts'teki en/de/tr uclusu ternary'lerinden tasinan
  //    SABIT metinler. TR/EN/DE karsiliklari koddaki satirdan BIREBIR alindi
  //    (davranis-notr); ru/ar EKLENDI. Cagrilan yer: guest webhook route.ts.
  //    Tier-2 (handle-*-callback.ts) HENUZ TASINMADI — bkz. IS 10.
  // Spa
  | 'spa_contact_ask'             // spa karti dustu: opsiyonel telefon/mail iste
  | 'spa_contact_thanks'          // iletisim alindi ve spa ekibine iletildi
  // Room-service / siparis
  | 'order_preparing'             // RS-kod kapisi: teyit kartindan onceki ara mesaj
  | 'order_invalid_code'          // {liste} — iddia edilen kod menude yok
  | 'menu_photo_caption'          // menu gorseli alt yazisi
  | 'menu_item_unavailable'       // urun menude yok, kademeli oneri
  | 'order_note_ask_multi'        // {liste} — coklu yiyecek: numarali not sorusu
  | 'order_note_ask_single'       // tek yiyecek: sade not sorusu
  | 'order_confirm_prompt'        // {liste} — kod yakalandi: urun listeli teyit
  | 'order_confirm_prompt_freeform' // kod yok: serbest metin siparis teyidi
  // Buton etiketleri (callback_data DEGISMEZ — yalniz gorunen etiket)
  | 'btn_confirm_yes'
  | 'btn_cancel'
  | 'btn_add_note'
  | 'btn_no_note'
  | 'btn_yes_show'
  | 'btn_no_thanks'
  // Alerjen (Modul 3/4) — bildirim yolu SLA'siz, metinler sabit
  | 'allergen_ask_900ms'          // F&B cevabindan 900ms sonra alerji sorusu
  | 'allergen_ack_short'          // alakasiz/cok kisa cevap -> asked_no_response
  | 'allergen_ack_none'           // "yok" cevabi -> status=none
  | 'allergen_informed'           // alerji alindi, oda biliniyor -> ekip haberdar
  | 'allergen_informed_ask_room'  // alerji alindi, oda YOK -> oda+isim sor
  | 'allergen_verify_format'      // oda+soyisim formati eksik (deneme SAYILMAZ)
  | 'allergen_verify_success'     // {ad} — eslesti, bildirim gitti
  | 'allergen_verify_failed_max'  // max deneme asildi -> on buro
  | 'allergen_verify_retry'       // {n}/{max} — eslesmedi, tekrar sor
  | 'allergen_noted_meal'         // forward yolunda alerji notu alindi
  // ── P7b Tier-2 (IS 10) — CALLBACK metinleri ─────────────────────────────────
  // Butona basildiginda misafire donen her sey: mesaj, toast (answerCallbackQuery),
  // kart etiketi (editMessageReplyMarkup) ve buton label'i. Dil callback'te mesaj
  // metninden TESPIT EDILEMEZ (ortada metin yok) -> conversations.metadata'daki
  // preferred_language okunur (bkz. resolvePreferredLang).
  // Ortak (birden fazla handler ayni metni kullanir — ikinci kopya YASAK)
  | 'cb_conv_missing'          // konusma kaydi bulunamadi
  | 'cb_generic_error'         // beklenmedik hata, tekrar denensin
  | 'cb_unknown_action'        // tanimsiz callback action
  | 'cb_stale_button'          // bayat/ezilmis damga -> buton RED (show_alert)
  | 'cb_lbl_processed'         // kart etiketi: islendi
  | 'cb_already_processed'     // toast: bu adim zaten islendi
  // Room-service siparis callback'i
  | 'order_sent_guest'         // onay sonrasi misafire: siparis ekibe iletildi
  | 'order_cancelled_guest'    // vazgecme sonrasi misafire
  | 'order_already_processed'  // toast: bu siparis zaten islendi (order:noop dahil)
  | 'order_lbl_cancelled'      // kart etiketi: iptal edildi
  | 'order_toast_cancelled'    // toast: iptal edildi
  | 'order_forward_failed'     // toast: forward basarisiz (rollback yapildi)
  | 'order_lbl_approved'       // kart etiketi: onaylandi
  | 'order_toast_sent'         // toast: siparis iletildi
  // Not akisi callback'i
  | 'note_already_done'        // toast: not adimi zaten tamamlandi
  | 'note_ask_write'           // misafire: notunuzu yazin (mesaj)
  | 'note_lbl_waiting'         // kart etiketi: not bekleniyor
  | 'note_toast_write'         // toast: notunuzu yazin
  | 'note_order_missing'       // toast: siparis state'i kayip
  | 'note_lbl_cancel'          // kart etiketi: iptal
  | 'note_lbl_continue'        // kart etiketi: notsuz devam
  | 'note_toast_awaiting'      // toast: onay bekleniyor
  // Housekeeping callback'i
  | 'hk_ask_towel_type'        // hangi havlu tipi
  | 'hk_lbl_bath_towel'
  | 'hk_lbl_face_towel'
  | 'hk_lbl_foot_towel'
  | 'hk_ask_qty'               // adet sorusu (esya adi YOK)
  | 'hk_ask_qty_labeled'       // {esya} — adet sorusu (esya adi VAR; TR metni birebir korundu)
  | 'hk_fwd_ok'                // forward basarili
  | 'hk_fwd_duplicate'         // DEDUP: ayni talep zaten iletilmis
  | 'hk_fwd_error'             // forward hatasi
  | 'hk_lbl_yes_now'           // sikayet onayi: evet, simdi
  | 'hk_lbl_later'             // sikayet onayi: simdi degil
  | 'hk_toast_selected'        // toast: secim alindi
  | 'hk_toast_invalid'         // toast: gecersiz secim
  | 'hk_complaint_confirm_ask' // IS 8 sikayet dali: ozur + "simdi mi" sorusu
  | 'hk_complaint_later'       // "simdi degil" secildi: forward YOK, vaat de YOK
  | 'hk_lbl_selected'          // kart etiketi: secildi
  // Genel
  | 'ai_fallback_received';      // AI cevap uretemedi: notr "alindi" mesaji

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

  // ── P7b Tier-1 metinleri ────────────────────────────────────────────────────
  // tr/en/de: route.ts'teki ternary'den BIREBIR (ASCII yaklastirmasi tasiyan DE
  // metinleri de aynen korundu — DE'de ae/oe/ue mesru bir yazim). Yer tutucular:
  // {liste} urun/kod listesi, {ad} misafir adi, {n}/{max} deneme sayaci.
  spa_contact_ask: {
    tr: 'Spa ekibi sizinle iletişime geçecek. İsterseniz telefon numaranızı, mail adresinizi ya da her ikisini bana iletin; ben kendilerine ulaştırayım, size dönüş yapsınlar.',
    en: 'The spa team will reach out to you. If you like, share your phone number, email, or both and I will pass them on so they can contact you directly.',
    de: 'Das Spa-Team wird sich bei Ihnen melden. Wenn Sie moechten, teilen Sie mir Ihre Telefonnummer, E-Mail oder beides mit, dann leite ich diese weiter, damit man Sie direkt erreichen kann.',
    ru: 'Команда спа свяжется с вами. При желании отправьте мне свой номер телефона, e-mail или и то, и другое — я передам их, чтобы с вами связались.',
    ar: 'سيتواصل معك فريق السبا. إذا رغبت، أرسل لي رقم هاتفك أو بريدك الإلكتروني أو كليهما وسأمررها إليهم ليتواصلوا معك.',
  },
  spa_contact_thanks: {
    tr: 'Teşekkürler, iletişim bilgilerinizi spa ekibine ilettim. En kısa sürede size dönüş yapacaklar.',
    en: 'Thank you, I have passed your contact details to the spa team. They will reach out to you soon.',
    de: 'Vielen Dank, ich habe Ihre Kontaktdaten an das Spa-Team weitergeleitet. Man wird sich bald bei Ihnen melden.',
    ru: 'Спасибо, я передал(а) ваши контактные данные команде спа. Они свяжутся с вами в ближайшее время.',
    ar: 'شكرًا لك، لقد أرسلت معلومات الاتصال الخاصة بك إلى فريق السبا، وسيتواصلون معك في أقرب وقت.',
  },
  order_preparing: {
    tr: 'Siparişinizi hazırlıyorum.',
    en: 'Preparing your order.',
    de: 'Ich bereite Ihre Bestellung vor.',
    ru: 'Готовлю ваш заказ.',
    ar: 'أقوم بتحضير طلبك.',
  },
  order_invalid_code: {
    tr: 'Yazdığınız kod menümüzde yok. Geçerli kodlar:\n{liste}',
    en: 'The code you entered is not in our menu. Valid codes:\n{liste}',
    de: 'Der von Ihnen eingegebene Code ist nicht in unserer Speisekarte. Gueltige Codes:\n{liste}',
    ru: 'Введённый вами код отсутствует в нашем меню. Действительные коды:\n{liste}',
    ar: 'الرمز الذي أدخلته غير موجود في قائمتنا. الرموز الصالحة:\n{liste}',
  },
  menu_photo_caption: {
    tr: 'Room-service menümüz ekte 📋 Sipariş vermek için ürün kodunu ve adedini yazmanız yeterli (ör. 2 RS01).',
    en: 'Here is our room-service menu 📋 To order, just send the item code and quantity (e.g. 2 RS01).',
    de: 'Hier ist unsere Room-Service-Speisekarte 📋 Zum Bestellen senden Sie einfach den Artikelcode und die Menge (z.B. 2 RS01).',
    ru: 'Вот наше меню обслуживания номеров 📋 Чтобы сделать заказ, просто отправьте код блюда и количество (напр. 2 RS01).',
    ar: 'إليك قائمة خدمة الغرف لدينا 📋 لتقديم طلب، فقط أرسل رمز الصنف والكمية (مثال: 2 RS01).',
  },
  menu_item_unavailable: {
    tr: 'Bu ürün şu an mevcut değil, çok üzgünüz. Elimizdeki diğer ürünlere bakmak ister misiniz?',
    en: 'Unfortunately this item is not available right now, we are very sorry. Would you like to see our other available items?',
    de: 'Dieser Artikel ist derzeit leider nicht verfuegbar, es tut uns sehr leid. Moechten Sie unsere anderen verfuegbaren Artikel sehen?',
    ru: 'К сожалению, этого блюда сейчас нет. Хотите посмотреть другие доступные блюда?',
    ar: 'هذا الصنف غير متوفر حاليًا، نعتذر بشدة. هل ترغب في الاطلاع على أصنافنا الأخرى المتاحة؟',
  },
  order_note_ask_multi: {
    tr: 'Siparişinize not eklemek ister misiniz?\n\n{liste}\n\nHer ürün için numarasıyla yazın (ör. "1: soğansız, 2: az kızarmış")',
    en: 'Would you like to add a note to your order?\n\n{liste}\n\nPlease specify by number for each item (e.g. "1: no onions, 2: lightly browned")',
    de: 'Möchten Sie Ihrer Bestellung eine Notiz hinzufügen?\n\n{liste}\n\nBitte geben Sie für jeden Artikel mit Nummer an (z.B. "1: ohne Zwiebeln, 2: leicht getoastet")',
    ru: 'Хотите добавить примечание к заказу?\n\n{liste}\n\nУкажите для каждого блюда по его номеру (напр. «1: без лука, 2: слабой прожарки»).',
    ar: 'هل ترغب في إضافة ملاحظة إلى طلبك؟\n\n{liste}\n\nاكتب لكل صنف برقمه (مثال: «1: بدون بصل، 2: نصف استواء»).',
  },
  order_note_ask_single: {
    tr: 'Siparişinize eklemek istediğiniz bir not var mı (ör. soğansız olsun)?',
    en: 'Would you like to add a note to your order (e.g. no onions)?',
    de: 'Möchten Sie Ihrer Bestellung eine Notiz hinzufügen (z.B. ohne Zwiebeln)?',
    ru: 'Есть ли примечание, которое вы хотите добавить к заказу (напр. без лука)?',
    ar: 'هل لديك ملاحظة تريد إضافتها إلى طلبك (مثال: بدون بصل)؟',
  },
  order_confirm_prompt: {
    tr: 'Siparişiniz:\n{liste}\n\nOnaylıyor musunuz?',
    en: 'Your order:\n{liste}\n\nDo you confirm?',
    de: 'Ihre Bestellung:\n{liste}\n\nBestaetigen Sie?',
    ru: 'Ваш заказ:\n{liste}\n\nПодтверждаете?',
    ar: 'طلبك:\n{liste}\n\nهل تؤكد؟',
  },
  order_confirm_prompt_freeform: {
    tr: 'Siparişinizi oluşturuyorum. Onaylarsanız ilgili ekibe hemen ileteceğim. Onaylıyor musunuz?',
    en: 'I am creating your order. To proceed, could you please confirm?',
    de: 'Ich erstelle Ihre Bestellung. Bitte bestaetigen Sie zur Fortsetzung.',
    ru: 'Оформляю ваш заказ. Если подтвердите, сразу передам его соответствующей команде. Подтверждаете?',
    ar: 'أقوم بإنشاء طلبك. إذا أكدت، سأرسله فورًا إلى الفريق المعني. هل تؤكد؟',
  },
  // Buton etiketleri — TR "Evet, onaylıyorum" / "Vazgeçtim" TEK dogru bicimdir.
  // Not akisinda (route.ts eski satir 1875/1876) ASCII yaklastirmasi vardi
  // ("onayliyorum"/"Vazgectim"); tek anahtara indirgenirken TAM TURKCE bicim
  // secildi (CLAUDE.md: misafire donuk metinler TAM Turkce karakterli).
  btn_confirm_yes: {
    tr: 'Evet, onaylıyorum',
    en: 'Yes, confirm',
    de: 'Ja, bestaetigen',
    ru: 'Да, подтверждаю',
    ar: 'نعم، أؤكد',
  },
  btn_cancel: {
    tr: 'Vazgeçtim',
    en: 'Cancel',
    de: 'Abbrechen',
    ru: 'Отмена',
    ar: 'إلغاء',
  },
  btn_add_note: {
    tr: 'Not var',
    en: 'Add a note',
    de: 'Notiz hinzufuegen',
    ru: 'Добавить примечание',
    ar: 'إضافة ملاحظة',
  },
  btn_no_note: {
    tr: 'Notum yok',
    en: 'No note',
    de: 'Keine Notiz',
    ru: 'Без примечания',
    ar: 'بدون ملاحظة',
  },
  btn_yes_show: {
    tr: 'Evet, bakmak isterim',
    en: 'Yes, show me',
    de: 'Ja, zeigen',
    ru: 'Да, покажите',
    ar: 'نعم، أرني',
  },
  btn_no_thanks: {
    tr: 'Hayır, teşekkürler',
    en: 'No, thanks',
    de: 'Nein, danke',
    ru: 'Нет, спасибо',
    ar: 'لا، شكرًا',
  },
  allergen_ask_900ms: {
    tr: 'Herhangi bir gıda alerjiniz var mı? Varsa belirtir misiniz, yoksa \'yok\' yazmanız yeterli.',
    en: 'Do you have any food allergies or dietary requirements? If yes, please let us know. If not, just reply \'none\'.',
    de: 'Haben Sie Lebensmittelallergien oder besondere Ernährungsbedürfnisse? Falls ja, teilen Sie uns diese bitte mit. Falls nein, schreiben Sie einfach \'nein\'.',
    ru: 'Есть ли у вас пищевая аллергия? Если да, сообщите, пожалуйста; если нет — просто напишите «нет».',
    ar: 'هل لديك أي حساسية غذائية؟ إن وجدت فيرجى إخبارنا، وإن لم توجد فاكتب «لا» فقط.',
  },
  allergen_ack_short: {
    tr: 'Anlaşıldı, teşekkürler.',
    en: 'Understood, thank you.',
    de: 'Verstanden, vielen Dank.',
    ru: 'Понятно, спасибо.',
    ar: 'مفهوم، شكرًا لك.',
  },
  allergen_ack_none: {
    tr: 'Anlaşıldı, teşekkürler! Başka bir isteğiniz varsa lütfen belirtin.',
    en: 'Noted, thank you! Please let us know if there is anything else we can help you with.',
    de: 'Notiert, vielen Dank! Lassen Sie uns wissen, wenn wir noch etwas für Sie tun können.',
    ru: 'Отмечено, спасибо! Дайте нам знать, если можем ещё чем-то помочь.',
    ar: 'تم التسجيل، شكرًا لك! أخبرنا إن كان بإمكاننا مساعدتك في أي شيء آخر.',
  },
  allergen_informed: {
    tr: 'Bilgilendirme için teşekkürler! İlgili ekibimizi alerjiniz hakkında haberdar ettik.',
    en: 'Thank you for letting us know! We have informed the relevant team about your allergy.',
    de: 'Vielen Dank! Wir haben das zuständige Team über Ihre Allergie informiert.',
    ru: 'Спасибо, что сообщили! Мы уведомили соответствующую команду о вашей аллергии.',
    ar: 'شكرًا لإبلاغنا! لقد أبلغنا الفريق المعني بشأن الحساسية لديك.',
  },
  allergen_informed_ask_room: {
    tr: 'Bilgilendirme için teşekkürler! Ekibimizi haberdar edebilmemiz için lütfen oda numaranızı, adınızı ve soyadınızı paylaşır mısınız? Örnek: 101 Kemal Kuyucu',
    en: 'Thank you for letting us know about your allergy! To notify our team, could you please share your room number, first name, and last name? Example: 101 John Smith',
    de: 'Vielen Dank für die Information! Um unser Team zu informieren, teilen Sie bitte Zimmernummer, Vorname und Nachname mit. Beispiel: 101 Hans Müller',
    ru: 'Спасибо, что сообщили! Чтобы мы могли уведомить команду, пожалуйста, укажите номер комнаты, имя и фамилию. Пример: 101 John Smith',
    ar: 'شكرًا لإبلاغنا! حتى نتمكن من إبلاغ فريقنا، يرجى مشاركة رقم غرفتك واسمك الأول واسم العائلة. مثال: 101 John Smith',
  },
  allergen_verify_format: {
    tr: 'Lütfen oda numaranızı ve soyadınızı birlikte yazın. Örnek: 101 Kemal Kuyucu',
    en: 'Please provide your room number and last name together. Example: 101 John Smith',
    de: 'Bitte geben Sie Zimmernummer und Nachname an. Beispiel: 101 Hans Müller',
    ru: 'Пожалуйста, укажите номер комнаты и фамилию вместе. Пример: 101 John Smith',
    ar: 'يرجى كتابة رقم غرفتك واسم العائلة معًا. مثال: 101 John Smith',
  },
  allergen_verify_success: {
    tr: 'Teşekkürler, {ad}! Alerjiniz ilgili ekibimize iletildi. İyi konaklamalar!',
    en: 'Thank you, {ad}! Your allergy information has been forwarded to our team. Have a pleasant stay!',
    de: 'Danke, {ad}! Ihre Allergieinformation wurde an unser Team weitergeleitet. Guten Aufenthalt!',
    ru: 'Спасибо, {ad}! Информация о вашей аллергии передана нашей команде. Приятного отдыха!',
    ar: 'شكرًا لك، {ad}! تم إرسال معلومات الحساسية لديك إلى فريقنا. نتمنى لك إقامة ممتعة!',
  },
  allergen_verify_failed_max: {
    tr: 'Oda numarası ve isim eşleşmedi. Lütfen ön büromuza ulaşabilirsiniz.',
    en: 'We could not match your room number and name. Please contact our front desk for assistance.',
    de: 'Zimmernummer und Name konnten nicht zugeordnet werden. Bitte wenden Sie sich an die Rezeption.',
    ru: 'Не удалось сопоставить номер комнаты и имя. Пожалуйста, обратитесь на стойку регистрации.',
    ar: 'لم نتمكن من مطابقة رقم الغرفة والاسم. يرجى التواصل مع مكتب الاستقبال.',
  },
  allergen_verify_retry: {
    tr: 'Oda numarası ve isim eşleşmedi ({n}/{max} deneme). Lütfen tekrar deneyin. Örnek: 101 Kemal Kuyucu',
    en: 'Room number and name did not match (attempt {n}/{max}). Please try again. Example: 101 John Smith',
    de: 'Zimmernummer und Name stimmen nicht überein (Versuch {n}/{max}). Bitte erneut versuchen. Beispiel: 101 Hans Müller',
    ru: 'Номер комнаты и имя не совпали (попытка {n}/{max}). Пожалуйста, попробуйте снова. Пример: 101 John Smith',
    ar: 'رقم الغرفة والاسم غير متطابقين (المحاولة {n}/{max}). يرجى المحاولة مرة أخرى. مثال: 101 John Smith',
  },
  allergen_noted_meal: {
    tr: 'Not aldık, ilgili ekibe ilettik. Afiyet olsun.',
    en: 'We have noted your allergy and informed the relevant team. Enjoy your meal!',
    de: 'Wir haben Ihre Allergie notiert und das zuständige Team informiert. Guten Appetit!',
    ru: 'Мы отметили вашу аллергию и сообщили соответствующей команде. Приятного аппетита!',
    ar: 'لقد سجّلنا الحساسية لديك وأبلغنا الفريق المعني. بالهناء والعافية!',
  },
  // ── P7b Tier-2 (IS 10) callback metinleri ───────────────────────────────────
  // TR metinler mevcut handler'lardan tasindi; ASCII yaklastirmasi tasiyanlar
  // ("Kayit bulunamadi", "Onaylandi", "Iptal edildi") TAM TURKCE bicime cevrildi
  // (CLAUDE.md: misafire donuk metinler TAM Turkce karakterli). Anlam DEGISMEDI.
  cb_conv_missing: {
    tr: 'Kayıt bulunamadı.',
    en: 'Record not found.',
    de: 'Eintrag nicht gefunden.',
    ru: 'Запись не найдена.',
    ar: 'لم يتم العثور على السجل.',
  },
  cb_generic_error: {
    tr: 'Bir sorun oluştu, lütfen tekrar deneyin.',
    en: 'Something went wrong, please try again.',
    de: 'Es ist ein Fehler aufgetreten, bitte versuchen Sie es erneut.',
    ru: 'Произошла ошибка, пожалуйста, попробуйте ещё раз.',
    ar: 'حدث خطأ، يرجى المحاولة مرة أخرى.',
  },
  cb_unknown_action: {
    tr: 'Bilinmeyen işlem.',
    en: 'Unknown action.',
    de: 'Unbekannte Aktion.',
    ru: 'Неизвестное действие.',
    ar: 'إجراء غير معروف.',
  },
  cb_stale_button: {
    tr: 'Bu buton güncel değil. Lütfen mesajın en altındaki güncel butonu kullanın.',
    en: 'This button is out of date. Please use the current button at the bottom of the chat.',
    de: 'Diese Schaltflaeche ist nicht mehr aktuell. Bitte verwenden Sie die unterste, aktuelle Schaltflaeche.',
    ru: 'Эта кнопка устарела. Пожалуйста, используйте актуальную кнопку в самом низу переписки.',
    ar: 'هذا الزر لم يعد صالحًا. يرجى استخدام الزر الحالي في أسفل المحادثة.',
  },
  cb_lbl_processed: {
    tr: 'İşlendi',
    en: 'Processed',
    de: 'Bearbeitet',
    ru: 'Обработано',
    ar: 'تمت المعالجة',
  },
  cb_already_processed: {
    tr: 'Bu adım zaten işlendi.',
    en: 'This step has already been processed.',
    de: 'Dieser Schritt wurde bereits bearbeitet.',
    ru: 'Этот шаг уже обработан.',
    ar: 'تمت معالجة هذه الخطوة بالفعل.',
  },
  order_sent_guest: {
    tr: 'Siparişiniz ilgili ekibe iletildi. En kısa sürede ilgileniyoruz.',
    en: 'Your order has been sent to our team. They will assist you shortly.',
    de: 'Ihre Bestellung wurde an unser Team gesendet. Wir kuemmern uns gleich darum.',
    ru: 'Ваш заказ передан нашей команде. Мы займёмся им в ближайшее время.',
    ar: 'تم إرسال طلبك إلى الفريق المعني. سنهتم به في أقرب وقت.',
  },
  order_cancelled_guest: {
    tr: 'Tabii, bilgi için buradayım.',
    en: 'No problem, I am here if you need anything.',
    de: 'Kein Problem, ich bin fuer Sie da.',
    ru: 'Хорошо, я здесь, если вам что-то понадобится.',
    ar: 'بالتأكيد، أنا هنا إن احتجت أي معلومة.',
  },
  order_already_processed: {
    tr: 'Bu sipariş zaten işlendi.',
    en: 'This order has already been processed.',
    de: 'Diese Bestellung wurde bereits bearbeitet.',
    ru: 'Этот заказ уже обработан.',
    ar: 'تمت معالجة هذا الطلب بالفعل.',
  },
  order_lbl_cancelled: {
    tr: 'İptal edildi',
    en: 'Cancelled',
    de: 'Storniert',
    ru: 'Отменено',
    ar: 'تم الإلغاء',
  },
  order_toast_cancelled: {
    tr: 'İptal edildi.',
    en: 'Cancelled.',
    de: 'Storniert.',
    ru: 'Отменено.',
    ar: 'تم الإلغاء.',
  },
  order_forward_failed: {
    tr: 'İletim başarısız, lütfen tekrar deneyin.',
    en: 'Sending failed, please try again.',
    de: 'Uebermittlung fehlgeschlagen, bitte versuchen Sie es erneut.',
    ru: 'Не удалось отправить, пожалуйста, попробуйте ещё раз.',
    ar: 'فشل الإرسال، يرجى المحاولة مرة أخرى.',
  },
  order_lbl_approved: {
    tr: '✅ Onaylandı',
    en: '✅ Confirmed',
    de: '✅ Bestaetigt',
    ru: '✅ Подтверждено',
    ar: '✅ تم التأكيد',
  },
  order_toast_sent: {
    tr: 'Sipariş iletildi.',
    en: 'Order sent.',
    de: 'Bestellung gesendet.',
    ru: 'Заказ отправлен.',
    ar: 'تم إرسال الطلب.',
  },
  note_already_done: {
    tr: 'Bu adım zaten tamamlandı.',
    en: 'This step is already complete.',
    de: 'Dieser Schritt ist bereits abgeschlossen.',
    ru: 'Этот шаг уже завершён.',
    ar: 'اكتملت هذه الخطوة بالفعل.',
  },
  note_ask_write: {
    tr: 'Lütfen notunuzu yazın.',
    en: 'Please type your note.',
    de: 'Bitte schreiben Sie Ihre Notiz.',
    ru: 'Пожалуйста, напишите ваше примечание.',
    ar: 'يرجى كتابة ملاحظتك.',
  },
  note_lbl_waiting: {
    tr: 'Not bekleniyor',
    en: 'Waiting for note',
    de: 'Warte auf Notiz',
    ru: 'Ожидание примечания',
    ar: 'في انتظار الملاحظة',
  },
  note_toast_write: {
    tr: 'Notunuzu yazın.',
    en: 'Type your note.',
    de: 'Schreiben Sie Ihre Notiz.',
    ru: 'Напишите ваше примечание.',
    ar: 'اكتب ملاحظتك.',
  },
  note_order_missing: {
    tr: 'Sipariş bulunamadı, lütfen tekrar deneyin.',
    en: 'Order not found, please try again.',
    de: 'Bestellung nicht gefunden, bitte versuchen Sie es erneut.',
    ru: 'Заказ не найден, пожалуйста, попробуйте ещё раз.',
    ar: 'لم يتم العثور على الطلب، يرجى المحاولة مرة أخرى.',
  },
  note_lbl_cancel: {
    tr: 'İptal',
    en: 'Cancelled',
    de: 'Storniert',
    ru: 'Отменено',
    ar: 'إلغاء',
  },
  note_lbl_continue: {
    tr: 'Notsuz devam',
    en: 'Continue without note',
    de: 'Ohne Notiz fortfahren',
    ru: 'Продолжить без примечания',
    ar: 'المتابعة بدون ملاحظة',
  },
  note_toast_awaiting: {
    tr: 'Onay bekleniyor.',
    en: 'Awaiting confirmation.',
    de: 'Warte auf Bestaetigung.',
    ru: 'Ожидается подтверждение.',
    ar: 'في انتظار التأكيد.',
  },
  hk_ask_towel_type: {
    tr: 'Hangi havlu istersiniz?',
    en: 'Which towel would you like?',
    de: 'Welches Handtuch möchten Sie?',
    ru: 'Какое полотенце вы хотите?',
    ar: 'أي منشفة تريد؟',
  },
  hk_lbl_bath_towel: {
    tr: 'Banyo havlusu',
    en: 'Bath towel',
    de: 'Badetuch',
    ru: 'Банное полотенце',
    ar: 'منشفة استحمام',
  },
  hk_lbl_face_towel: {
    tr: 'Yüz havlusu',
    en: 'Face towel',
    de: 'Gesichtstuch',
    ru: 'Полотенце для лица',
    ar: 'منشفة وجه',
  },
  hk_lbl_foot_towel: {
    tr: 'Ayak havlusu',
    en: 'Foot towel',
    de: 'Fußtuch',
    ru: 'Полотенце для ног',
    ar: 'منشفة أقدام',
  },
  hk_ask_qty: {
    tr: 'Kaç adet istersiniz?',
    en: 'How many would you like?',
    de: 'Wie viele möchten Sie?',
    ru: 'Сколько штук вы хотите?',
    ar: 'كم عددًا تريد؟',
  },
  // {esya} = housekeeping esya etiketi (labelForHousekeepingCode, TR). TR metin
  // mevcut satirdan BIREBIR; diger dillerde de yer tutucu korunur ki adet sorusu
  // HANGI esya icin soruldugunu kaybetmesin (etiket sozlugu ayri is).
  hk_ask_qty_labeled: {
    tr: 'Kaç adet {esya} istersiniz?',
    en: 'How many would you like? ({esya})',
    de: 'Wie viele möchten Sie? ({esya})',
    ru: 'Сколько штук вы хотите? ({esya})',
    ar: 'كم عددًا تريد؟ ({esya})',
  },
  hk_fwd_ok: {
    tr: 'Talebiniz ilgili ekibe iletildi. En kısa sürede ilgileniyoruz.',
    en: 'Your request has been sent to our team. They will assist you shortly.',
    de: 'Ihre Anfrage wurde an unser Team gesendet. Wir kuemmern uns gleich darum.',
    ru: 'Ваш запрос передан нашей команде. Мы займёмся им в ближайшее время.',
    ar: 'تم إرسال طلبك إلى الفريق المعني. سنهتم به في أقرب وقت.',
  },
  hk_fwd_duplicate: {
    tr: 'Talebiniz zaten ilgili ekibe iletildi, en kısa sürede ilgileniyoruz.',
    en: 'Your request has already been sent to our team; they will assist you shortly.',
    de: 'Ihre Anfrage wurde bereits an unser Team gesendet, wir kuemmern uns darum.',
    ru: 'Ваш запрос уже передан нашей команде, мы скоро им займёмся.',
    ar: 'سبق أن تم إرسال طلبك إلى الفريق المعني، وسنهتم به قريبًا.',
  },
  hk_fwd_error: {
    tr: 'Bir sorun oluştu, lütfen tekrar deneyin.',
    en: 'Something went wrong, please try again.',
    de: 'Es ist ein Fehler aufgetreten, bitte versuchen Sie es erneut.',
    ru: 'Произошла ошибка, пожалуйста, попробуйте ещё раз.',
    ar: 'حدث خطأ، يرجى المحاولة مرة أخرى.',
  },
  hk_lbl_yes_now: {
    tr: 'Evet, şimdi',
    en: 'Yes, now',
    de: 'Ja, jetzt',
    ru: 'Да, сейчас',
    ar: 'نعم، الآن',
  },
  hk_lbl_later: {
    tr: 'Şimdi değil, sonra',
    en: 'Not now, later',
    de: 'Nicht jetzt, spaeter',
    ru: 'Не сейчас, позже',
    ar: 'ليس الآن، لاحقًا',
  },
  hk_toast_selected: {
    tr: 'Seçildi.',
    en: 'Selected.',
    de: 'Ausgewaehlt.',
    ru: 'Выбрано.',
    ar: 'تم الاختيار.',
  },
  hk_toast_invalid: {
    tr: 'Geçersiz seçim.',
    en: 'Invalid selection.',
    de: 'Ungueltige Auswahl.',
    ru: 'Неверный выбор.',
    ar: 'اختيار غير صالح.',
  },
  hk_complaint_confirm_ask: {
    tr: 'Yaşadığınız aksaklık için özür dileriz. Kat hizmetlerine hemen iletebilirim — şu an getirmemizi/yenilememizi ister misiniz?',
    en: 'We are sorry for the inconvenience. I can notify housekeeping right away — would you like us to bring/replace it now?',
    de: 'Wir entschuldigen uns fuer die Unannehmlichkeiten. Ich kann den Housekeeping-Service sofort informieren — moechten Sie, dass wir es jetzt bringen/wechseln?',
    ru: 'Приносим извинения за неудобство. Я могу сразу сообщить службе уборки — хотите, чтобы мы принесли/заменили это сейчас?',
    ar: 'نعتذر عن هذا الإزعاج. يمكنني إبلاغ قسم التدبير المنزلي فورًا — هل تريد أن نحضره/نستبدله الآن؟',
  },
  // "Simdi degil" secildi: forward YOK -> iletme/dönüş VAADI de YOK (SAHTE VAAT YASAGI).
  hk_complaint_later: {
    tr: 'Tabii, dilediğiniz an yazmanız yeterli; hemen ilgileniriz.',
    en: 'Of course, just message us whenever you like and we will take care of it right away.',
    de: 'Natuerlich, schreiben Sie uns einfach, wann immer Sie moechten — wir kuemmern uns sofort darum.',
    ru: 'Конечно, просто напишите нам в любой момент, и мы сразу этим займёмся.',
    ar: 'بالتأكيد، يكفي أن تراسلنا في أي وقت وسنهتم بالأمر فورًا.',
  },
  hk_lbl_selected: {
    tr: '✅ Seçildi',
    en: '✅ Selected',
    de: '✅ Ausgewaehlt',
    ru: '✅ Выбрано',
    ar: '✅ تم الاختيار',
  },
  ai_fallback_received: {
    tr: 'Mesajınız alındı, en kısa sürede ilgili departmandan dönüş yapılacaktır.',
    en: 'Your message has been received. The relevant department will get back to you as soon as possible.',
    de: 'Ihre Nachricht ist eingegangen. Die zustaendige Abteilung meldet sich so bald wie moeglich bei Ihnen.',
    ru: 'Ваше сообщение получено. Соответствующий отдел свяжется с вами в ближайшее время.',
    ar: 'تم استلام رسالتك، وسيتواصل معك القسم المعني في أقرب وقت ممكن.',
  },
};

/**
 * Sabit misafir metnini istenen dilde dondurur.
 * `params` yer tutuculari doldurur ({name}, {room}); verilmeyen yer tutucu BOS string olur
 * (mevcut route.ts davranisi: `${firstName ?? ''}`).
 */
// ── KALICI DIL (IS 10) — conversations.metadata.preferred_language ───────────
//
// NEDEN: callback turunda (misafir butona bastI) ortada MESAJ METNI YOKTUR, dil
// tespit edilemez; bu yuzden order/note callback'leri bugune kadar lang='tr'
// HARDCODE tasiyordu. Telegram arayuz dili (`language_code`) dogru olcut DEGIL —
// arayuzu Turkce olan misafir Rusca yazabilir (IS 17 dersi).
//
// COZUM: dil GUVENILIR tespit edildigi anda (classify sonrasi) konusmaya YAZILIR,
// callback'ler ORADAN okur. Kolon yerine metadata jsonb: yeni migration gerekmez
// ve lead akisi (lead-capture.ts) ayni deseni zaten kullaniyor.

export const PREFERRED_LANG_METADATA_KEY = 'preferred_language';

/**
 * metadata.preferred_language -> GuestLang. Alan yok / bos / DESTEKLENMEYEN kod ise
 * `null` doner — `normalizeGuestLang`in 'en' varsayilani BURADA UYGULANMAZ, cunku
 * "kayit yok" ile "kayitli dil en" ayni sey degildir: fallback zincirini (arayuz
 * dili) cagiran taraf isletir.
 */
export function readPreferredLang(metadata: unknown): GuestLang | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = (metadata as Record<string, unknown>)[PREFERRED_LANG_METADATA_KEY];
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const c = raw.trim().toLowerCase().slice(0, 2);
  return SUPPORTED.includes(c) ? (c as GuestLang) : null;
}

/** metadata'nin DIGER anahtarlarini korur (kor UPDATE yok) — `withLeadCapture` ikizi. */
export function withPreferredLang(metadata: unknown, lang: GuestLang): Record<string, unknown> {
  const base = metadata && typeof metadata === 'object' ? { ...(metadata as Record<string, unknown>) } : {};
  base[PREFERRED_LANG_METADATA_KEY] = lang;
  return base;
}

/**
 * 5-dil fallback zinciri. SAF: IO yok.
 *
 * SIRA — `detected` > `stored` > `interfaceLang`:
 *   detected      bu TURUN kaniti (classify mesaj metninden tespit etti). Misafir
 *                 dil degistirdiginde kalici kaydin ONUNE gecmeli.
 *   stored        metadata'daki kalici dil. Callback turunda `detected` HIC yoktur;
 *                 tek guvenilir kaynak budur.
 *   interfaceLang son care (Telegram `language_code`) — yalnizca ilk turda, konusma
 *                 hakkinda hicbir sey bilinmezken.
 *
 * Ilk DOLU aday kazanir ve `normalizeGuestLang`den gecer: desteklenmeyen bir kod
 * ('fr') tespit edildiyse sonuc 'en' olur, zincir ALTTAKI adaya DUSMEZ — yoksa
 * Fransizca yazan misafire, gecmisten kalmis Rusca metin giderdi.
 */
export function resolvePreferredLang(p: {
  stored?: string | null;
  detected?: string | null;
  interfaceLang?: string | null;
}): GuestLang {
  const first = [p.detected, p.stored, p.interfaceLang].find(
    (v) => typeof v === 'string' && v.trim().length > 0,
  );
  return normalizeGuestLang(first ?? null);
}

/**
 * Sozlukteki TUM anahtarlar. is8 bunu gezer: liste ELDE tutulsaydi yeni bir anahtar
 * eklenip teste yazilmadiginda ceviri kontrolu SESSIZCE atlanirdi. Buradan turedigi
 * icin union'a eklenen her anahtar otomatik olarak testin kapsamina girer.
 */
export const ALL_GUEST_TEXT_KEYS = Object.keys(TEXTS) as GuestTextKey[];

export function guestText(
  key: GuestTextKey,
  lang: string | null | undefined,
  params?: Record<string, string | null | undefined>,
): string {
  const tpl = TEXTS[key][normalizeGuestLang(lang)];
  if (!params) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_m, k: string) => String(params[k] ?? ''));
}
