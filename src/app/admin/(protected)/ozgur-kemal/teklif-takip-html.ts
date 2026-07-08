export const TEKLIF_TAKIP_HTML = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>HotelGen — Teklif & Takip</title>
<style>
  :root{--ink:#0F1B2D;--brass:#B8893B;--brassSoft:#E9D9B8;--paper:#F7F5F0;
    --slate:#5C6B7A;--line:#E2DDD2;--green:#2E7D52;--red:#B3402F;--teal:#1D9E75;}
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;}
  .wrap{max-width:1120px;margin:0 auto;padding:26px 20px 44px}
  h1{font-size:27px;margin:6px 0 4px;font-weight:800;letter-spacing:-.5px}
  .eyebrow{font-size:10.5px;letter-spacing:3px;color:var(--brass);font-weight:700;text-transform:uppercase}
  .sub{font-size:13px;color:var(--slate);line-height:1.5}
  .head{border-bottom:2px solid var(--ink);padding-bottom:13px;margin-bottom:20px}
  .tabs{display:flex;gap:8px;margin-bottom:22px}
  .tabs button{flex:1;border:1px solid var(--line);background:#fff;border-radius:10px;padding:13px 10px;cursor:pointer;
    font-size:13.5px;font-weight:700;color:var(--slate);line-height:1.3}
  .tabs button .s{display:block;font-size:11px;font-weight:500;color:var(--slate);margin-top:3px}
  .tabs button.on{background:var(--ink);color:#fff;border-color:var(--ink)}
  .tabs button.on .s{color:var(--brassSoft)}
  .grid{display:grid;grid-template-columns:minmax(290px,.85fr) minmax(340px,1.15fr);gap:26px}
  @media(max-width:800px){.grid{grid-template-columns:1fr}}
  .section{font-size:10.5px;letter-spacing:2px;text-transform:uppercase;font-weight:700;color:var(--brass);
    margin:16px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--line)}
  .section:first-child{margin-top:0}
  .field{margin-bottom:12px}
  .field .top{display:flex;justify-content:space-between;align-items:baseline}
  .field label{font-size:12.5px;font-weight:600}
  .field label .s{display:block;font-size:10.5px;color:var(--slate);font-weight:400;margin-top:1px}
  .desc{font-size:10.5px;color:var(--slate);margin-top:4px;line-height:1.45}
  .num{width:92px;text-align:right;border:1px solid var(--line);border-radius:6px;padding:5px 8px;
    font-size:14px;font-variant-numeric:tabular-nums;color:var(--ink);background:#fff}
  input[type=range]{width:100%;accent-color:var(--brass);margin-top:6px}
  .numwrap{display:flex;align-items:center;gap:5px}
  .numwrap .pre{font-size:12px;color:var(--slate);font-weight:600}
  .numwrap .suf{font-size:12px;color:var(--slate);width:24px}
  .seg{display:flex;gap:6px;margin:2px 0 4px}
  .seg button{flex:1;border:1px solid var(--line);background:#fff;border-radius:7px;padding:7px 4px;cursor:pointer;
    font-size:12.5px;font-weight:700;color:var(--slate)}
  .seg button.on{background:var(--brass);border-color:var(--brass);color:#fff}
  details{border:1px solid var(--line);border-radius:8px;padding:2px 12px;margin-top:6px;background:#fff}
  details summary{font-size:12px;font-weight:700;color:var(--slate);cursor:pointer;padding:9px 0}
  .modelrow{display:grid;grid-template-columns:1fr 58px 58px;gap:6px;align-items:center;margin-bottom:6px}
  .modelrow .mlab{font-size:11px;font-weight:600}
  .modelrow .mlab .dot{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:middle}
  .modelrow input.num{width:100%}
  .modelrow .mhead{font-size:9.5px;color:var(--slate);text-align:right;font-weight:600}
  .card{border-radius:12px;padding:16px 22px;margin-bottom:14px}
  .price{background:var(--brass);color:#fff}
  .price .lab{font-size:11px;letter-spacing:2px;color:#3A2B0E;font-weight:800}
  .price .big{font-size:42px;font-weight:800;line-height:1.05;margin:5px 0;font-variant-numeric:tabular-nums}
  .price .small{font-size:12.5px;color:#3A2B0E;font-weight:600}
  .price .kdv{margin-top:10px;padding-top:10px;border-top:1px solid rgba(58,43,14,.28);display:flex;justify-content:space-between;align-items:baseline}
  .price .kdv .kl{font-size:11.5px;color:#3A2B0E;font-weight:700}
  .price .kdv .kv{font-size:20px;font-weight:800;font-variant-numeric:tabular-nums}
  .price .kdv .kv .u{font-size:12px;font-weight:600}
  .money{border-radius:12px;overflow:hidden;margin-bottom:14px;border:1px solid var(--line)}
  .money .band{padding:13px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px}
  .money .band+.band{border-top:2px solid rgba(255,255,255,.15)}
  .money .b-offer{background:var(--ink);color:#fff}
  .money .b-invoice{background:var(--brass);color:#fff}
  .money .b-profit{background:#0C3B2E;color:#fff}
  .money .lab{font-size:10.5px;font-weight:800;letter-spacing:.4px}
  .money .b-offer .lab{color:var(--brassSoft)}
  .money .b-invoice .lab{color:#3A2B0E}
  .money .b-profit .lab{color:#7BE0A8}
  .money .sub{font-size:10.5px;margin-top:3px;line-height:1.35}
  .money .b-offer .sub{color:#AEB8C4}
  .money .b-invoice .sub{color:#4A3708}
  .money .b-profit .sub{color:#8FBBA6}
  .money .amt{font-size:27px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right}
  .money .amt.big{font-size:36px;color:#7BE0A8}
  .money .amt .u{font-size:13px;font-weight:600}
  .box{background:#fff;border:1px solid var(--line);border-radius:10px;padding:4px 16px 12px;margin-bottom:14px}
  .ln{display:flex;justify-content:space-between;align-items:baseline;padding:8px 0;border-bottom:1px solid var(--line)}
  .ln:last-child{border-bottom:none}
  .ln .l{font-size:12.5px;color:var(--slate);font-weight:500}
  .ln .l .s{font-size:10.5px;color:var(--slate)}
  .ln .v{font-size:13.5px;font-weight:600;font-variant-numeric:tabular-nums}
  .ln.strong .l{font-size:13.5px;color:var(--ink);font-weight:700}
  .ln.strong .v{font-size:15px;font-weight:800}
  .ln.sub{background:#FBF9F4;margin:0 -16px;padding:8px 16px;border-bottom:1px solid var(--line)}
  .ln.sub .l{color:var(--ink);font-weight:600}
  .ln.sub .v b{color:var(--ink)}
  .reverse{background:#16314D;color:#fff;border-radius:10px;padding:13px 18px;margin-bottom:14px}
  .reverse .lab{font-size:10.5px;letter-spacing:1px;color:var(--brassSoft);font-weight:700;margin-bottom:7px}
  .reverse .row{display:flex;justify-content:space-between;align-items:center;gap:10px}
  .reverse .num{width:110px}
  .reverse .res{font-size:22px;font-weight:800;color:#7BE0A8;font-variant-numeric:tabular-nums}
  .reverse .rlab{font-size:11px;color:#AEB8C4;margin-top:4px}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden}
  thead th{background:var(--ink);color:#fff;font-size:9.5px;font-weight:700;padding:7px 5px;text-align:right;white-space:nowrap;line-height:1.15}
  thead th:first-child,thead th:nth-child(2){text-align:left}
  tbody td{font-size:12px;padding:4px 5px;border-top:1px solid var(--line);text-align:right;font-variant-numeric:tabular-nums}
  tbody td.otel{text-align:left;font-weight:700;color:var(--ink)}
  tbody td.hash{text-align:center;color:var(--slate);font-weight:700}
  tbody input.tinp{width:56px;text-align:right;border:1px solid var(--line);border-radius:5px;padding:2px 4px;font-size:11.5px;font-variant-numeric:tabular-nums;background:#FBF9F4}
  tbody input.tname{width:112px;text-align:left;border:1px solid var(--line);border-radius:5px;padding:2px 5px;font-size:11.5px;font-weight:700}
  tbody input.deal{width:64px;text-align:right;border:1px solid var(--brass);border-radius:5px;padding:2px 4px;font-size:11.5px;font-weight:700;font-variant-numeric:tabular-nums;background:#FBF1E0;color:#7A5A16}
  tbody td.kar b{color:var(--green)}
  tbody td.kar.neg b{color:var(--red)}
  .dayline{font-size:9.5px;color:var(--slate);margin-top:2px;line-height:1.1;white-space:nowrap}
  .dayline b{color:var(--ink);font-weight:800}
  tfoot td{font-size:12px;font-weight:800;padding:7px 5px;border-top:2px solid var(--ink);text-align:right;background:#FBF1E0}
  tfoot td:first-child,tfoot td:nth-child(2){text-align:left}
  .del{border:none;background:transparent;color:var(--red);font-weight:800;cursor:pointer;font-size:15px;padding:0 4px}
  .addrow{display:flex;gap:8px;align-items:flex-end;margin-bottom:14px;flex-wrap:wrap}
  .addrow .fld{display:flex;flex-direction:column;gap:3px}
  .addrow .fld label{font-size:11px;font-weight:600;color:var(--slate)}
  .addrow .fld input{border:1px solid var(--line);border-radius:6px;padding:6px 8px;font-size:13px}
  .addrow .fld input.name{width:170px}
  .addrow .fld input.rms{width:82px;text-align:right}
  .addrow .fld .unit{font-size:11px;color:var(--slate);align-self:center}
  .addrow button.add{background:var(--ink);color:#fff;border:none;border-radius:8px;padding:8px 16px;font-weight:700;font-size:13px;cursor:pointer}
  .budget{background:#fff;border:1px solid var(--line);border-radius:10px;padding:13px 16px;margin-top:14px}
  .budget .bhead{display:flex;justify-content:space-between;align-items:baseline;font-size:12.5px;font-weight:700;margin-bottom:8px;gap:10px}
  .budget .bhead .r{font-variant-numeric:tabular-nums;color:var(--slate)}
  .budget .track{height:14px;background:#EEE9DE;border-radius:7px;overflow:hidden}
  .budget .fill{height:100%;background:var(--teal);border-radius:7px;transition:width .2s}
  .budget .fill.over{background:var(--red)}
  .budget .bnote{font-size:11px;color:var(--slate);margin-top:9px;line-height:1.45}
  .budget .bnote.warn{color:var(--red);font-weight:600}
  .tnote{font-size:11px;color:var(--slate);margin:10px 0 0;line-height:1.5}
  .tnote.warn{background:#FBF1E0;border:1px solid var(--brassSoft);border-radius:8px;padding:9px 12px;color:#7A5A16}
  .guide{margin-top:24px;border-top:2px solid var(--ink);padding-top:14px}
  .guide .t{font-size:14px;font-weight:800;margin-bottom:11px}
  .gcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}
  .gcard{background:#fff;border:1px solid var(--line);border-radius:8px;padding:11px 13px}
  .gcard.dark{background:var(--ink);color:#fff}
  .gcard .k{font-size:12px;font-weight:700;margin-bottom:4px}
  .gcard.dark .k{color:var(--brassSoft)}
  .gcard .v{font-size:11px;color:var(--slate);line-height:1.5}
  .gcard.dark .v{color:#CDD6E0}
  .pos{color:var(--green)} .neg{color:var(--red)} .hide{display:none}
</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <div class="eyebrow">HotelGen · Teklif & Takip</div>
    <h1>Teklif Simülasyonu & Aktif Otel Takibi</h1>
    <div class="sub">Ortak maliyet motoru: 3-katman AI (Gemini Flash-Lite · gpt-5.4-mini · gpt-5.4) + otel başı Supabase + ManyChat. Misafir sayısı <b>maksimum kapasiteden</b> hesaplanır (aile odaları dahil).</div>
  </div>

  <div class="tabs">
    <button id="tab_q" class="on" onclick="switchTab('q')">1 · Teklif Simülasyonu<span class="s">Oda + kapasite gir → teklif fiyatı</span></button>
    <button id="tab_t" onclick="switchTab('t')">2 · Aktif Takip Tablosu<span class="s">Otelleri ekle → token/maliyet + 10M bütçe</span></button>
  </div>

  <!-- ================= TAB 1: TEKLİF ================= -->
  <div id="pane_q">
    <div class="grid">
      <div>
        <div class="section">Otel bilgileri</div>

        <div class="field"><div class="top"><label>Oda sayısı</label>
          <div class="numwrap"><input class="num" id="q_rooms" type="number" step="10" min="1" value="200"><span class="suf">oda</span></div></div>
          <input type="range" id="q_rooms_r" min="20" max="800" step="10" value="200"></div>

        <div class="field"><div class="top"><label>Maksimum kapasite <span class="s">otelin alabileceği toplam kişi</span></label>
          <div class="numwrap"><input class="num" id="q_cap" type="number" step="10" min="1" value="500"><span class="suf">kişi</span></div></div>
          <div class="desc">⚠️ Aile odaları yüzünden kapasite oda×2'den fazladır. Örn: 249 oda ama <b>650 kişi</b>. Eksik girersen düşük fiyat verip zarar edersin. Şu an ≈ <span id="q_ppr">2.5</span> kişi/oda.</div></div>

        <div class="field"><label>Doluluk oranı <span class="s">kapasitenin ne kadarı dolu</span></label>
          <div class="seg" id="q_occ_seg">
            <button data-v="70" class="on">%70</button><button data-v="80">%80</button><button data-v="90">%90</button>
          </div></div>

        <div class="field"><div class="top"><label>Ortalama konaklama <span class="s">talep/ManyChat sayısını etkiler</span></label>
          <div class="numwrap"><input class="num" id="q_stay" type="number" step="1" min="1" value="7"><span class="suf">gün</span></div></div></div>

        <div class="section">Kâr marjı</div>
        <div class="field"><label>Marj <span class="s">satış fiyatına oranla kâr</span></label>
          <div class="seg" id="q_marg_seg">
            <button data-v="50">%50</button><button data-v="60">%60</button><button data-v="80" class="on">%80</button>
          </div>
          <div class="numwrap" style="margin-top:6px"><span class="pre">özel:</span><input class="num" id="q_marg" type="number" step="1" min="0" max="99" value="80"><span class="suf">%</span></div></div>

        <div class="field"><div class="top"><label>KDV <span class="s">teklife eklenir → fatura</span></label>
          <div class="numwrap"><input class="num" id="q_kdv" type="number" step="1" value="20"><span class="suf">%</span></div></div></div>

        <div class="section">Otel başı sabit gider</div>
        <div class="field"><div class="top"><label>Supabase <span class="s">otelin kendi instance'ı</span></label>
          <div class="numwrap"><span class="pre">$</span><input class="num" id="q_supa" type="number" step="1" value="25"><span class="suf">/ay</span></div></div></div>
        <div class="field"><div class="top"><label>ManyChat <span class="s">otelin kendi contact'ları</span></label>
          <div class="numwrap"><span class="pre">$</span><input class="num" id="q_mc" type="number" step="1" value="29"><span class="suf">/ay</span></div></div></div>

        <details>
          <summary>⚙️ Token varsayımları & 3 model fiyatı</summary>
          <div style="padding-bottom:10px">
            <div class="field"><div class="top"><label>Kişi başı günlük soru</label>
              <div class="numwrap"><input class="num" id="q_qpd" type="number" step="1" value="6"><span class="suf">adet</span></div></div></div>
            <div class="field"><div class="top"><label>Input token / soru</label>
              <div class="numwrap"><input class="num" id="q_in" type="number" step="100" value="1500"><span class="suf">tk</span></div></div></div>
            <div class="field"><div class="top"><label>Output token / soru</label>
              <div class="numwrap"><input class="num" id="q_out" type="number" step="50" value="300"><span class="suf">tk</span></div></div></div>
            <div class="field"><div class="top"><label>Cache oranı <span class="s">sabit otel bilgisi cache'lenir</span></label>
              <div class="numwrap"><input class="num" id="q_cache" type="number" step="5" min="0" max="95" value="70"><span class="suf">%</span></div></div></div>
            <div class="field"><div class="top"><label>Konaklama başı departman talebi</label>
              <div class="numwrap"><input class="num" id="q_req" type="number" step=".5" value="1.5"><span class="suf">adet</span></div></div>
              <div class="desc">Misafirin departmana yönlenen <b>gerçek talebi</b> (havlu, tamir, spa, oda servisi) — her mesaj değil, yalnızca staff'a düşüp Türkçe özet üreten talepler. Kimi misafir 0 (sadece bilgi sorar), kimi 3-4 → ortalama ~1.5. Her talep orta katman (gpt-5.4-mini) maliyeti üretir.</div></div>

            <div style="font-size:10.5px;color:var(--slate);font-weight:700;margin:12px 0 6px">Soru zorluk dağılımı (%) — ileri = kalan</div>
            <div class="field"><div class="top"><label>🟢 Basit %</label><div class="numwrap"><input class="num" id="q_s1" type="number" step="5" min="0" max="100" value="60"><span class="suf">%</span></div></div></div>
            <div class="field"><div class="top"><label>🟡 Orta %</label><div class="numwrap"><input class="num" id="q_s2" type="number" step="5" min="0" max="100" value="30"><span class="suf">%</span></div></div>
              <div class="desc">🔴 İleri = <span id="q_s3">10</span>% (alerjen, şikayet, güvenlik — asla ucuza düşmez)</div></div>

            <div style="font-size:10.5px;color:var(--slate);font-weight:700;margin:12px 0 6px">Model fiyatları ($/1M) — düzenlenebilir</div>
            <div class="modelrow"><div class="mhead">model</div><div class="mhead">in</div><div class="mhead">out</div></div>
            <div class="modelrow"><div class="mlab"><span class="dot" style="background:#1D9E75"></span>Gemini Flash-Lite</div><input class="num" id="m_s_i" type="number" step=".05" value="0.10"><input class="num" id="m_s_o" type="number" step=".05" value="0.40"></div>
            <div class="modelrow"><div class="mlab"><span class="dot" style="background:#EDA100"></span>gpt-5.4-mini</div><input class="num" id="m_m_i" type="number" step=".05" value="0.75"><input class="num" id="m_m_o" type="number" step=".05" value="4.50"></div>
            <div class="modelrow"><div class="mlab"><span class="dot" style="background:#B3402F"></span>gpt-5.4</div><input class="num" id="m_a_i" type="number" step=".5" value="2.50"><input class="num" id="m_a_o" type="number" step=".5" value="15"></div>
          </div>
        </details>
      </div>

      <div id="q_out_pane"></div>
    </div>
  </div>

  <!-- ================= TAB 2: TAKİP ================= -->
  <div id="pane_t" class="hide">
    <div class="section">API hesabı & günlük bütçe</div>
    <div class="addrow">
      <div class="fld"><label>API hesabı (token kaynağı)</label><input class="name" style="width:230px" id="t_api" value="ÖzgürÖZEN — userAPI"></div>
      <div class="fld"><label>Günlük token bütçesi</label><input class="rms" id="t_budget" type="number" step="1" value="10"></div>
      <div class="fld"><span class="unit">M &nbsp;($100 ≈ 10M/gün)</span></div>
    </div>

    <div class="section">Bu API'den yararlanan oteller</div>
    <div class="addrow">
      <div class="fld"><label>Otel adı</label><input class="name" id="t_name" placeholder="Örn: Green Park Oteli"></div>
      <div class="fld"><label>Oda</label><input class="rms" id="t_rooms" type="number" step="10" placeholder="200"></div>
      <div class="fld"><label>Maks. kişi</label><input class="rms" id="t_cap" type="number" step="10" placeholder="500"></div>
      <button class="add" onclick="addHotel()">+ Ekle</button>
    </div>

    <div style="overflow-x:auto"><table id="t_table">
      <thead><tr>
        <th>#</th><th>Otel</th><th>Oda</th><th>Maks.<br>kişi</th><th>Token/ay (tahmini)</th><th>Supabase $</th><th>ManyChat $</th><th>AI maliyet $</th><th>Toplam gider $</th><th>Anlaşma $<br>(manuel)</th><th>Kâr $</th><th></th>
      </tr></thead>
      <tbody id="t_body"></tbody>
      <tfoot><tr id="t_foot"></tr></tfoot>
    </table></div>

    <div id="t_budgetbar"></div>

    <div class="tnote warn">📌 <b>Token değerleri şimdilik oda + kapasiteden tahmin.</b> Gerçek kullanım F1 paneliyle (<code>ai_usage_log</code>, otel-bazlı token) buraya bağlanacak — o zaman token kutusuna gerçek rakam gelir, AI maliyeti otomatik güncellenir. Token kutusunu elle değiştirirsen maliyet anında yeniden hesaplanır.</div>
    <div class="tnote"><b>Anlaşma ($):</b> her otelle anlaştığın aylık tutarı (KDV hariç) elle yaz → <b>Kâr</b> = Anlaşma − Toplam gider otomatik hesaplanır. Boş bırakırsan kâr "—" gösterir. Bu tablo <b>patron dashboard</b>'un şablonu: F1 gerçek tokenı + bu anlaşma/kâr sütunları canlı panele taşınacak.</div>
    <div class="tnote">Genel varsayımlar (doluluk, soru sayısı, model fiyatları) Teklif sekmesindeki ⚙️ ayarlardan gelir. Günlük toplam token 10M'ye yaklaşınca çubuk uyarır → ikinci $100 bütçesi planla.</div>
  </div>

  <div class="guide">
    <div class="t">📘 Nasıl çalışıyor?</div>
    <div class="gcards">
      <div class="gcard dark">
        <div class="k">Kapasite neden manuel?</div>
        <div class="v">Otellerin çoğunda aile odaları var → 3-4 kişilik. 249 odalı otel 650 kişi alabilir. "Oda×2 = 500 kişi" dersek eksik fiyat verip <b>zarar ederiz</b>. Bu yüzden maksimum kapasiteyi elle giriyoruz; misafir sayısı = kapasite × doluluk.</div>
      </div>
      <div class="gcard">
        <div class="k">Teklif mantığı</div>
        <div class="v">Kapasite → misafir → günlük soru → aylık token → <b>3-katman AI maliyeti</b> + Supabase + ManyChat. Sistem, marja göre teklifi <b>otomatik önerir</b> (maliyet ÷ (1−marj)). İstersen teklifi elle yükseltirsin → fark tamamen kâra yazar. Teklife <b>+%20 KDV</b> eklenip fatura tutarı gösterilir.</div>
      </div>
      <div class="gcard">
        <div class="k">10M bütçe takibi</div>
        <div class="v">$100 prepaid ≈ günlük 10M token. Takip tablosunda her otelin günlük tokenı toplanır; çubuk %100'e yaklaşınca <b>ikinci $100</b> (→20M) planlarsın. Böylece bütçeyi doldurmadan ne zaman ekleme gerektiğini görürsün.</div>
      </div>
      <div class="gcard">
        <div class="k">API hesabı & numaralandırma</div>
        <div class="v">Tablo tek bir API hesabına (örn. ÖzgürÖZEN userAPI) bağlı otelleri sıralı listeler. Her otel numaralı; kendi token + maliyeti görünür. F1 gerçek kullanımı bağlayınca bu tablo canlı panele döner.</div>
      </div>
    </div>
  </div>
</div>

<script>
// ---------- ortak durum ----------
const A = {
  occ:70, stay:7, qpd:6, inTok:1500, outTok:300, cache:70, req:1.5,
  s1:60, s2:30,
  m:{ s:{i:0.10,o:0.40}, m:{i:0.75,o:4.50}, a:{i:2.50,o:15} },
  supa:25, mc:29, budgetM:10
};
const Q = { rooms:200, cap:500, marg:80, kdv:20, override:null };
let HOTELS = [
  {name:'Örnek A Oteli', rooms:200, cap:460, supa:25, mc:29, tokenOverride:null, deal:800},
  {name:'Örnek B Oteli', rooms:150, cap:360, supa:25, mc:29, tokenOverride:null, deal:600}
];

const fUSD  = n => '$' + Math.round(n).toLocaleString('en-US');
const fUSD1 = n => '$' + n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const fNum  = n => Math.round(n).toLocaleString('en-US');
const fM    = n => (n/1e6).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'M';

const cacheMul = () => (1 - A.cache/100) + (A.cache/100)*0.1;

function perQuestion(){
  const s3 = Math.max(0, 100 - A.s1 - A.s2);
  const shares = [A.s1/100, A.s2/100, s3/100];
  const models = [A.m.s, A.m.m, A.m.a];
  let cost=0;
  models.forEach((mo,idx)=>{ cost += shares[idx]*((A.inTok/1e6)*mo.i*cacheMul() + (A.outTok/1e6)*mo.o); });
  return {perQ:cost, tokPerQ:A.inTok+A.outTok, s3};
}

// bir otelin aylık maliyeti — misafir sayısı KAPASİTEDEN
function hotelCost(rooms, cap, supa, mc){
  const occ = A.occ/100;
  const guests   = cap * occ;                     // anlık misafir (kapasite × doluluk)
  const occRooms = rooms * occ;                   // dolu oda (konaklama/ManyChat için)
  const qMonth   = guests * A.qpd * 30;
  const pq = perQuestion();
  const tokenCost = qMonth * pq.perQ;

  const stays = A.stay>0 ? occRooms*30/A.stay : 0;
  const reqs  = stays * A.req;
  const sumCost = reqs * ((A.inTok/1e6)*A.m.m.i + (A.outTok/1e6)*A.m.m.o);

  const aiCost = tokenCost + sumCost;
  const total  = aiCost + supa + mc;

  const tokensMonth = qMonth*pq.tokPerQ + reqs*(A.inTok+A.outTok);
  const perMillion  = tokensMonth>0 ? aiCost/(tokensMonth/1e6) : 0;
  return {guests,occRooms,qMonth,tokenCost,stays,reqs,sumCost,aiCost,total,tokensMonth,perMillion};
}

// ---------- TAB 1 ----------
function renderQuote(){
  const c = hotelCost(Q.rooms, Q.cap, A.supa, A.mc);
  const marginPrice = Math.ceil((Q.marg<100 ? c.total/(1 - Q.marg/100) : c.total)/10)*10;
  document.getElementById('q_s3').textContent = Math.max(0,100-A.s1-A.s2);
  document.getElementById('q_ppr').textContent = (Q.rooms>0 ? Q.cap/Q.rooms : 0).toFixed(1);

  const dayTok  = c.tokensMonth/30;
  const dayCost = c.aiCost/30;
  const offer0  = Q.override!=null ? Q.override : marginPrice;
  const aMarg0  = offer0>0 ? (1-c.total/offer0)*100 : 0;

  document.getElementById('q_out_pane').innerHTML =
    '<div class="money">'+
      '<div class="band b-offer"><div class="txt"><div class="lab">OTELE TEKLİFİMİZ · KDV HARİÇ</div><div class="sub" id="m_offer_sub">%'+Math.round(aMarg0)+' marj · bizim hizmet bedelimiz</div></div>'+
        '<div class="amt"><span id="m_offer">'+fUSD(offer0)+'</span><span class="u"> /ay</span></div></div>'+
      '<div class="band b-invoice"><div class="txt"><div class="lab">FATURA · OTEL BUNU ÖDER (KDV DAHİL)</div><div class="sub" id="m_kdvnote">teklif '+fUSD(offer0)+' + %'+Q.kdv+' KDV '+fUSD(offer0*Q.kdv/100)+'</div></div>'+
        '<div class="amt"><span id="m_invoice">'+fUSD(offer0*(1+Q.kdv/100))+'</span><span class="u"> /ay</span></div></div>'+
      '<div class="band b-profit"><div class="txt"><div class="lab">💰 NET KÂR · BİZE KALAN</div><div class="sub" id="m_profitnote">teklif '+fUSD(offer0)+' − maliyet '+fUSD1(c.total)+' · yıllık '+fUSD((offer0-c.total)*12)+'</div></div>'+
        '<div class="amt big"><span id="m_profit">'+fUSD(offer0-c.total)+'</span><span class="u"> /ay</span></div></div>'+
    '</div>'+

    '<div class="reverse">'+
      '<div class="lab">TEKLİFİ ELLE YÜKSELT (opsiyonel) — maliyet sabit, fark tamamen kâra yazar</div>'+
      '<div style="font-size:11px;color:#AEB8C4;margin-bottom:8px">Sistem %'+Q.marg+' marja göre <b style="color:#fff">'+fUSD(marginPrice)+'</b> önerdi. Elle artırırsan yukarıdaki <b style="color:#7BE0A8">net kâr</b> da artar. (Marjı/girdileri değiştirirsen otomatik yeniden hesaplanır.)</div>'+
      '<div class="row"><div><span style="font-size:12px;color:#CFD8E2">Teklif $/ay (KDV hariç)</span><br>'+
        '<input class="num" id="q_offer" type="number" step="10" value="'+offer0+'"></div>'+
        '<div style="text-align:right"><div class="res" id="rev_margin">—</div><div class="rlab">gerçek marj</div></div></div>'+
    '</div>'+

    '<div class="box">'+
      '<div style="font-size:10px;letter-spacing:1px;color:var(--slate);font-weight:700;padding:10px 0 2px">MALİYET DÖKÜMÜ (aylık)</div>'+
      '<div class="ln"><div class="l">Anlık misafir <span class="s">('+fNum(Q.cap)+' kapasite × %'+A.occ+')</span></div><div class="v">'+fNum(c.guests)+' kişi</div></div>'+
      '<div class="ln"><div class="l">Aylık misafir sorusu <span class="s">('+fNum(c.guests)+' × '+A.qpd+'/gün × 30)</span></div><div class="v">'+fNum(c.qMonth)+'</div></div>'+
      '<div class="ln"><div class="l">AI token maliyeti <span class="s">(3-katman, cache %'+A.cache+')</span></div><div class="v neg">'+fUSD1(c.tokenCost)+'</div></div>'+
      '<div class="ln"><div class="l">Departman özeti <span class="s">('+fNum(c.reqs)+' talep, orta katman)</span></div><div class="v neg">'+fUSD1(c.sumCost)+'</div></div>'+
      '<div class="ln"><div class="l">Supabase <span class="s">(otel instance)</span></div><div class="v neg">'+fUSD(A.supa)+'</div></div>'+
      '<div class="ln"><div class="l">ManyChat <span class="s">(otel contact)</span></div><div class="v neg">'+fUSD(A.mc)+'</div></div>'+
      '<div class="ln strong"><div class="l">Toplam aylık maliyet</div><div class="v">'+fUSD1(c.total)+'</div></div>'+
      '<div class="ln"><div class="l">Tahmini token / ay</div><div class="v">'+fM(c.tokensMonth)+'</div></div>'+
      '<div class="ln sub"><div class="l">Günlük ortalama <span class="s">(÷30)</span></div><div class="v"><b>'+fM(dayTok)+'</b> token · '+fUSD1(dayCost)+' /gün AI</div></div>'+
    '</div>';

  function updateOffer(){
    const offer   = Q.override!=null ? Q.override : marginPrice;
    const kdvAmt  = offer*Q.kdv/100;
    const invoice = offer + kdvAmt;
    const aMarg   = offer>0 ? (1-c.total/offer)*100 : 0;
    const profit  = offer - c.total;
    document.getElementById('m_offer').textContent     = fUSD(offer);
    document.getElementById('m_offer_sub').textContent = '%'+Math.round(aMarg)+' marj · bizim hizmet bedelimiz';
    document.getElementById('m_kdvnote').textContent   = 'teklif '+fUSD(offer)+' + %'+Q.kdv+' KDV '+fUSD(kdvAmt);
    document.getElementById('m_invoice').textContent   = fUSD(invoice);
    document.getElementById('m_profitnote').textContent= 'teklif '+fUSD(offer)+' − maliyet '+fUSD1(c.total)+' · yıllık '+fUSD(profit*12);
    document.getElementById('m_profit').textContent    = fUSD(profit);
    document.getElementById('rev_margin').textContent  = '%'+aMarg.toFixed(1);
    if(Q.override==null){ const oe=document.getElementById('q_offer'); if(oe && document.activeElement!==oe) oe.value=offer; }
  }
  document.getElementById('q_offer').addEventListener('input', e=>{
    Q.override = e.target.value===''?null:Number(e.target.value);
    updateOffer();
  });
  updateOffer();
}

// ---------- TAB 2 ----------
function rowVals(h){
  const c = hotelCost(h.rooms, h.cap, h.supa, h.mc);
  const tokens = h.tokenOverride!=null ? h.tokenOverride : c.tokensMonth;
  const aiCost = h.tokenOverride!=null ? (tokens/1e6)*c.perMillion : c.aiCost;
  const total  = aiCost + h.supa + h.mc;
  const deal   = h.deal!=null ? h.deal : 0;
  const profit = h.deal!=null ? h.deal - total : null;   // Anlaşma − Toplam gider
  return {c, tokens, aiCost, total, deal, profit};
}
function renderTrack(){
  const body = document.getElementById('t_body');
  body.innerHTML = '';
  let tRooms=0,tCap=0,tTok=0,tSupa=0,tMc=0,tAi=0,tTot=0,tDeal=0,tProfit=0;

  HOTELS.forEach((h,i)=>{
    const r = rowVals(h);
    tRooms+=h.rooms; tCap+=h.cap; tTok+=r.tokens; tSupa+=h.supa; tMc+=h.mc; tAi+=r.aiCost; tTot+=r.total;
    tDeal+=r.deal; if(r.profit!=null) tProfit+=r.profit;
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="hash">'+(i+1)+'</td>'+
      '<td class="otel"><input class="tname" value="'+h.name.replace(/"/g,'&quot;')+'" data-i="'+i+'" data-f="name"></td>'+
      '<td><input class="tinp" style="width:48px" type="number" value="'+h.rooms+'" data-i="'+i+'" data-f="rooms"></td>'+
      '<td><input class="tinp" style="width:52px" type="number" value="'+h.cap+'" data-i="'+i+'" data-f="cap"></td>'+
      '<td><input class="tinp" type="number" value="'+Math.round(r.tokens)+'" data-i="'+i+'" data-f="token" title="F1 gerçek rakamı buraya gelecek; elle de girebilirsin"><div class="dayline" id="day_'+i+'">Günlük: <b>'+fM(r.tokens/30)+'</b></div></td>'+
      '<td><input class="tinp" style="width:46px" type="number" value="'+h.supa+'" data-i="'+i+'" data-f="supa"></td>'+
      '<td><input class="tinp" style="width:46px" type="number" value="'+h.mc+'" data-i="'+i+'" data-f="mc"></td>'+
      '<td id="ai_'+i+'">'+fUSD1(r.aiCost)+'</td>'+
      '<td id="tot_'+i+'"><b>'+fUSD1(r.total)+'</b></td>'+
      '<td><input class="deal" type="number" value="'+(h.deal!=null?h.deal:'')+'" data-i="'+i+'" data-f="deal" placeholder="—" title="Bu otelle anlaştığın aylık tutar (KDV hariç)"></td>'+
      '<td class="kar'+(r.profit!=null&&r.profit<0?' neg':'')+'" id="kar_'+i+'">'+(r.profit!=null?'<b>'+fUSD1(r.profit)+'</b>':'—')+'</td>'+
      '<td><button class="del" onclick="removeHotel('+i+')" title="Sil">×</button></td>';
    body.appendChild(tr);
  });

  setFoot(tRooms,tCap,tTok,tSupa,tMc,tAi,tTot,tDeal,tProfit);
  renderBudget(tTok);

  body.querySelectorAll('input').forEach(inp=>{
    inp.addEventListener('input', e=>{
      const i=+e.target.dataset.i, f=e.target.dataset.f, v=e.target.value;
      if(f==='name'){ HOTELS[i].name=v; }
      else if(f==='rooms'){ HOTELS[i].rooms=Number(v)||0; HOTELS[i].tokenOverride=null; syncEstimate(i); recalcRow(i); recalcTotals(); }
      else if(f==='cap'){ HOTELS[i].cap=Number(v)||0; HOTELS[i].tokenOverride=null; syncEstimate(i); recalcRow(i); recalcTotals(); }
      else if(f==='token'){ HOTELS[i].tokenOverride = v===''?null:Number(v); recalcRow(i); recalcTotals(); }
      else if(f==='deal'){ HOTELS[i].deal = v===''?null:Number(v); recalcRow(i); recalcTotals(); }
      else { HOTELS[i][f]=Number(v)||0; recalcRow(i); recalcTotals(); }
    });
  });
}
function setFoot(tRooms,tCap,tTok,tSupa,tMc,tAi,tTot,tDeal,tProfit){
  document.getElementById('t_foot').innerHTML =
    '<td></td><td>TOPLAM ('+HOTELS.length+' otel)</td><td>'+fNum(tRooms)+'</td><td>'+fNum(tCap)+'</td>'+
    '<td>'+fM(tTok)+'<div class="dayline">Günlük: <b>'+fM(tTok/30)+'</b></div></td>'+
    '<td>'+fUSD(tSupa)+'</td><td>'+fUSD(tMc)+'</td><td>'+fUSD1(tAi)+'</td><td>'+fUSD1(tTot)+'</td>'+
    '<td>'+fUSD(tDeal)+'</td><td class="kar'+(tProfit<0?' neg':'')+'"><b>'+fUSD1(tProfit)+'</b></td><td></td>';
}
function recalcRow(i){
  const r = rowVals(HOTELS[i]);
  document.getElementById('ai_'+i).textContent = fUSD1(r.aiCost);
  document.getElementById('tot_'+i).innerHTML = '<b>'+fUSD1(r.total)+'</b>';
  const dl=document.getElementById('day_'+i); if(dl) dl.innerHTML = 'Günlük: <b>'+fM(r.tokens/30)+'</b>';
  const kr=document.getElementById('kar_'+i); if(kr){ kr.className='kar'+(r.profit!=null&&r.profit<0?' neg':''); kr.innerHTML = r.profit!=null?'<b>'+fUSD1(r.profit)+'</b>':'—'; }
}
function syncEstimate(i){
  const h=HOTELS[i]; if(h.tokenOverride!=null) return;
  const c=hotelCost(h.rooms,h.cap,h.supa,h.mc);
  const el=document.querySelector('input[data-i="'+i+'"][data-f="token"]'); if(el) el.value=Math.round(c.tokensMonth);
}
function recalcTotals(){
  let tRooms=0,tCap=0,tTok=0,tSupa=0,tMc=0,tAi=0,tTot=0,tDeal=0,tProfit=0;
  HOTELS.forEach(h=>{ const r=rowVals(h);
    tRooms+=h.rooms;tCap+=h.cap;tTok+=r.tokens;tSupa+=h.supa;tMc+=h.mc;tAi+=r.aiCost;tTot+=r.total;
    tDeal+=r.deal; if(r.profit!=null) tProfit+=r.profit; });
  setFoot(tRooms,tCap,tTok,tSupa,tMc,tAi,tTot,tDeal,tProfit);
  renderBudget(tTok);
}
function renderBudget(monthlyTokTotal){
  const budgetM = A.budgetM;
  const dailyTok = monthlyTokTotal/30;
  const budgetTok = budgetM*1e6;
  const pct = budgetTok>0 ? dailyTok/budgetTok*100 : 0;
  const over = pct>100;
  const remainingM = (budgetTok-dailyTok)/1e6;
  const api = document.getElementById('t_api') ? document.getElementById('t_api').value : 'API';
  let note;
  if(over){
    const mult = Math.ceil(dailyTok/budgetTok);
    note='<div class="bnote warn">⚠️ Günlük bütçe aşıldı (%'+pct.toFixed(0)+'). İkinci $100 yükle (→'+(budgetM*2)+'M) veya oda/otel azalt. Şu an ~'+mult+'× bütçe gerekiyor.</div>';
  } else {
    note='<div class="bnote">Boşta kalan: <b>'+remainingM.toFixed(2)+'M/gün</b>. Yeni otel eklendikçe buradan izle — %100\\'e yaklaşınca ikinci $100 bütçesi planla.</div>';
  }
  document.getElementById('t_budgetbar').innerHTML =
    '<div class="budget"><div class="bhead"><span>'+api+' · günlük token bütçesi doluluğu</span>'+
    '<span class="r">'+fM(dailyTok)+' / '+budgetM.toFixed(2)+'M &nbsp;('+pct.toFixed(0)+'%)</span></div>'+
    '<div class="track"><div class="fill'+(over?' over':'')+'" style="width:'+Math.min(100,pct)+'%"></div></div>'+note+'</div>';
}
function addHotel(){
  const name=document.getElementById('t_name').value.trim()||('Otel '+(HOTELS.length+1));
  const rooms=Number(document.getElementById('t_rooms').value)||150;
  const cap=Number(document.getElementById('t_cap').value)|| Math.round(rooms*2.5);
  HOTELS.push({name,rooms,cap,supa:A.supa,mc:A.mc,tokenOverride:null,deal:null});
  document.getElementById('t_name').value=''; document.getElementById('t_rooms').value=''; document.getElementById('t_cap').value='';
  renderTrack();
}
function removeHotel(i){ HOTELS.splice(i,1); renderTrack(); }

// ---------- tab switch ----------
function switchTab(t){
  document.getElementById('pane_q').classList.toggle('hide', t!=='q');
  document.getElementById('pane_t').classList.toggle('hide', t!=='t');
  document.getElementById('tab_q').classList.toggle('on', t==='q');
  document.getElementById('tab_t').classList.toggle('on', t==='t');
  if(t==='t') renderTrack();
}

// ---------- wiring TAB 1 ----------
function bindNum(id, obj, key){ const el=document.getElementById(id); if(!el)return;
  el.addEventListener('input',e=>{ obj[key]=Number(e.target.value)||0; Q.override=null; renderQuote(); if(!document.getElementById('pane_t').classList.contains('hide')) renderTrack(); }); }

const qr=document.getElementById('q_rooms'), qrr=document.getElementById('q_rooms_r');
const setRooms=v=>{ Q.rooms=Number(v)||0; Q.override=null; qr.value=v; qrr.value=Math.min(800,Math.max(20,v)); renderQuote(); };
qr.addEventListener('input',e=>setRooms(e.target.value)); qrr.addEventListener('input',e=>setRooms(e.target.value));

document.querySelectorAll('#q_occ_seg button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#q_occ_seg button').forEach(x=>x.classList.remove('on')); b.classList.add('on');
  A.occ=Number(b.dataset.v); Q.override=null; renderQuote(); if(!document.getElementById('pane_t').classList.contains('hide')) renderTrack(); });
document.querySelectorAll('#q_marg_seg button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#q_marg_seg button').forEach(x=>x.classList.remove('on')); b.classList.add('on');
  Q.marg=Number(b.dataset.v); Q.override=null; document.getElementById('q_marg').value=Q.marg; renderQuote(); });
document.getElementById('q_marg').addEventListener('input',e=>{ Q.marg=Number(e.target.value)||0; Q.override=null;
  document.querySelectorAll('#q_marg_seg button').forEach(x=>x.classList.remove('on')); renderQuote(); });
document.getElementById('q_kdv').addEventListener('input',e=>{ Q.kdv=Number(e.target.value)||0; renderQuote(); });

bindNum('q_cap',Q,'cap'); bindNum('q_stay',A,'stay');
bindNum('q_supa',A,'supa'); bindNum('q_mc',A,'mc');
bindNum('q_qpd',A,'qpd'); bindNum('q_in',A,'inTok'); bindNum('q_out',A,'outTok');
bindNum('q_cache',A,'cache'); bindNum('q_req',A,'req');
bindNum('q_s1',A,'s1'); bindNum('q_s2',A,'s2');
bindNum('m_s_i',A.m.s,'i'); bindNum('m_s_o',A.m.s,'o');
bindNum('m_m_i',A.m.m,'i'); bindNum('m_m_o',A.m.m,'o');
bindNum('m_a_i',A.m.a,'i'); bindNum('m_a_o',A.m.a,'o');

document.getElementById('t_budget').addEventListener('input',e=>{ A.budgetM=Number(e.target.value)||0; recalcTotals(); });
document.getElementById('t_api').addEventListener('input',()=>recalcTotals());

renderQuote();
<\/script>
</body>
</html>
`;
