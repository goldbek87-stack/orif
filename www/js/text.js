/* ORIF DAFTARI — o'zbekcha matn bilan ishlash (internetsiz ishlaydi) */
(function (root) {
  'use strict';

  const NUM = { 'bir': 1, 'ikki': 2, 'uch': 3, "to'rt": 4, 'tort': 4, 'besh': 5, 'olti': 6, 'yetti': 7, 'sakkiz': 8,
    "to'qqiz": 9, 'toqqiz': 9, "o'n": 10, 'on': 10, 'yigirma': 20, "o'ttiz": 30, 'ottiz': 30, 'qirq': 40, 'ellik': 50,
    'oltmish': 60, 'yetmish': 70, 'sakson': 80, "to'qson": 90, 'toqson': 90 };
  const MULT = { 'ming': 1e3, 'million': 1e6, 'mln': 1e6, 'milliard': 1e9 };

  function norm(t) {
    return String(t || '').toLowerCase().replace(/[ʻʼ‘’`´]/g, "'").replace(/\s+/g, ' ').trim();
  }
  function wordNum(tok) {
    const t = tok.replace(/[.,!?;:]+$/, '');
    if (/^\d+([.,]\d+)?$/.test(t)) return { k: 'n', v: parseFloat(t.replace(',', '.')) };
    if (t === 'yuz') return { k: 'h' };
    if (t === 'yarim') return { k: 'half' };
    if (MULT[t]) return { k: 'm', v: MULT[t] };
    if (NUM[t] !== undefined) return { k: 'n', v: NUM[t] };
    for (const suf of ['ta', 'lik', 'dan', 'ga']) {
      if (t.length > suf.length && t.endsWith(suf)) {
        const st = t.slice(0, -suf.length);
        const r = st === 'yuz' ? { k: 'h' } : MULT[st] ? { k: 'm', v: MULT[st] } : NUM[st] !== undefined ? { k: 'n', v: NUM[st] } :
          /^\d+$/.test(st) ? { k: 'n', v: +st } : null;
        if (r) { r.suf = suf; return r; }
      }
    }
    return null;
  }
  // "ellik ming besh yuz" -> "50500", "o'n dona" -> "10 dona", "ikki yuz grammlik" -> "200 grammlik"
  function wordsToDigits(text) {
    const toks = norm(text).replace(/(\d)\s+(?=\d{3}\b)/g, '$1').split(' ');
    const out = [];
    let i = 0;
    while (i < toks.length) {
      if (!wordNum(toks[i])) { out.push(toks[i]); i++; continue; }
      let total = 0, cur = 0, last = 0, suf = '', trail = '';
      while (i < toks.length) {
        const w = wordNum(toks[i]); if (!w) break;
        if (w.k === 'n' && last && cur === 0 && total && w.v >= last) break;
        if (w.k === 'n') cur += w.v;
        else if (w.k === 'h') cur = (cur || 1) * 100;
        else if (w.k === 'half') { if (!cur && last) total += last / 2; else cur += 0.5; }
        else { total += (cur || 1) * w.v; cur = 0; last = w.v; }
        const m = toks[i].match(/[.,!?;:]+$/); trail = m ? m[0] : '';
        i++;
        if (w.suf) { suf = w.suf; break; }
        if (trail) break;
      }
      const v = total + cur;
      out.push(String(Math.round(v * 1000) / 1000) + (suf === 'ta' ? ' ta' : suf) + trail);
    }
    return out.join(' ');
  }

  /* ---------- Lokal imlo tuzatish ---------- */
  const DICT = {
    'narhi': 'narxi', 'narh': 'narx', 'narhini': 'narxini', 'narhlar': 'narxlar', 'qimat': 'qimmat', 'qimmad': 'qimmat',
    'funchiza': 'funchoza', 'funchize': 'funchoza', 'funcoza': 'funchoza', 'funchoz': 'funchoza',
    'sorayapdi': "so'rayapti", 'sorayapti': "so'rayapti", 'soradi': "so'radi", 'sorayabdi': "so'rayapti", 'sorab': "so'rab",
    'yetkazip': 'yetkazib', 'etkazib': 'yetkazib', 'etkazip': 'yetkazib', 'yetkazish': 'yetkazish',
    'xamma': 'hamma', 'hamasi': 'hammasi', 'xammasi': 'hammasi', 'hozr': 'hozir', 'xozir': 'hozir',
    'yahshi': 'yaxshi', 'yaxwi': 'yaxshi', 'yaxshy': 'yaxshi', 'tavar': 'tovar', 'tovarlar': 'tovarlar',
    'dokon': "do'kon", 'dukon': "do'kon", "dukon'": "do'kon", 'dokonga': "do'konga", 'dokonda': "do'konda",
    'tolov': "to'lov", 'toladi': "to'ladi", 'tolamadi': "to'lamadi", 'bulsa': "bo'lsa", 'buldi': "bo'ldi", 'boldi': "bo'ldi",
    'kop': "ko'p", 'koproq': "ko'proq", 'keyn': 'keyin', 'kiyin': 'keyin', 'rakobatchi': 'raqobatchi', 'raqobatchi': 'raqobatchi',
    'sfat': 'sifat', 'sifati': 'sifati', 'qadok': 'qadoq', 'qadogi': "qadog'i", 'nasya': 'nasiya', 'mamun': 'mamnun',
    'maxsulot': 'mahsulot', 'mahsulod': 'mahsulot', 'maxsulod': 'mahsulot', 'tugagn': 'tugagan', 'tugadi': 'tugadi',
    'kechikdi': 'kechikdi', 'kechikti': 'kechikdi', 'reklama': 'reklama', 'arzn': 'arzon', 'arzonroq': 'arzonroq',
    'olmadi': 'olmadi', 'oldi': 'oldi', 'bervoring': 'berib yuboring', 'kere': 'kerak', 'kerek': 'kerak', 'kerakmas': 'kerak emas',
    'yoq': "yo'q", 'yok': "yo'q", 'bor': 'bor', 'sotuv': 'sotuv', 'sotilyapdi': 'sotilyapti', 'sotilmayapdi': 'sotilmayapti',
    'shikoyad': 'shikoyat', 'shikoyati': 'shikoyati', 'tushuring': 'tushiring', 'tushrin': 'tushiring', 'tushuriw': 'tushirish',
    'ertag': 'ertaga', 'indinga': 'indinga', 'hafta': 'hafta', 'xafta': 'hafta', 'yangi': 'yangi', 'yngi': 'yangi'
  };
  const KEEP_IP = new Set(['tip', 'klip', 'chip', 'shtip']);
  function fixWord(w) {
    const m = w.match(/^([^a-z'0-9]*)([a-z'0-9]+)([^a-z'0-9]*)$/i);
    if (!m) return w;
    let [, pre, core, post] = m;
    const low = core.toLowerCase();
    let r = DICT[low];
    if (!r) {
      r = low;
      if (/[bcdfghjklmnpqrstvxz]ip$/.test(r) && r.length >= 5 && !KEEP_IP.has(r)) r = r.slice(0, -2) + 'ib'; // yetkazip -> yetkazib
      r = r.replace(/yapdi$/, 'yapti').replace(/yabdi$/, 'yapti').replace(/yapmiz$/, 'yapmiz');
    }
    if (r === low) r = core; // o'zgarmagan bo'lsa asl yozilishi (katta harf) saqlanadi
    return pre + r + post;
  }
  function localFix(text) {
    if (!text) return '';
    let t = String(text).replace(/[ʻʼ‘’`´]/g, "'");
    t = t.replace(/(\d+)\s*(gr|g|gramm|gram)\s*'?\s*lik\b/gi, '$1 grammlik');
    t = t.replace(/(\d+)\s*(gr|gram)\b\.?/gi, '$1 g');
    t = t.replace(/(\d+)\s*kg\s*'?\s*lik\b/gi, '$1 kilogrammlik');
    t = t.replace(/\s+([,.!?])/g, '$1').replace(/([,.!?])(?=[^\s\d])/g, '$1 ');
    t = t.split(/(\s+)/).map(p => /\s/.test(p) ? p : fixWord(p)).join('');
    t = t.replace(/\s+/g, ' ').trim();
    // gap boshini katta harf bilan boshlash
    t = t.replace(/(^|[.!?]\s+)([a-z])/g, (a, b, c) => b + c.toUpperCase());
    if (t && !/[.!?]$/.test(t)) t += '.';
    return t;
  }

  /* ---------- Sana so'zlari ---------- */
  const WD = { 'dushanba': 1, 'seshanba': 2, 'chorshanba': 3, 'payshanba': 4, 'juma': 5, 'shanba': 6, 'yakshanba': 0 };
  function isoAdd(iso, n) { const [y, m, d] = iso.split('-').map(Number); const t = new Date(y, m - 1, d + n); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); }
  function dow(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getDay(); }
  function visitDate(text, today) {
    const t = norm(text);
    let m;
    if (/\bertaga\b/.test(t)) return { date: isoAdd(today, 1), label: 'ertaga' };
    if (/\bindinga\b/.test(t)) return { date: isoAdd(today, 2), label: 'indinga' };
    if ((m = t.match(/(\d+)\s*kun(dan)?\s*(keyin|so'ng)/))) return { date: isoAdd(today, +m[1]), label: m[1] + ' kundan keyin' };
    if (/(keyingi|kelasi|kelgusi) hafta|haftaga/.test(t)) { const k = (8 - dow(today)) % 7 || 7; return { date: isoAdd(today, k), label: 'keyingi hafta' }; }
    if ((m = t.match(/(\d+)\s*haftadan\s*keyin/))) return { date: isoAdd(today, 7 * +m[1]), label: m[1] + ' haftadan keyin' };
    for (const w in WD) if (new RegExp('\\b' + w + '(ga|da)?\\b').test(t)) {
      let k = (WD[w] - dow(today) + 7) % 7; if (k === 0) k = 7;
      return { date: isoAdd(today, k), label: w };
    }
    return null;
  }

  /* ---------- Nomlarni taxminiy moslash ---------- */
  function lev(a, b) {
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  const clean = (s) => norm(s).replace(/[^a-z0-9'а-яё ]/g, ' ').replace(/\s+/g, ' ').trim();
  function wordMatch(tok, w) {
    if (!tok || !w) return false;
    if (tok === w || tok.startsWith(w)) return true;
    if (w.length >= 4 && tok.length >= 4 && lev(tok.slice(0, w.length), w) <= (w.length >= 7 ? 2 : 1)) return true;
    return false;
  }
  // matn ichidan do'konni topish (eng uzun moslik)
  function findShop(text, shops) {
    const toks = clean(text).split(' ');
    let best = null;
    for (const s of shops) {
      const nt = clean(s.name).split(' ').filter(Boolean);
      if (!nt.length) continue;
      for (let i = 0; i + nt.length <= toks.length; i++) {
        let ok = true;
        for (let j = 0; j < nt.length; j++) if (!wordMatch(toks[i + j], nt[j])) { ok = false; break; }
        if (ok && (!best || nt.length > best.len)) best = { shop: s, len: nt.length, index: i };
      }
    }
    return best;
  }
  // matn bo'lagidan mahsulotni topish; og'irlik (200 g) bo'lsa aynan shunisi tanlanadi
  function findProduct(text, products) {
    const toks = clean(text).split(' ');
    const weight = (norm(text).match(/(\d+)\s*(g|gr|gramm|grammlik)\b/) || [])[1];
    const cands = [];
    for (const p of products) {
      if (p.active === false) continue;
      const first = clean(p.name).split(' ')[0];
      if (!first || first.length < 3) continue;
      if (toks.some(t => wordMatch(t, first) || (first.length >= 5 && wordMatch(t, first.slice(0, 5))))) cands.push(p);
    }
    if (!cands.length) return null;
    if (weight) { const w = cands.find(p => new RegExp('\\b' + weight + '\\s*g').test(norm(p.name))); if (w) return w; }
    return cands[0];
  }

  /* ---------- Ovozli gapni tahlil qilish ----------
     "Aziz Market o'n dona Sharq oldi, narxini ellik ming besh yuz qilib qo'y, ikki yuz grammlik funchoza so'radi,
      raqobatchi ikki ming arzon ekan, keyingi hafta yana kiraman." */
  function parseVoice(text, shops, products, today) {
    const res = { raw: text, shop: null, lines: [], demands: [], competitor: '', nextVisit: null, notes: [], tags: [] };
    const digits = wordsToDigits(text);
    const sh = findShop(digits, shops || []);
    if (sh) res.shop = sh.shop;
    const parts = digits.split(/[,.;!?]+|\s+va\s+|\s+keyin\s+/).map(s => s.trim()).filter(Boolean);
    let lastLine = null;
    for (const part of parts) {
      const nv = visitDate(part, today);
      if (nv && /(kir|kel|bor|tashrif|uchrash)/.test(part)) { res.nextVisit = nv; continue; }
      if (/raqobatchi|konkurent/.test(part)) {
        const m = part.match(/(\d[\d.]*)\s*(so'm|sum)?\s*(arzon|qimmat)/);
        res.competitor = m ? 'Raqobatchi ' + fmt(+m[1]) + " so'm " + m[3] : cap(part);
        if (/arzon/.test(part)) res.tags.push('raqobatchi_arzon');
        continue;
      }
      if (/so'ra|sora|istadi|kerak|talab/.test(part)) {
        let d = part.replace(/\b(so'radi|so'rayapti|so'ramoqda|soradi|sorayapti|istadi|kerak ekan|kerak|talab qildi)\b/g, '').trim();
        if (sh) d = d.replace(new RegExp(clean(sh.shop.name), 'i'), '').trim();
        d = d.replace(/(\d+)\s*grammlik/, '$1 grammlik');
        if (d) res.demands.push(cap(d));
        const p = findProduct(part, products || []); if (p && !res.tags.includes('yangi_mahsulot')) res.tags.push('yangi_mahsulot');
        continue;
      }
      if (/narx/.test(part)) {
        const m = part.match(/(\d[\d.]*)/);
        if (m && lastLine) { lastLine.price = Math.round(+m[1]); continue; }
        if (/qimmat|baland/.test(part)) { res.tags.push('narx_qimmat'); res.notes.push(cap(part)); continue; }
      }
      const p = findProduct(part, products || []);
      if (p) {
        const q = part.match(/(\d+(?:\.\d+)?)\s*(dona|ta|blok|quti|karobka|kg|kilo|pachka|qop)?/);
        const qty = q ? +q[1] : 1;
        const pm = part.match(/(\d{3,})\s*(so'm|sum)?\s*(dan|narx)/);
        lastLine = { productId: p.id, name: p.name, qty, price: pm ? +pm[1] : null };
        res.lines.push(lastLine);
        continue;
      }
      if (part.length > 3 && !(sh && clean(part) === clean(sh.shop.name))) res.notes.push(cap(part));
    }
    return res;
  }
  function cap(s) { s = String(s || '').trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; }
  function fmt(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

  /* ---------- Tezkor tugmalar va fikrlarni guruhlash ---------- */
  const QUICK = [
    { id: 'narx_qimmat', label: 'Narx qimmat', group: 'narx' },
    { id: 'raqobatchi_arzon', label: 'Raqobatchi arzon', group: 'narx' },
    { id: 'tugagan', label: 'Mahsulot tugagan', group: 'talab' },
    { id: 'yangi_mahsulot', label: "Yangi mahsulot so'radi", group: 'talab' },
    { id: 'kichik_qadoq', label: "Kichik qadoq so'radi", group: 'talab' },
    { id: 'katta_qadoq', label: "Katta qadoq so'radi", group: 'talab' },
    { id: 'sifat', label: 'Sifatga shikoyat', group: 'sifat' },
    { id: 'qadoq', label: 'Qadoqqa shikoyat', group: 'sifat' },
    { id: 'kechikdi', label: 'Yetkazish kechikdi', group: 'yetkazish' },
    { id: 'reklama', label: "Reklama so'radi", group: 'marketing' },
    { id: 'nasiya', label: "Nasiya so'radi", group: 'nasiya' },
    { id: 'sotuv_yaxshi', label: 'Sotuv yaxshi', group: 'ijobiy' },
    { id: 'sotuv_sust', label: 'Sotuv sust', group: 'sust' },
    { id: 'mamnun', label: 'Mamnun', group: 'ijobiy' },
    { id: 'keyinroq', label: 'Keyinroq keling', group: 'tashrif' }
  ];
  const GROUPS = {
    narx: { title: "Narx bo'yicha e'tiroz", re: /narx|qimmat|baland|arzon|tushir|chegirma|skidka/ },
    talab: { title: 'Mahsulot talablari', re: /so'ra|sora|kerak|tugagan|tugadi|yangi mahsulot|qadoq so'ra|istadi|yo'q ekan/ },
    sifat: { title: 'Sifat va qadoq shikoyatlari', re: /sifat|buzil|yirtil|qadoq(qa)? shikoyat|muddati|mazasi|sinib/ },
    yetkazish: { title: 'Yetkazib berish muammolari', re: /yetkaz|kechik|kelmadi|olib kelmadi|dostavka/ },
    marketing: { title: "Reklama so'rovlari", re: /reklama|banner|plakat|aksiya/ },
    nasiya: { title: "Nasiya so'rovlari", re: /nasiya|qarzga|keyin to'lay/ },
    sust: { title: 'Sotuv sust', re: /sust|sotilmayapti|yurmayapti/ },
    ijobiy: { title: 'Ijobiy fikrlar', re: /mamnun|yaxshi sotil|sotuv yaxshi|rahmat|zo'r/ },
    tashrif: { title: 'Keyinroq kelish', re: /keyinroq|boshqa kun|vaqti yo'q/ }
  };
  function noteTexts(n) {
    return ['fikr', 'shikoyat', 'qoshimcha', 'tavsiya'].map(k => n[k] && n[k].text).filter(Boolean);
  }
  // bugungi fikrlarni guruhlarga ajratish; bir xil fikrlar birlashtiriladi
  function groupNotes(notes, shopName) {
    const groups = {};
    const add = (g, shopId, text) => {
      const G = groups[g] || (groups[g] = { id: g, title: GROUPS[g].title, count: 0, items: [], shops: new Set(), seen: new Set() });
      const key = clean(text);
      G.shops.add(shopId);
      if (G.seen.has(shopId + '|' + key)) return;
      G.seen.add(shopId + '|' + key); G.count++;
      G.items.push({ shopId, shop: shopName ? shopName(shopId) : shopId, text });
    };
    for (const n of notes) {
      for (const t of n.tags || []) { const q = QUICK.find(x => x.id === t); if (q) add(q.group, n.shopId, q.label); }
      for (const txt of noteTexts(n)) {
        const t = norm(txt);
        for (const g in GROUPS) if (GROUPS[g].re.test(t)) add(g, n.shopId, txt);
      }
    }
    return Object.values(groups).map(g => ({ id: g.id, title: g.title, count: g.count, shopCount: g.shops.size, items: g.items }))
      .sort((a, b) => b.shopCount - a.shopCount || b.count - a.count);
  }

  const api = { norm, wordsToDigits, localFix, visitDate, findShop, findProduct, parseVoice, groupNotes, QUICK, GROUPS, lev, isoAdd };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TextUz = api;
})(this);
