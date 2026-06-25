export const CALCULATOR_HTML = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>HotelGen — Fiyat & Kâr v8 (Paketler + Sesli Agent)</title>
<style>
  :root{--ink:#0F1B2D;--brass:#B8893B;--brassSoft:#E9D9B8;--paper:#F7F5F0;
    --slate:#5C6B7A;--line:#E2DDD2;--green:#2E7D52;--red:#B3402F;--violet:#5B4B8A;}
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;}
  .wrap{max-width:1040px;margin:0 auto;padding:26px 20px 40px}
  h1{font-size:28px;margin:6px 0 4px;font-weight:800;letter-spacing:-.5px}
  .eyebrow{font-size:10.5px;letter-spacing:3px;color:var(--brass);font-weight:700;text-transform:uppercase}
  .sub{font-size:13px;color:var(--slate)}
  .head{border-bottom:2px solid var(--ink);padding-bottom:13px;margin-bottom:22px}
  .grid{display:grid;grid-template-columns:minmax(280px,.9fr) minmax(340px,1.1fr);gap:26px}
  @media(max-width:780px){.grid{grid-template-columns:1fr}}
  .section{font-size:10.5px;letter-spacing:2px;text-transform:uppercase;font-weight:700;color:var(--brass);
    margin:18px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--line)}
  .section:first-child{margin-top:0}
  .field{margin-bottom:15px}
  .field .top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px}
  .field label{font-size:12.5px;font-weight:600}
  .num{width:78px;text-align:right;border:1px solid var(--line);border-radius:6px;padding:3px 7px;
    font-size:13.5px;font-variant-numeric:tabular-nums;color:var(--ink);background:#fff}
  select.num{width:100%;text-align:left}
  .field .suffix{font-size:11.5px;color:var(--slate);width:32px;display:inline-block;text-align:left}
  input[type=range]{width:100%;accent-color:var(--brass)}
  .hint{font-size:11px;color:var(--slate);margin-top:3px;line-height:1.4}
  .check{display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:9px 12px;border:1px solid var(--line);
    border-radius:8px;background:#fff;cursor:pointer}
  .check.on{background:var(--brassSoft)}
  .check input{width:17px;height:17px;accent-color:var(--brass)}
  .check .t{font-size:11.5px;font-weight:600}
  .check .s{font-size:10.5px;color:var(--slate);font-weight:400}
  .sel{margin-bottom:12px}
  .sel label{font-size:12.5px;font-weight:600;display:block;margin-bottom:4px}
  .seg{display:flex;gap:6px;margin-bottom:14px}
  .seg button{flex:1;border:1px solid var(--line);background:#fff;border-radius:8px;padding:9px 6px;cursor:pointer;
    font-size:12px;font-weight:700;color:var(--slate);line-height:1.25}
  .seg button .s{display:block;font-size:10px;font-weight:500;color:var(--slate);margin-top:2px}
  .seg button.on{background:var(--ink);color:#fff;border-color:var(--ink)}
  .seg button.on .s{color:var(--brassSoft)}
  .seg.pkg button.on{background:var(--brass);border-color:var(--brass);color:#fff}
  .seg.pkg button.on .s{color:#3A2B0E}
  .card{border-radius:12px;padding:16px 22px;margin-bottom:14px}
  .price{background:var(--brass);color:#fff}
  .price .lab{font-size:11px;letter-spacing:2px;color:#3A2B0E;font-weight:800}
  .price .big{font-size:40px;font-weight:800;line-height:1.1;margin:4px 0;font-variant-numeric:tabular-nums}
  .price .small{font-size:12.5px;color:#3A2B0E;font-weight:600}
  .mccard{background:#fff;border:2px solid var(--brass);border-radius:12px;padding:14px 18px;margin-bottom:14px}
  .mccard .lab{font-size:10.5px;letter-spacing:1.5px;color:var(--brass);font-weight:700}
  .voicecard{background:#fff;border:2px solid var(--violet);border-radius:12px;padding:14px 18px;margin-bottom:14px}
  .voicecard .lab{font-size:10.5px;letter-spacing:1.5px;color:var(--violet);font-weight:700}
  .pocket{background:var(--ink);color:#fff}
  .pocket .lab{font-size:11px;letter-spacing:2px;color:var(--brassSoft);font-weight:700}
  .pocket .big{font-size:36px;font-weight:800;line-height:1.1;margin:3px 0;font-variant-numeric:tabular-nums}
  .pocket .small,.chain .small{font-size:12px;color:#AEB8C4}
  .chain{background:#16314D;color:#fff;border:1px solid var(--brass)}
  .chain .lab{font-size:11px;letter-spacing:2px;color:var(--brassSoft);font-weight:700}
  .chain .big{font-size:30px;font-weight:800;line-height:1.15;margin:3px 0;color:#7BE0A8;font-variant-numeric:tabular-nums}
  .box{background:#fff;border:1px solid var(--line);border-radius:10px;padding:4px 16px 12px;margin-bottom:18px}
  .ln{display:flex;justify-content:space-between;align-items:baseline;padding:7px 0;border-bottom:1px solid var(--line)}
  .ln .l{font-size:13px;color:var(--slate);font-weight:500}
  .ln .l b{color:var(--ink);font-weight:700;font-size:14px}
  .ln .v{font-size:13.5px;font-weight:600;font-variant-numeric:tabular-nums}
  .ln.strong .l{font-size:14px;color:var(--ink);font-weight:700}
  .ln.strong .v{font-size:15px;font-weight:800}
  .ln .sub{font-size:11px;color:var(--slate);font-weight:400}
  .final{display:flex;justify-content:space-between;align-items:baseline;padding-top:10px}
  .final .l{font-size:14.5px;font-weight:800}
  .final .v{font-size:18px;font-weight:800;font-variant-numeric:tabular-nums}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden}
  thead th{background:var(--ink);color:#fff;font-size:10px;font-weight:700;padding:8px 10px;text-align:right}
  thead th:first-child{text-align:left}
  thead th.c{text-align:center}
  tbody td{font-size:12.5px;padding:9px 10px;border-top:1px solid var(--line);text-align:right;font-variant-numeric:tabular-nums}
  tbody td:first-child{text-align:left;font-weight:700}
  tbody td.c{text-align:center;color:var(--slate);font-size:11px}
  tr.hl td{background:#FBF1E0}
  th.hl,td.hlcol{background:#FBF1E0}
  .pkgtbl td:first-child{color:var(--slate);font-weight:600;font-size:12px}
  .pkgtbl tr.head td{font-weight:800;color:var(--ink)}
  .tnote{font-size:11px;color:var(--slate);margin-top:10px;line-height:1.5}
  .guide{margin-top:26px;border-top:2px solid var(--ink);padding-top:16px}
  .guide .gh{display:flex;justify-content:space-between;align-items:center;cursor:pointer}
  .guide .gh .t{font-size:15px;font-weight:800}
  .guide .gh .x{font-size:13px;color:var(--brass);font-weight:700}
  .gcards{margin-top:14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}
  .gcard{background:#fff;border:1px solid var(--line);border-radius:8px;padding:11px 13px}
  .gcard .k{font-size:12.5px;font-weight:700;margin-bottom:3px}
  .gcard .v{font-size:11.5px;color:var(--slate);line-height:1.5}
  .gcard.dark{background:var(--ink);color:#fff}
  .gcard.dark .k{color:var(--brassSoft)}
  .gcard.dark .v{color:#CDD6E0}
  .pos{color:var(--green)} .neg{color:var(--red)}
</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <div class="eyebrow">HotelGen · Fiyat & Kâr · v8 · Paketler + Sesli Agent</div>
    <h1>Bu Oteli Kaça Satmalıyım?</h1>
    <div class="sub">Tek otel veya zincir. 3 paket (Giriş / Talep+Rapor / Sesli Agent). Sesli agent maliyeti gerçek realtime fiyatlarıyla hesaplanır. Model routing, otomatik ManyChat, KDV dahil.</div>
  </div>

  <div class="grid">
    <div id="inputs"></div>
    <div>
      <!-- PAKET KARŞILAŞTIRMA -->
      <div class="section" style="margin-top:0">3 Paket — bu otel için karşılaştırma</div>
      <table class="pkgtbl" style="margin-bottom:18px">
        <thead><tr><th>Paket</th><th class="c" id="pc1">1 · Giriş</th><th class="c" id="pc2">2 · Talep+Rapor</th><th class="c" id="pc3">3 · Sesli</th></tr></thead>
        <tbody id="pkgRows"></tbody>
      </table>

      <div class="card price">
        <div class="lab" id="priceLab"></div>
        <div class="big" id="priceVal"></div>
        <div class="small" id="priceDisc" style="display:none"></div>
        <div class="small" id="priceInv"></div>
      </div>

      <div class="mccard">
        <div class="lab">ÖNERİLEN MANYCHAT PLANI</div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:4px">
          <span id="mcName" style="font-size:22px;font-weight:800"></span>
          <span id="mcCost" style="font-size:20px;font-weight:800;font-variant-numeric:tabular-nums"></span>
        </div>
        <div class="hint" id="mcInfo" style="margin-top:4px"></div>
      </div>

      <div class="voicecard" id="voiceCard">
        <div class="lab">SESLİ AGENT MALİYETİ (PAKET 3)</div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:4px">
          <span id="vName" style="font-size:16px;font-weight:800"></span>
          <span id="vCost" style="font-size:20px;font-weight:800;font-variant-numeric:tabular-nums"></span>
        </div>
        <div class="hint" id="vInfo" style="margin-top:4px"></div>
      </div>

      <div class="card pocket">
        <div class="lab" id="pocketLab"></div>
        <div class="big" id="pocketVal"></div>
        <div class="small" id="pocketInfo"></div>
      </div>

      <div class="card chain" id="chainCard">
        <div class="lab" id="chainLab"></div>
        <div class="big" id="chainVal"></div>
        <div class="small" id="chainInfo"></div>
      </div>

      <div class="section">Seçili paket — aylık gider dökümü (tek otel)</div>
      <div class="box" id="breakdown"></div>

      <div class="section" id="tblTitle">Büyüklüğe göre fiyat (seçili paket)</div>
      <table>
        <thead><tr><th>Oda</th><th class="c">ManyChat</th><th>Sat (KDV hariç)</th><th>Faturada (KDV dahil)</th></tr></thead>
        <tbody id="sizeRows"></tbody>
      </table>
      <div class="tnote">Turuncu = seçili otelin satırı. "Sat" = seçili paketin %marjını tutturan aylık fiyat. Fiyatlar Haziran 2026 rate'leri.</div>
    </div>
  </div>

  <div class="guide">
    <div class="gh" onclick="toggleGuide()">
      <div class="t">📘 Rehber — paketler, tek otel vs zincir, sesli agent</div>
      <div class="x" id="guideX">gizle ▲</div>
    </div>
    <div class="gcards" id="gcards"></div>
  </div>
</div>

<script>
const MODELS = {
  flashlite:{name:"Gemini Flash-Lite",inRate:0.10,outRate:0.40},
  deepseek:{name:"DeepSeek V4 Flash",inRate:0.14,outRate:0.28},
  geminiflash:{name:"Gemini 2.5 Flash",inRate:0.15,outRate:0.60},
  mistral:{name:"Mistral Small",inRate:0.10,outRate:0.30},
  haiku:{name:"Claude Haiku 4.5",inRate:1,outRate:5},
  sonnet:{name:"Claude Sonnet 4.6",inRate:3,outRate:15},
  opus:{name:"Claude Opus 4.8",inRate:5,outRate:25},
};

// Sesli agent — realtime modelleri. rate = $/dk (cache + prompt diyeti uygulanmış gerçekçi blended).
// Kaynak (Haz 2026): gpt-realtime-mini ölçülen ~$0.06–0.15/dk; gpt-realtime-2 cache'li ~$0.05–0.10, cache'siz $0.18–0.46/dk.
const VOICE = {
  rtmini:{name:"GPT-Realtime-mini",rate:0.09},
  rt2:{name:"GPT-Realtime-2",rate:0.18},
  pipeline:{name:"Whisper+TTS pipeline",rate:0.05},
};

const state = {
  mode:"single",            // single | chain
  pkg:2,                    // seçili paket 1|2|3
  rooms:200, people:2, occupancy:70, questions:10, days:30, stayDays:7, engagement:70,
  simpleShare:85, simpleModel:"flashlite", complexModel:"haiku",
  inTokens:3000, outTokens:300, cacheFrac:70,
  waMsgsPerStay:2, waRate:0.0053, waCheckoutFree:false,
  // Paket 2 — talep iletme + rapor
  opsModel:"haiku", reqPerStay:1.5, opsInTokens:1200, opsOutTokens:300,
  reportsPerMonth:30, reportInTokens:8000, reportOutTokens:1200,
  // Paket 3 — sesli agent
  voiceModel:"rtmini", voiceShare:30, voiceMinPerStay:5, voiceRate:0.09,
  // fiyat & gider
  autoPrice:true, price:1500, mcAuto:true, manychat:29,
  supabaseShared:25, fixedTotal:213, tenantsTotal:11,
  chainSize:5, chainDiscount:0,
  taxRate:40, kdv:20,
  marginP1:75, marginP2:82, marginP3:85,
};

const FIELDS = [
  {sec:"Otel & kullanım"},
  {k:"rooms",l:"Oda sayısı",min:10,max:2500,step:10,sfx:"oda"},
  {k:"people",l:"Oda başına kişi",min:1,max:4,step:1,sfx:"kişi"},
  {k:"occupancy",l:"Doluluk oranı",min:20,max:100,step:5,sfx:"%"},
  {k:"questions",l:"Kişi başı günlük soru",min:1,max:50,step:1,sfx:"soru",hint:"5–10 gerçekçi"},
  {k:"days",l:"Ay günü",min:1,max:31,step:1,sfx:"gün"},
  {k:"stayDays",l:"Ortalama konaklama",min:1,max:30,step:1,sfx:"gün"},
  {k:"engagement",l:"Botla konuşan misafir oranı",min:10,max:100,step:5,sfx:"%",hint:"ManyChat planını belirler"},

  {sec:"Model yönlendirme (routing) — tüm paketler"},
  {routing:true},
  {k:"inTokens",l:"Input token / soru",min:200,max:8000,step:100,sfx:"tk"},
  {k:"outTokens",l:"Output token / soru",min:50,max:1500,step:50,sfx:"tk"},
  {k:"cacheFrac",l:"Cache oranı",min:0,max:95,step:5,sfx:"%"},

  {sec:"WhatsApp (giriş/çıkış şablonu) — tüm paketler"},
  {k:"waMsgsPerStay",l:"Proaktif mesaj / konaklama",min:0,max:5,step:1,sfx:"adet",hint:"Giriş + çıkış = 2"},
  {k:"waRate",l:"Utility birim fiyat",min:0,max:0.06,step:0.0001,sfx:"$",hint:"Türkiye ~$0.0053"},
  {check:"waCheckoutFree",t:"Çıkış mesajı ücretsiz pencerede",s:"Misafir aktifse bedava sayılır"},

  {sec:"Paket 2 — talep iletme + rapor"},
  {k:"reqPerStay",l:"Konaklama başı departman talebi",min:0,max:6,step:.5,sfx:"adet",hint:"Her talep Türkçe staff özeti üretir"},
  {voiceless_opsModel:true},
  {k:"reportsPerMonth",l:"Aylık yönetici raporu",min:0,max:120,step:1,sfx:"adet",hint:"Günlük=30, haftalık=4"},
  {k:"reportInTokens",l:"Rapor input token",min:1000,max:30000,step:500,sfx:"tk"},
  {k:"reportOutTokens",l:"Rapor output token",min:200,max:4000,step:100,sfx:"tk"},

  {sec:"Paket 3 — sesli agent"},
  {voicemodel:true},
  {k:"voiceShare",l:"Sesli kullanan misafir oranı",min:0,max:100,step:5,sfx:"%",hint:"Konaklayanların yüzdesi"},
  {k:"voiceMinPerStay",l:"Konaklama başı sesli dakika",min:0,max:30,step:1,sfx:"dk"},
  {k:"voiceRate",l:"Sesli birim maliyet",min:0,max:0.5,step:0.01,sfx:"$/dk",hint:"Realtime gerçek rate; cache ile düşer"},

  {sec:"Satış modu"},
  {modeseg:true},
  {k:"tenantsTotal",l:"Platformdaki toplam ücretli otel",min:1,max:200,step:1,sfx:"otel",hint:"Sabit altyapıyı BÖLEN sayı — tek satışta bile 1 yapma"},
  {k:"chainSize",l:"Bu zincir anlaşmasındaki otel",min:1,max:100,step:1,sfx:"otel",showIf:s=>s.mode==="chain"},
  {k:"chainDiscount",l:"Zincir toptan indirimi",min:0,max:40,step:1,sfx:"%",hint:"Her otele uygulanır",showIf:s=>s.mode==="chain"&&s.autoPrice},

  {sec:"Fiyat & marjlar"},
  {check:"autoPrice",t:"Satış fiyatını otomatik öner",s:"Kapatırsan fiyatı elle girersin (seçili paket)"},
  {k:"price",l:"Manuel fiyat (KDV hariç)",min:300,max:30000,step:50,sfx:"$",dep:"!autoPrice"},
  {check:"mcAuto",t:"ManyChat'i otomatik seç",s:"Aktif contact'a göre Pro / Business"},
  {k:"manychat",l:"Manuel ManyChat ($)",min:0,max:400,step:1,sfx:"$",dep:"!mcAuto"},
  {k:"supabaseShared",l:"Supabase (paylaşımlı)",min:0,max:200,step:5,sfx:"$"},
  {k:"fixedTotal",l:"Diğer sabit gider",min:0,max:1000,step:1,sfx:"$",hint:"Vercel+Max+Gemini+Perplexity+Server+Web"},
  {k:"marginP1",l:"Paket 1 hedef marjı",min:50,max:95,step:1,sfx:"%"},
  {k:"marginP2",l:"Paket 2 hedef marjı",min:50,max:95,step:1,sfx:"%"},
  {k:"marginP3",l:"Paket 3 hedef marjı",min:50,max:95,step:1,sfx:"%"},
  {k:"taxRate",l:"Gelir vergisi oranı",min:0,max:50,step:5,sfx:"%"},
  {k:"kdv",l:"KDV oranı (geçiş)",min:0,max:20,step:1,sfx:"%",hint:"Faturaya eklenir, devlete ödenir"},
];

const GUIDE = [
  ["Tek otel mi yeterli?","Evet — modu 'Tek otel' yap, zincir kartı gizlenir. AMA dikkat: 'Toplam ücretli otel'i 1 yapma. Sabit altyapın (Vercel, Perplexity, server ~$238) tüm müşteri tabanına yayılır; tek bir otele yüklersen maliyet şişer, marj çöker. Tek satışta bile bu sayı = toplam tenant sayın."],
  ["Paket 1 · Giriş","Sadece bilgi: konaklayan + dışarıdan yazan misafire cevap. Routing'li metin LLM + ManyChat + WhatsApp. En düşük maliyet, en düşük marj kademesi."],
  ["Paket 2 · Talep+Rapor","Paket 1 + talepleri departmanlara iletme + yöneticiye periyodik rapor. Ham maliyet farkı KÜÇÜK (özet/rapor token'ı birkaç $). Fiyat farkı DEĞER bazlı: marjı yüksek tut."],
  ["Paket 3 · Sesli Agent","Paket 2 + sesli agent. Tek gerçek ek maliyet bu. Realtime ~$0.06–0.18/dk. 200 oda · %30 sesli · 5 dk → ~$100+/ay. Maliyeti misafir sayısı × dakika × $/dk olarak hesaplar."],
  ["Sesli model seçimi","Realtime-mini ucuz (~$0.09/dk), Realtime-2 daha akıllı (~$0.18/dk). Whisper+TTS pipeline en ucuz ama daha yavaş/parçalı. Cache + prompt diyeti dakika maliyetini ~yarıya indirir."],
  ["Marjlar","Her paketin kendi marjı var. Maliyet zaten kademeli arttığı için fiyat da artar; üst pakette marjı yükseltmek tier'ları ticari olarak ayırır."],
  ["KDV (%20)","GEÇİŞ KALEMİ. Faturayı büyütür, devlete ödenir; cebine kalanı DEĞİŞTİRMEZ."],
];

function fUSD(n){const neg=n<0?"-$":"$";const d=(Math.abs(n)>=100)?0:2;return neg+Math.abs(n).toLocaleString("en-US",{maximumFractionDigits:d});}
function fNum(n){return Math.round(n).toLocaleString("tr-TR");}

function pickMC(ac){
  const pro=29+Math.max(0,ac-2500)*0.05, bus=69+Math.max(0,ac-7500)*0.025;
  return {name:pro<=bus?"Pro":"Business",cost:Math.min(pro,bus),overUnits:Math.max(0,ac-(pro<=bus?2500:7500)),advanced:ac>12000};
}

function llmCost(s, q){
  const inMult=1-s.cacheFrac/100+(s.cacheFrac/100)*0.1;
  const sm=MODELS[s.simpleModel], cm=MODELS[s.complexModel];
  const qS=q*(s.simpleShare/100), qC=q-qS;
  const aS=(qS*s.inTokens/1e6)*sm.inRate*inMult+(qS*s.outTokens/1e6)*sm.outRate;
  const aC=(qC*s.inTokens/1e6)*cm.inRate*inMult+(qC*s.outTokens/1e6)*cm.outRate;
  return {api:aS+aC, aS, aC};
}

function opsCostFn(s, stays){
  const m=MODELS[s.opsModel]||MODELS.haiku;
  const reqs=stays*s.reqPerStay;
  const summary=reqs*(s.opsInTokens/1e6*m.inRate + s.opsOutTokens/1e6*m.outRate);
  const reports=s.reportsPerMonth*(s.reportInTokens/1e6*m.inRate + s.reportOutTokens/1e6*m.outRate);
  return {ops:summary+reports, reqs, summary, reports};
}

function voiceCostFn(s, stays){
  const guests=stays*s.voiceShare/100;
  return {voice:guests*s.voiceMinPerStay*s.voiceRate, guests, minutes:guests*s.voiceMinPerStay};
}

function priceFor(cost, marginPct){
  return Math.ceil((cost/(1-marginPct/100))/10)*10;
}

function compute(s){
  const q=s.rooms*s.people*(s.occupancy/100)*s.questions*s.days;
  const L=llmCost(s,q); const api=L.api;
  const activeContacts=s.rooms*s.people*(s.occupancy/100)*(s.days/Math.max(1,s.stayDays))*(s.engagement/100);
  const mcPick=pickMC(activeContacts);
  const manychatCost=s.mcAuto?mcPick.cost:s.manychat;
  const stays=s.stayDays>0?s.rooms*(s.occupancy/100)*s.days/s.stayDays:0;
  const chargedPerStay=Math.max(0,s.waMsgsPerStay-(s.waCheckoutFree?1:0));
  const waCost=stays*chargedPerStay*s.waRate;

  const sharedTotal=s.supabaseShared+s.fixedTotal;
  const sharedPerHotel=sharedTotal/Math.max(1,s.tenantsTotal);

  const base=api+manychatCost+waCost+sharedPerHotel;     // Paket 1 maliyeti
  const O=opsCostFn(s,stays); const ops=O.ops;            // Paket 2 ek
  const V=voiceCostFn(s,stays); const voice=V.voice;      // Paket 3 ek

  const costP1=base;
  const costP2=base+ops;
  const costP3=base+ops+voice;

  const margins=[s.marginP1,s.marginP2,s.marginP3];
  const costs=[costP1,costP2,costP3];
  const list=costs.map((c,i)=>priceFor(c,margins[i]));

  // seçili paket
  const i=s.pkg-1;
  const selCost=costs[i], selMargin=margins[i], recPrice=list[i];

  const discPct=(s.mode==="chain")?s.chainDiscount:0;
  const discountedRaw=recPrice*(1-discPct/100);
  const effPrice=s.autoPrice?Math.round(discountedRaw/10)*10:s.price;
  const discountAmount=s.autoPrice?recPrice-effPrice:0;

  const profitBeforeTax=effPrice-selCost;
  const tax=Math.max(0,profitBeforeTax)*(s.taxRate/100);
  const netInPocket=profitBeforeTax-tax;
  const margin=effPrice>0?profitBeforeTax/effPrice:0;
  const kdvAmount=effPrice*(s.kdv/100);
  const invoice=effPrice+kdvAmount;

  // paket karşılaştırma (vergi sonrası cep, seçili modun indirimi uygulanmadan, liste fiyat üzerinden)
  const pkgRows=costs.map((c,idx)=>{
    const p=list[idx];
    const eff=s.autoPrice?Math.round(p*(1-discPct/100)/10)*10:(idx===i?s.price:p);
    const pbt=eff-c, tx=Math.max(0,pbt)*(s.taxRate/100);
    return {cost:c, margin:margins[idx], list:p, eff, invoice:eff*(1+s.kdv/100), pocket:pbt-tx};
  });

  // zincir
  const N=s.chainSize;
  const chainRevenue=effPrice*N;
  const chainCost=selCost*N;
  const chainPBT=chainRevenue-chainCost;
  const chainTax=Math.max(0,chainPBT)*(s.taxRate/100);
  const chainNet=chainPBT-chainTax;

  return {q,api,aS:L.aS,aC:L.aC,activeContacts,mcPick,manychatCost,stays,waCost,
    sharedPerHotel,ops,O,voice,V,costP1,costP2,costP3,costs,list,
    selCost,selMargin,recPrice,effPrice,discountAmount,discPct,
    profitBeforeTax,tax,netInPocket,margin,kdvAmount,invoice,pkgRows,
    chainRevenue,chainCost,chainNet};
}

function sizeTable(s){
  const sizes=[100,250,500,1000,1500,2000,2500];
  const sharedPerHotel=(s.supabaseShared+s.fixedTotal)/Math.max(1,s.tenantsTotal);
  const chargedPerStay=Math.max(0,s.waMsgsPerStay-(s.waCheckoutFree?1:0));
  const i=s.pkg-1; const margin=[s.marginP1,s.marginP2,s.marginP3][i];
  return sizes.map(rm=>{
    const q=rm*s.people*(s.occupancy/100)*s.questions*s.days;
    const api=llmCost(s,q).api;
    const ac=rm*s.people*(s.occupancy/100)*(s.days/Math.max(1,s.stayDays))*(s.engagement/100);
    const mc=s.mcAuto?pickMC(ac):{name:"Manuel",cost:s.manychat};
    const stays=s.stayDays>0?rm*(s.occupancy/100)*s.days/s.stayDays:0;
    const waCost=stays*chargedPerStay*s.waRate;
    let cost=api+mc.cost+waCost+sharedPerHotel;
    if(s.pkg>=2) cost+=opsCostFn(s,stays).ops;
    if(s.pkg>=3) cost+=voiceCostFn(s,stays).voice;
    const minP=priceFor(cost,margin);
    return {rm,plan:mc.name,mcCost:mc.cost,minP,minPKdv:minP*(1+s.kdv/100)};
  });
}

function buildInputs(){
  const root=document.getElementById("inputs"); root.innerHTML="";
  FIELDS.forEach(f=>{
    if(f.sec){const d=document.createElement("div");d.className="section";d.textContent=f.sec;root.appendChild(d);return;}

    if(f.modeseg){
      const d=document.createElement("div");d.className="seg";d.dataset.seg="mode";
      d.innerHTML=
        '<button data-m="single" class="'+(state.mode==="single"?"on":"")+'">Tek otel<span class="s">tek satış</span></button>'+
        '<button data-m="chain" class="'+(state.mode==="chain"?"on":"")+'">Zincir<span class="s">çoklu otel</span></button>';
      d.querySelectorAll("button").forEach(b=>b.onclick=()=>{state.mode=b.dataset.m;render();});
      root.appendChild(d);return;
    }

    if(f.routing){
      const opts=Object.entries(MODELS).map(([id,m])=>'<option value="'+id+'">'+m.name+' ($'+m.inRate+'/$'+m.outRate+')</option>').join("");
      const d=document.createElement("div");
      d.innerHTML=
        '<div class="field"><div class="top"><label>Basit soru oranı</label><div><input class="num rt-sn" type="number" value="'+state.simpleShare+'" min="0" max="100" step="5"><span class="suffix">%</span></div></div><input class="rt-sr" type="range" value="'+state.simpleShare+'" min="0" max="100" step="5"><div class="hint">Geri kalan üst düzey modele gider</div></div>'+
        '<div class="sel"><label>Basit sorular → ucuz model</label><select class="num rt-simple">'+opts+'</select></div>'+
        '<div class="sel"><label>Üst düzey sorular → güçlü model</label><select class="num rt-complex">'+opts+'</select></div>';
      root.appendChild(d);
      d.querySelector(".rt-simple").value=state.simpleModel;
      d.querySelector(".rt-complex").value=state.complexModel;
      const sn=d.querySelector(".rt-sn"), sr=d.querySelector(".rt-sr");
      const upd=v=>{state.simpleShare=Number(v);sn.value=v;sr.value=v;render();};
      sn.oninput=e=>upd(e.target.value); sr.oninput=e=>upd(e.target.value);
      d.querySelector(".rt-simple").onchange=e=>{state.simpleModel=e.target.value;render();};
      d.querySelector(".rt-complex").onchange=e=>{state.complexModel=e.target.value;render();};
      return;
    }

    if(f.voiceless_opsModel){
      const opts=Object.entries(MODELS).map(([id,m])=>'<option value="'+id+'">'+m.name+'</option>').join("");
      const d=document.createElement("div");d.className="sel";
      d.innerHTML='<label>Özet/rapor modeli</label><select class="num ops-m">'+opts+'</select>';
      d.querySelector(".ops-m").value=state.opsModel;
      d.querySelector(".ops-m").onchange=e=>{state.opsModel=e.target.value;render();};
      root.appendChild(d);return;
    }

    if(f.voicemodel){
      const opts=Object.entries(VOICE).map(([id,m])=>'<option value="'+id+'">'+m.name+' (~$'+m.rate+'/dk)</option>').join("");
      const d=document.createElement("div");d.className="sel";
      d.innerHTML='<label>Sesli model</label><select class="num v-m">'+opts+'</select>';
      d.querySelector(".v-m").value=state.voiceModel;
      d.querySelector(".v-m").onchange=e=>{state.voiceModel=e.target.value;state.voiceRate=VOICE[e.target.value].rate;render();buildInputs();};
      root.appendChild(d);return;
    }

    if(f.check){
      const d=document.createElement("label");d.className="check"+(state[f.check]?" on":"");d.dataset.check=f.check;
      d.innerHTML='<input type="checkbox" '+(state[f.check]?"checked":"")+'><div><div class="t">'+f.t+'</div><div class="s">'+f.s+'</div></div>';
      d.querySelector("input").onchange=e=>{state[f.check]=e.target.checked;render();};
      root.appendChild(d);return;
    }

    const d=document.createElement("div");d.className="field";d.dataset.key=f.k;
    d.innerHTML='<div class="top"><label>'+f.l+'</label><div><input class="num" type="number" value="'+state[f.k]+'" min="'+f.min+'" max="'+f.max+'" step="'+f.step+'"><span class="suffix">'+(f.sfx||"")+'</span></div></div><input type="range" value="'+state[f.k]+'" min="'+f.min+'" max="'+f.max+'" step="'+f.step+'">'+(f.hint?'<div class="hint">'+f.hint+'</div>':'');
    const num=d.querySelector(".num"), rng=d.querySelector('input[type=range]');
    const upd=v=>{state[f.k]=Number(v);num.value=v;rng.value=v;render();};
    num.oninput=e=>upd(e.target.value); rng.oninput=e=>upd(e.target.value);
    root.appendChild(d);
  });
}

function applyDeps(){
  FIELDS.forEach(f=>{
    if(!f.k)return;
    let show=true;
    if(f.dep){const neg=f.dep.charAt(0)==="!"; const key=neg?f.dep.slice(1):f.dep; show=neg?!state[key]:state[key];}
    if(f.showIf) show=show&&f.showIf(state);
    const el=document.querySelector('.field[data-key="'+f.k+'"]');
    if(el){el.style.display=(f.showIf&&!f.showIf(state))?"none":"block";
      el.style.opacity=show?1:.4; el.querySelectorAll("input").forEach(i=>i.disabled=!show);}
  });
}

function render(){
  const c=compute(state);
  document.querySelectorAll(".check").forEach(d=>{const k=d.dataset.check; d.className="check"+(state[k]?" on":"");});
  document.querySelectorAll('.seg[data-seg="mode"] button').forEach(b=>b.className=(state.mode===b.dataset.m?"on":""));
  applyDeps();

  // PAKET KARŞILAŞTIRMA TABLOSU
  ["pc1","pc2","pc3"].forEach((id,i)=>{const th=document.getElementById(id);th.className="c"+(state.pkg===i+1?" hl":"");});
  const names=["1 · Giriş","2 · Talep+Rapor","3 · Sesli"];
  const hl=i=>state.pkg===i+1?" hlcol":"";
  const pr=c.pkgRows;
  const r=(label,fn)=>'<tr><td>'+label+'</td>'+[0,1,2].map(i=>'<td class="'+hl(i).trim()+'">'+fn(pr[i],i)+'</td>').join("")+'</tr>';
  document.getElementById("pkgRows").innerHTML=
    r("İçerik",(_,i)=>['Bilgi','+Talep+Rapor','+Sesli agent'][i])+
    r("Aylık maliyet",x=>fUSD(x.cost))+
    r("Marj",x=>"%"+x.margin)+
    r("Önerilen fiyat",x=>'<b>'+fUSD(x.eff)+'</b>')+
    r("Faturada (+KDV)",x=>fUSD(x.invoice))+
    r("Cebe kalan/ay",x=>'<span class="'+(x.pocket>=0?'pos':'neg')+'">'+fUSD(x.pocket)+'</span>');

  // FİYAT KARTI (seçili paket)
  document.getElementById("priceLab").textContent="PAKET "+state.pkg+" · "+state.rooms+" ODA / AY (%"+c.selMargin+" marj)";
  document.getElementById("priceVal").innerHTML=fUSD(c.effPrice)+'<span style="font-size:15px;font-weight:600;color:#3A2B0E"> + KDV</span>';
  const pd=document.getElementById("priceDisc");
  if(c.discountAmount>0){pd.style.display="block";pd.textContent="Liste "+fUSD(c.recPrice)+" − %"+c.discPct+" zincir indirimi (−"+fUSD(c.discountAmount)+")";}
  else pd.style.display="none";
  document.getElementById("priceInv").innerHTML="Faturada (KDV dahil): <b style='color:#fff'>"+fUSD(c.invoice)+"</b> · maliyet "+fUSD(c.selCost)+" · marj %"+Math.round(c.margin*100);

  // MANYCHAT
  document.getElementById("mcName").textContent=c.mcPick.name;
  document.getElementById("mcCost").textContent=fUSD(c.manychatCost)+"/ay";
  let mcInfo="~"+fNum(c.activeContacts)+" aktif contact/ay. ";
  if(c.mcPick.overUnits>0) mcInfo+="Limit aşımı: "+fNum(c.mcPick.overUnits)+" contact. ";
  if(c.mcPick.advanced) mcInfo+='<b style="color:var(--red)">10.000+ contact — Advanced (özel fiyat).</b>';
  document.getElementById("mcInfo").innerHTML=mcInfo;

  // SESLİ KART
  const vc=document.getElementById("voiceCard");
  vc.style.opacity=state.pkg>=3?1:.5;
  document.getElementById("vName").textContent=VOICE[state.voiceModel].name;
  document.getElementById("vCost").textContent=fUSD(c.voice)+"/ay";
  document.getElementById("vInfo").innerHTML="~"+fNum(c.V.guests)+" sesli misafir × "+state.voiceMinPerStay+" dk = "+fNum(c.V.minutes)+" dk · $"+state.voiceRate+"/dk"+(state.pkg<3?' <b>(sadece Paket 3\\'te faturaya girer)</b>':"");

  // CEP
  const pos=c.netInPocket>=0;
  document.getElementById("pocketLab").textContent="VERGİDEN SONRA CEBİNE KALAN / AY (otel başı)";
  const pv=document.getElementById("pocketVal");pv.textContent=fUSD(c.netInPocket);pv.style.color=pos?"#7BE0A8":"#FF9B86";
  document.getElementById("pocketInfo").innerHTML="Satış "+fUSD(c.effPrice)+" (+KDV) · marj %"+Math.round(c.margin*100)+" · routing: "+state.simpleShare+"% "+MODELS[state.simpleModel].name+" + "+MODELS[state.complexModel].name;

  // ZİNCİR
  const chainCard=document.getElementById("chainCard");
  if(state.mode==="chain"){
    chainCard.style.display="block";
    document.getElementById("chainLab").textContent="ZİNCİR · "+state.chainSize+" OTEL TOPLAMI / AY (Paket "+state.pkg+")";
    document.getElementById("chainVal").innerHTML=fUSD(c.chainNet)+'<span style="font-size:13px;font-weight:600;color:#AEB8C4"> net (vergi sonrası)</span>';
    document.getElementById("chainInfo").textContent=state.chainSize+" × "+fUSD(c.effPrice)+" = "+fUSD(c.chainRevenue)+" gelir − "+fUSD(c.chainCost)+" gider · yıllık ~"+fUSD(c.chainNet*12);
  } else chainCard.style.display="none";

  // DÖKÜM
  const bd=document.getElementById("breakdown");
  const row=(l,v,sub,strong,cls)=>'<div class="ln'+(strong?" strong":"")+'"><span class="l">'+(strong?"<b>"+l+"</b>":l)+(sub?' <span class="sub">· '+sub+'</span>':'')+'</span><span class="v '+(cls||"")+'">'+v+'</span></div>';
  let html=
    row("Fatura tutarı (KDV dahil)",fUSD(c.invoice))+
    row("KDV → devlete (senin değil)","-"+fUSD(c.kdvAmount),"%"+state.kdv,false,"")+
    row("Net gelir (sana kalan)",fUSD(c.effPrice),null,true,"pos")+
    row("LLM API (routing)","-"+fUSD(c.api),fNum(c.q)+" sorgu · basit "+fUSD(c.aS)+" + üst "+fUSD(c.aC),false,"neg")+
    row("ManyChat "+c.mcPick.name,"-"+fUSD(c.manychatCost),null,false,"neg")+
    row("WhatsApp şablon","-"+fUSD(c.waCost),fNum(c.stays)+" konaklama",false,"neg");
  if(state.pkg>=2)
    html+=row("Talep özeti + rapor (P2)","-"+fUSD(c.ops),fNum(c.O.reqs)+" talep + "+state.reportsPerMonth+" rapor",false,"neg");
  if(state.pkg>=3)
    html+=row("Sesli agent (P3)","-"+fUSD(c.voice),fNum(c.V.minutes)+" dk · "+VOICE[state.voiceModel].name,false,"neg");
  html+=
    row("Paylaşılan altyapı payı","-"+fUSD(c.sharedPerHotel),fUSD(state.supabaseShared+state.fixedTotal)+" / "+state.tenantsTotal+" otel",false,"neg")+
    row("Toplam gider","-"+fUSD(c.selCost),null,true,"neg")+
    row("Vergi öncesi kâr",fUSD(c.profitBeforeTax),null,true)+
    row("Gelir vergisi (%"+state.taxRate+")","-"+fUSD(c.tax),null,false,"neg")+
    '<div class="final"><span class="l">NET CEBİNE KALAN</span><span class="v '+(pos?"pos":"neg")+'">'+fUSD(c.netInPocket)+'</span></div>';
  bd.innerHTML=html;

  // BÜYÜKLÜK TABLOSU
  document.getElementById("tblTitle").textContent="Büyüklüğe göre fiyat — Paket "+state.pkg;
  const rows=sizeTable(state);
  document.getElementById("sizeRows").innerHTML=rows.map(s=>
    '<tr class="'+(s.rm===state.rooms?"hl":"")+'"><td>'+s.rm+'</td><td class="c">'+s.plan+' · '+fUSD(s.mcCost)+'</td><td style="font-weight:700">'+fUSD(s.minP)+'</td><td style="font-weight:800;color:var(--brass)">'+fUSD(s.minPKdv)+'</td></tr>'
  ).join("");
}

let guideOpen=true;
function buildGuide(){
  const g=document.getElementById("gcards");
  g.innerHTML=GUIDE.map(p=>'<div class="gcard"><div class="k">'+p[0]+'</div><div class="v">'+p[1]+'</div></div>').join("")+
    '<div class="gcard dark"><div class="k">Paket seçimi (sağ üstte)</div><div class="v">Üstteki tabloda 3 paketi yan yana görürsün. Aşağıdaki kart/döküm SEÇİLİ paketi gösterir — paketi değiştirmek için tablo başlığındaki paketin ilgili marjını/alanlarını ayarla, kart otomatik güncellenir. Sesli alanları her zaman düzenlenebilir; sadece Paket 3 faturasına girer.</div></div>';
}
function toggleGuide(){guideOpen=!guideOpen;document.getElementById("gcards").style.display=guideOpen?"grid":"none";document.getElementById("guideX").textContent=guideOpen?"gizle ▲":"göster ▼";}

// paket seçimi: karşılaştırma tablosu başlığına tıkla
document.addEventListener("click",e=>{
  const th=e.target.closest("#pc1,#pc2,#pc3");
  if(th){state.pkg=Number(th.id.slice(2));render();}
});

buildInputs(); buildGuide(); render();
</script>
</body>
</html>
`;
