/* ORIF DAFTARI — ekranlar va foydalanuvchi amallari */
(function () {
'use strict';

/* ================= yordamchilar ================= */
const $ = (id) => document.getElementById(id);
const h = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const F = (n) => Calc.fmt(n);
const I = (v) => Calc.toInt(v);
const pad = (n) => String(n).padStart(2, '0');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function today() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function nowHM() { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
const addDays = (iso, n) => TextUz.isoAdd(iso, n);
const dS = (iso) => iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '—';
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
function dL(iso) {
  if (!iso) return '—';
  if (iso === today()) return 'Bugun'; if (iso === addDays(today(), -1)) return 'Kecha'; if (iso === addDays(today(), 1)) return 'Ertaga';
  return +iso.slice(8, 10) + '-' + MONTHS[+iso.slice(5, 7) - 1] + (iso.slice(0, 4) !== today().slice(0, 4) ? ' ' + iso.slice(0, 4) : '');
}
function toast(msg, ms) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), ms || 2800); }
async function busy(msg, fn) {
  const b = document.createElement('div'); b.className = 'busy'; b.textContent = msg; document.body.appendChild(b);
  try { return await fn(); } finally { b.remove(); }
}
const money = (id, v, ph) => '<input class="inp num money" inputmode="numeric" id="' + id + '" value="' + (I(v) ? F(v) : '') + '" placeholder="' + (ph || '0') + '">';
const val = (id) => { const e = $(id); return e ? e.value : ''; };
const mval = (id) => I(val(id));
function debtHTML(b, big) {
  const l = Calc.debtLabel(b);
  const cls = l.kind === 'qarz' ? 'red' : l.kind === 'avans' ? 'ok' : 'muted';
  return '<span class="num ' + cls + '"' + (big ? ' style="font-weight:800"' : '') + '>' + (l.kind === 'avans' ? 'Avans ' : '') + F(l.amount) + '</span>';
}

/* ================= ma'lumotlar ================= */
let D = null;
function save() { Store.save(D); }
const shop = (id) => D.shops.find(s => s.id === id);
const product = (id) => D.products.find(p => p.id === id);
const shopName = (id) => (shop(id) || {}).name || "O'chirilgan do'kon";
const bal = (id) => Calc.shopBalance(D, id);
function addVisit(shopId, date) {
  date = date || today();
  if (!shopId || D.visits.some(v => v.shopId === shopId && v.date === date)) return;
  D.visits.push({ id: uid(), shopId, date, time: nowHM() });
}
function shopDates(id) {
  const last = (arr) => arr.filter(x => x.shopId === id).map(x => x.date + ' ' + (x.time || '')).sort().pop() || '';
  const lo = last(D.orders.filter(o => o.status !== 'bekor')), lp = last(D.payments);
  const lv = [lo, lp, last(D.notes), last(D.visits), last(D.returns)].sort().pop() || '';
  return { lastOrder: lo, lastPay: lp, lastVisit: lv };
}
// mahsulot qoldig'ini o'zgartirish (sign: -1 sotildi, +1 qaytdi)
function applyStock(lines, sign) {
  for (const l of lines || []) {
    const p = product(l.productId);
    if (p && p.stock !== '' && p.stock != null) p.stock = (Calc.qtyMilli(p.stock) + sign * Calc.qtyMilli(l.qty)) / 1000;
  }
}
// buyurtmadan oldingi qarz: shu buyurtma va unga bog'liq yozuvlarsiz, buyurtma vaqtigacha
function prevDebtFor(shopId, orderId, k) {
  const view = { shops: D.shops, orders: D.orders.filter(o => o.id !== orderId), payments: D.payments.filter(p => p.orderId !== orderId || !orderId),
    returns: D.returns.filter(r => r.orderId !== orderId || !orderId) };
  return Calc.shopBalance(view, shopId, k);
}
function logVoice(text, context) { D.voiceLogs.push({ id: uid(), date: today(), time: nowHM(), text, context }); if (D.voiceLogs.length > 1000) D.voiceLogs.shift(); save(); }

/* ================= navigatsiya ================= */
let stack = [{ p: 'home', params: {} }], tab = 'home', pendingTab = null, modalOpen = false;
const top = () => stack[stack.length - 1];
function go(p, params) { stack.push({ p, params: params || {} }); history.pushState({ n: stack.length }, ''); render(true); }
function back() { history.back(); }
function replace(p, params) { stack[stack.length - 1] = { p, params: params || {} }; render(true); }
window.addEventListener('popstate', (e) => {
  if (modalOpen) { closeModal(true); if ((e.state && e.state.n) === stack.length) return; }
  const n = Math.max(1, (e.state && e.state.n) || 1);
  while (stack.length > n) stack.pop();
  if (pendingTab) { tab = pendingTab; pendingTab = null; stack = [{ p: tab, params: {} }]; }
  render(true);
});
function setTab(t) {
  if (modalOpen) closeModal();
  if (stack.length > 1) { pendingTab = t; history.go(-(stack.length - 1)); }
  else { tab = t; stack = [{ p: t, params: {} }]; render(true); }
}
function openModal(html) {
  $('modal').innerHTML = '<div class="modal" data-a="modalBg"><div class="sheet">' + html + '</div></div>';
  if (!modalOpen) { modalOpen = true; history.pushState({ n: stack.length, m: 1 }, ''); }
}
function closeModal(fromPop) {
  if (!modalOpen) return;
  modalOpen = false; $('modal').innerHTML = '';
  if (!fromPop) history.back();
}
function render(scrollTop) {
  const st = top();
  const out = PAGES[st.p](st.params, st) || {};
  $('title').textContent = out.title || 'ORIF BLaknoti';
  $('back').classList.toggle('hidden', stack.length < 2);
  $('content').innerHTML = out.html || '';
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  if (scrollTop) window.scrollTo(0, 0);
  if (out.after) out.after();
  loadPhotos();
}
function refresh() { const y = window.scrollY; render(false); window.scrollTo(0, y); }
async function loadPhotos() {
  for (const img of document.querySelectorAll('img[data-photo]')) {
    const src = await Store.getPhoto(img.dataset.photo); if (src) img.src = src; else img.remove();
  }
}
function netBadge() { const on = Svc.online(); $('net').textContent = on ? 'online' : 'offline'; $('net').classList.toggle('off', !on); }
window.addEventListener('online', netBadge); window.addEventListener('offline', netBadge);

/* ================= matn maydoni: mikrofon + imlo tuzatish ================= */
function tfState(F0, key) { F0.t = F0.t || {}; return F0.t[key] || (F0.t[key] = { text: '', original: '', fixed: false }); }
function tf(F0, key, label, rows) {
  const s = tfState(F0, key);
  return '<div class="field"><label>' + h(label) + '</label>' +
    '<textarea class="inp" rows="' + (rows || 3) + '" data-tf="' + key + '" placeholder="Yozing yoki 🎤 bosib gapiring">' + h(s.text) + '</textarea>' +
    '<div class="tfbar"><button class="btn soft sm" data-a="tfMic" data-k="' + key + '">🎤 Gapirish</button>' +
    '<button class="btn soft sm" data-a="tfFix" data-k="' + key + '">✍️ Imloni tuzatish</button></div>' +
    (s.fixed && s.original !== s.text ? '<div class="small muted" style="margin-top:4px">Asl matn saqlangan</div>' : '') + '</div>';
}
function curF() { return top().params.F; }
function tfVal(F0, key) { const s = tfState(F0, key); const text = s.text.trim(); return text ? { text, original: (s.original || s.text).trim() } : null; }
let FX = null;
function fixModal() {
  openModal('<h2>Matnni to\'g\'rilash</h2>' +
    '<div class="field"><label>Asl matn</label><div class="card small" style="margin:0">' + h(FX.original || '—') + '</div></div>' +
    '<div class="field"><label>To\'g\'rilangan matn (tahrir qilish mumkin)</label><textarea class="inp" rows="5" id="fxText">' + h(FX.corrected) + '</textarea></div>' +
    '<div class="btns" style="margin-bottom:10px"><button class="btn soft" data-a="fxLocal">Lokal tuzatish</button><button class="btn soft" data-a="fxAI">AI bilan to\'g\'rilash</button></div>' +
    '<div class="btns"><button class="btn sec" data-a="fxRevert">Asl matnga qaytish</button><button class="btn" data-a="fxOk">Tasdiqlash</button></div>');
}

/* ================= SAHIFALAR ================= */
const PAGES = {};

/* ---------- Bosh sahifa ---------- */
PAGES.home = () => {
  const t = today(), r = Calc.dailyReport(D, t), tot = Calc.totalsAll(D);
  const visitedToday = new Set(D.visits.filter(v => v.date === t).map(v => v.shopId));
  const due = D.shops.filter(s => s.nextVisit && !visitedToday.has(s.id)).sort((a, b) => a.nextVisit.localeCompare(b.nextVisit));
  const next = due.find(s => s.nextVisit >= t) || due[0];
  const groups = TextUz.groupNotes(D.notes.filter(n => n.date === t), shopName);
  const sum = D.summaries.find(s => s.date === t);
  let xulosa = r.shopCount ? 'Bugun ' + r.shopCount + " ta do'konga kirildi, " + r.orderCount + ' ta buyurtma ' + F(r.sales) + " so'mga yozildi, " + F(r.payments) + " so'm to'lov olindi." : "Bugun hali hech bir do'konga kirilmagan.";
  if (groups[0]) xulosa += " Eng ko'p uchragan: " + groups[0].title.toLowerCase() + ' (' + groups[0].shopCount + " do'kon).";
  return {
    title: 'Salom, ' + (D.settings.userName || 'Orif'),
    html:
      '<button class="bigmic" data-a="voiceMain"><span class="m">🎤</span><span><b>Ovoz bilan yozish</b><span>"Aziz Market o\'n dona Sharq oldi..."</span></span></button>' +
      '<div class="stats">' +
      stat('Jami qarzdorlik', F(tot.debt), 'hero wide', tot.avans ? 'Avanslar: ' + F(tot.avans) : '') +
      stat("Bugun aylangan do'konlar", r.shopCount) + stat('Buyurtma summasi', F(r.sales)) +
      stat("Bugungi to'lovlar", F(r.payments), '', '', 'ok') + stat('Bugungi yangi qarz', F(r.newDebt), '', '', r.newDebt ? 'red' : '') +
      stat('Bugungi shikoyatlar', r.complaints, '', '', r.complaints ? 'warn' : '') + stat("Yangi do'konlar", r.newShops) +
      '</div>' +
      (next ? '<div class="card"><h3>Keyingi kiriladigan do\'kon</h3><button class="item" style="padding:0" data-a="openShop" data-id="' + next.id + '">' + avatar(next) +
        '<div class="grow"><div class="t ell">' + h(next.name) + ' <span class="lvl ' + h(next.level) + '">' + h(next.level) + '</span></div><div class="s">' + h(next.region || '') + ' · ' + dL(next.nextVisit) +
        (next.nextVisit < t ? ' <span class="tag red">kechikkan</span>' : '') + '</div></div>' + debtHTML(bal(next.id)) + '</button></div>' : '') +
      '<div class="card"><h3>Kunlik umumiy xulosa</h3><div>' + h(xulosa) + '</div></div>' +
      '<div class="card"><h3>AI tavsiyasi</h3>' + (sum && sum.ai ? '<div style="white-space:pre-wrap">' + h(sum.ai) + '</div>' : '<div class="muted small">Kechqurun "Bugungi fikrlarni umumlashtirish" tugmasini bosing — AI bugungi haqiqiy ma\'lumotlar asosida tavsiya beradi.</div>') +
      '<button class="btn soft full" style="margin-top:10px" data-a="summary">Bugungi fikrlarni umumlashtirish</button></div>' +
      '<div class="btns" style="margin-bottom:12px"><button class="btn" data-a="newOrder">🧾 Buyurtma</button><button class="btn sec" data-a="newPay">💵 To\'lov</button>' +
      '<button class="btn sec" data-a="newNote">💬 Fikr</button><button class="btn sec" data-a="newShop">🏪 Yangi do\'kon</button></div>'
  };
};
function stat(l, v, cls, sub, vcls) { return '<div class="stat ' + (cls || '') + '"><div class="l">' + h(l) + '</div><div class="v num ' + (vcls || '') + '">' + h(v) + '</div>' + (sub ? '<div class="small" style="opacity:.8">' + h(sub) + '</div>' : '') + '</div>'; }
function avatar(s) { return '<span class="av">' + (s.photoId ? '<img data-photo="' + s.photoId + '" alt="">' : h((s.name || '?').charAt(0).toUpperCase())) + '</span>'; }

/* ---------- Do'konlar ro'yxati ---------- */
const FILTERS = [['all', 'Hammasi'], ['qarz', 'Qarzdorlar'], ['bugun', 'Bugun kiriladigan'], ['yangi', 'Yangi'], ['uzoq', 'Uzoq buyurtma bermagan'], ['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D']];
PAGES.shops = (P) => {
  P.f = P.f || 'all'; P.q = P.q || ''; P.region = P.region || '';
  const regions = [...new Set(D.shops.map(s => s.region).filter(Boolean))].sort();
  return {
    title: "Do'konlar",
    html: '<div class="search"><input class="inp" id="shopQ" data-in="shopQ" placeholder="Nomi, egasi, telefon, hudud, qarz..." value="' + h(P.q) + '"><button class="btn" data-a="newShop">+</button></div>' +
      '<div class="hscroll">' + FILTERS.map(([k, l]) => '<button class="chip ' + (P.f === k ? 'on' : '') + '" data-a="shopF" data-f="' + k + '">' + l + '</button>').join('') + '</div>' +
      (regions.length ? '<div class="field"><select class="inp" data-ch="shopRegion"><option value="">Barcha hududlar</option>' + regions.map(r => '<option ' + (P.region === r ? 'selected' : '') + '>' + h(r) + '</option>').join('') + '</select></div>' : '') +
      '<div id="shopList">' + shopListHTML(P) + '</div>' +
      '<button class="btn sec full" data-a="products">📦 Mahsulotlar</button>'
  };
};
function listDebt(b) {
  const l = Calc.debtLabel(b);
  return '<div class="num ' + (l.kind === 'qarz' ? 'red' : l.kind === 'avans' ? 'ok' : 'muted') + '" style="font-weight:700">' + F(l.amount) + '</div>' + (l.kind === 'avans' ? '<div class="small ok">avans</div>' : '');
}
function shopListHTML(P) {
  const t = today(), q = TextUz.norm(P.q), qd = P.q.replace(/\D/g, '');
  let rows = D.shops.map(s => ({ s, b: bal(s.id), d: shopDates(s.id) }));
  rows = rows.filter(({ s, b, d }) => {
    if (P.region && s.region !== P.region) return false;
    switch (P.f) {
      case 'qarz': if (b <= 0) return false; break;
      case 'bugun': if (!s.nextVisit || s.nextVisit > t) return false; break;
      case 'yangi': if ((s.created || '').slice(0, 10) < addDays(t, -30)) return false; break;
      case 'uzoq': if (d.lastOrder && d.lastOrder.slice(0, 10) >= addDays(t, -14)) return false; break;
      case 'A': case 'B': case 'C': case 'D': if (s.level !== P.f) return false; break;
    }
    if (!q) return true;
    const hay = TextUz.norm([s.name, s.owner, s.region, s.address, s.code, 'daraja ' + s.level].join(' '));
    if (hay.includes(q)) return true;
    if (qd.length >= 3 && (s.phone || '').replace(/\D/g, '').includes(qd)) return true;
    if (qd.length >= 4 && /^[\d\s>]+$/.test(P.q) && b >= I(qd)) return true;   // qarz bo'yicha: shu summadan ko'p qarzi borlar
    return q.length === 1 && s.level === q.toUpperCase();
  });
  rows.sort((a, b) => P.f === 'qarz' ? b.b - a.b : P.f === 'bugun' ? (a.s.nextVisit || '').localeCompare(b.s.nextVisit || '') : a.s.name.localeCompare(b.s.name));
  if (!rows.length) return '<div class="list"><div class="empty"><b>Do\'kon topilmadi</b>Filtrni o\'zgartiring yoki yangi do\'kon qo\'shing.</div></div>';
  return '<div class="list">' + rows.map(({ s, b, d }) => {
    const over = s.debtLimit && b > s.debtLimit;
    return '<button class="item" data-a="openShop" data-id="' + s.id + '">' + avatar(s) + '<div class="grow"><div class="t ell">' + h(s.name) + ' <span class="lvl ' + h(s.level) + '">' + h(s.level || '-') + '</span></div>' +
      '<div class="s ell">' + h([s.owner, s.region].filter(Boolean).join(' · ')) + (s.nextVisit && s.nextVisit <= t ? ' · <b class="warn">bugun</b>' : '') + '</div>' +
      '<div class="s">Oxirgi tashrif: ' + (d.lastVisit ? dL(d.lastVisit.slice(0, 10)) : '—') + '</div></div>' +
      '<div style="text-align:right">' + listDebt(b) + (over ? '<div class="tag red">limit</div>' : '') + '</div></button>';
  }).join('') + '</div>';
}

/* ---------- Do'kon kartasi ---------- */
PAGES.shop = (P) => {
  const s = shop(P.id); if (!s) return { title: "Do'kon", html: '<div class="empty">Topilmadi</div>' };
  const b = bal(s.id), d = shopDates(s.id), tabT = P.tab || 'orders';
  const over = s.debtLimit && b > s.debtLimit;
  const kv = (k, v) => v ? '<div class="kv"><span class="muted">' + k + '</span><span style="text-align:right">' + v + '</span></div>' : '';
  const tel = s.phone ? '<a href="tel:' + h(s.phone.replace(/[^\d+]/g, '')) + '">' + h(s.phone) + '</a>' : '';
  const tg = s.telegram ? '<a href="#" data-a="tgOpen" data-p="' + h(s.telegram) + '">' + h(s.telegram) + '</a>' : '';
  const gps = s.gps ? '<a href="geo:' + s.gps.lat + ',' + s.gps.lng + '?q=' + s.gps.lat + ',' + s.gps.lng + '">' + s.gps.lat + ', ' + s.gps.lng + '</a>' : '';
  return {
    title: s.name,
    html: (s.photoId ? '<img class="photo" data-photo="' + s.photoId + '" alt="">' : '') +
      '<div class="stats"><div class="stat hero wide"><div class="l">' + h(s.code) + ' · Mijoz darajasi ' + h(s.level || '-') + '</div>' +
      '<div class="v num">' + h(Calc.debtLabel(b).text) + '</div>' + (s.debtLimit ? '<div class="small" style="opacity:.85">Qarz limiti: ' + F(s.debtLimit) + '</div>' : '') + '</div></div>' +
      (over ? '<div class="banner red">Qarz limitdan ' + F(b - s.debtLimit) + " so'm oshgan</div>" : '') +
      '<div class="btns" style="margin-bottom:12px"><button class="btn" data-a="newOrder" data-shop="' + s.id + '">🧾 Buyurtma</button><button class="btn sec" data-a="newPay" data-shop="' + s.id + '">💵 To\'lov</button>' +
      '<button class="btn sec" data-a="newNote" data-shop="' + s.id + '">💬 Fikr</button><button class="btn sec" data-a="newReturn" data-shop="' + s.id + '">↩️ Qaytarish</button></div>' +
      '<div class="card">' + kv('Egasi', h(s.owner)) + kv('Telefon', tel) + kv('Telegram', tg) + kv('Hudud', h(s.region)) + kv('Manzil', h(s.address)) + kv('GPS', gps) +
      kv('Oxirgi buyurtma', d.lastOrder ? dL(d.lastOrder.slice(0, 10)) : '—') + kv("Oxirgi to'lov", d.lastPay ? dL(d.lastPay.slice(0, 10)) : '—') +
      kv('Oxirgi tashrif', d.lastVisit ? dL(d.lastVisit.slice(0, 10)) : '—') + kv('Keyingi tashrif', s.nextVisit ? dL(s.nextVisit) : '—') + kv('Izoh', h(s.note)) + '</div>' +
      '<div class="btns three" style="margin-bottom:12px"><button class="btn soft sm" data-a="markVisit" data-id="' + s.id + '">✅ Tashrif</button>' +
      '<button class="btn soft sm" data-a="editShop" data-id="' + s.id + '">✏️ Tahrir</button><button class="btn soft sm" data-a="shopStatement" data-id="' + s.id + '">📄 Akt</button></div>' +
      '<div class="tabs">' + [['orders', 'Buyurtmalar'], ['pays', "To'lovlar"], ['notes', 'Fikrlar'], ['compl', 'Shikoyatlar'], ['rets', 'Qaytarishlar'], ['prices', 'Shaxsiy narxlar']]
        .map(([k, l]) => '<button class="' + (tabT === k ? 'on' : '') + '" data-a="shopTab" data-t="' + k + '">' + l + '</button>').join('') + '</div>' +
      shopTabHTML(s, tabT)
  };
};
function shopTabHTML(s, t) {
  const by = (arr) => arr.filter(x => x.shopId === s.id).sort((a, b) => Calc.key(b).localeCompare(Calc.key(a)));
  if (t === 'orders') return listOrders(by(D.orders));
  if (t === 'pays') return listPays(by(D.payments));
  if (t === 'notes') return listNotes(by(D.notes));
  if (t === 'compl') return listNotes(by(D.notes).filter(Calc.isComplaint));
  if (t === 'rets') { const r = by(D.returns); return r.length ? '<div class="list">' + r.map(x => '<div class="item"><div class="grow"><div class="t">' + dL(x.date) + ' ' + h(x.time || '') + '</div><div class="s">' + h((x.lines || []).map(l => l.name + ' × ' + l.qty).join(', ') || x.note || 'Qaytarish') + '</div></div><span class="num ok">−' + F(x.total) + '</span></div>').join('') + '</div>' : empty("Qaytarish yo'q"); }
  if (t === 'prices') {
    return '<div class="list">' + D.products.filter(p => p.active !== false).map(p => '<div class="item"><div class="grow"><div class="t ell">' + h(p.name) + '</div><div class="s">Umumiy narx: ' + F(p.price) + '</div></div>' +
      '<input class="inp num money" style="width:130px" inputmode="numeric" data-in="shopPrice" data-sid="' + s.id + '" data-pid="' + p.id + '" value="' + (s.prices && s.prices[p.id] ? F(s.prices[p.id]) : '') + '" placeholder="' + F(p.price) + '"></div>').join('') + '</div>' +
      '<div class="small muted">Bo\'sh qoldirilsa umumiy narx ishlatiladi. Shaxsiy narx buyurtmada avtomatik qo\'yiladi.</div>';
  }
  return '';
}
const empty = (t) => '<div class="list"><div class="empty">' + h(t) + '</div></div>';
const ST_TAG = { yangi: '', tayyor: 'warn', yetkazildi: 'ok', qisman: 'warn', bekor: 'red' };
function listOrders(arr, withShop) {
  if (!arr.length) return empty("Buyurtma yo'q");
  return '<div class="list">' + arr.map(o => '<button class="item" data-a="openOrder" data-id="' + o.id + '"><div class="grow"><div class="t ell">№' + h(o.no) + (withShop ? ' · ' + h(shopName(o.shopId)) : '') + '</div>' +
    '<div class="s">' + dL(o.date) + ' ' + h(o.time) + ' · ' + o.totalQty + ' dona <span class="tag ' + (ST_TAG[o.status] || '') + '">' + h(Exp.STATUS[o.status] || o.status) + '</span></div></div>' +
    '<span class="num" style="font-weight:750' + (o.status === 'bekor' ? ';text-decoration:line-through;color:#999' : '') + '">' + F(o.total) + '</span></button>').join('') + '</div>';
}
function listPays(arr, withShop) {
  if (!arr.length) return empty("To'lov yo'q");
  return '<div class="list">' + arr.map(p => '<button class="item" data-a="openPay" data-id="' + p.id + '"><div class="grow"><div class="t">' + (withShop ? h(shopName(p.shopId)) + ' · ' : '') + h(Exp.PAYTYPE[p.type] || p.type) + '</div>' +
    '<div class="s">' + dL(p.date) + ' ' + h(p.time) + (p.note ? ' · ' + h(p.note) : '') + (p.photoId ? ' · 🧾' : '') + '</div></div><span class="num ok" style="font-weight:750">' + F(p.amount) + '</span></button>').join('') + '</div>';
}
const PRI = { past: ['Past', ''], orta: ["O'rta", 'warn'], yuqori: ['Yuqori', 'red'] };
function listNotes(arr, withShop) {
  if (!arr.length) return empty("Yozuv yo'q");
  return '<div class="list">' + arr.map(n => {
    const txt = ['fikr', 'shikoyat', 'qoshimcha', 'tavsiya'].map(k => n[k] && n[k].text ? (k === 'shikoyat' ? '⚠️ ' : '') + n[k].text : '').filter(Boolean).join(' · ');
    const tags = (n.tags || []).map(t => { const q = TextUz.QUICK.find(x => x.id === t); return q ? '<span class="tag ' + (Calc.COMPLAINT_TAGS.includes(t) ? 'red' : '') + '">' + h(q.label) + '</span>' : ''; }).join('');
    return '<button class="item" data-a="openNote" data-id="' + n.id + '"><div class="grow"><div class="t ell">' + (withShop ? h(shopName(n.shopId)) + ' · ' : '') + dL(n.date) + ' ' + h(n.time || '') +
      (n.priority && n.priority !== 'past' ? ' <span class="tag ' + PRI[n.priority][1] + '">' + PRI[n.priority][0] + '</span>' : '') + '</div>' +
      '<div class="s">' + h(txt || '') + '</div>' + (tags ? '<div>' + tags + '</div>' : '') + '</div></button>';
  }).join('') + '</div>';
}

/* ---------- Do'kon qo'shish / tahrirlash ---------- */
PAGES.shopForm = (P) => {
  const s = P.F || (P.F = P.id ? JSON.parse(JSON.stringify(shop(P.id))) : { id: '', name: '', owner: '', phone: '', telegram: '', region: '', address: '', gps: null, photoId: '', level: 'C', debtLimit: 0, openingDebt: 0, nextVisit: '', prices: {}, note: '' });
  const inp = (k, l, ph, type) => '<div class="field"><label>' + l + '</label><input class="inp" id="sf_' + k + '" ' + (type ? 'inputmode="' + type + '"' : '') + ' value="' + h(s[k]) + '" placeholder="' + (ph || '') + '"></div>';
  return {
    title: P.id ? "Do'konni tahrirlash" : "Yangi do'kon",
    html: '<div class="card">' + inp('name', "Do'kon nomi *", 'Masalan: Aziz Market') + inp('owner', 'Egasining ismi') +
      '<div class="two">' + inp('phone', 'Telefon', '+998', 'tel') + inp('telegram', 'Telegram raqami', '+998', 'tel') + '</div>' +
      '<div class="two">' + inp('region', 'Hudud', 'Chilonzor') + '<div class="field"><label>Mijoz darajasi</label><select class="inp" id="sf_level">' + ['A', 'B', 'C', 'D'].map(l => '<option ' + (s.level === l ? 'selected' : '') + '>' + l + '</option>').join('') + '</select></div></div>' +
      inp('address', 'Manzil') +
      '<div class="field"><label>GPS</label><div class="row"><div class="grow small" id="gpsTxt">' + (s.gps ? s.gps.lat + ', ' + s.gps.lng : 'Aniqlanmagan') + '</div><button class="btn soft sm" data-a="sfGps">📍 Aniqlash</button></div></div>' +
      '<div class="field"><label>Do\'kon rasmi</label>' + (s.photoId || s._photo ? '<img class="photo" ' + (s._photo ? 'src="' + s._photo + '"' : 'data-photo="' + s.photoId + '"') + ' alt="">' : '') +
      '<div class="btns"><button class="btn soft sm" data-a="sfPhoto" data-c="1">📷 Kamera</button><button class="btn soft sm" data-a="sfPhoto">🖼 Galereya</button></div></div>' +
      '<div class="two"><div class="field"><label>Qarz limiti</label>' + money('sf_debtLimit', s.debtLimit) + '</div><div class="field"><label>Boshlang\'ich qarz</label>' + money('sf_openingDebt', s.openingDebt) + '</div></div>' +
      '<div class="field"><label>Keyingi tashrif</label><input type="date" class="inp" id="sf_nextVisit" value="' + h(s.nextVisit) + '"></div>' +
      '<div class="field"><label>Izoh</label><input class="inp" id="sf_note" value="' + h(s.note) + '"></div></div>' +
      '<button class="btn full" data-a="sfSave">Saqlash</button>' + (P.id ? '<button class="btn red full" style="margin-top:10px" data-a="sfDelete">Do\'konni o\'chirish</button>' : '')
  };
};

/* ---------- Mahsulotlar ---------- */
PAGES.products = (P) => {
  P.q = P.q || '';
  const q = TextUz.norm(P.q);
  const list = D.products.filter(p => !q || TextUz.norm(p.name + ' ' + p.category + ' ' + p.brand).includes(q));
  return {
    title: 'Mahsulotlar',
    html: '<div class="search"><input class="inp" data-in="prodQ" placeholder="Qidirish" value="' + h(P.q) + '"><button class="btn" data-a="newProduct">+</button></div>' +
      '<div class="btns" style="margin-bottom:12px"><button class="btn soft sm" data-a="pricePdf" data-f="A4">📄 Narxlar PDF</button><button class="btn soft sm" data-a="pricePdf" data-f="print">🖨 Narxlar chek</button></div>' +
      '<div class="list" id="prodList">' + (list.map(p => '<button class="item" data-a="editProduct" data-id="' + p.id + '"><span class="av">' + (p.photoId ? '<img data-photo="' + p.photoId + '" alt="">' : '📦') + '</span>' +
        '<div class="grow"><div class="t ell">' + h(p.name) + (p.active === false ? ' <span class="tag">faol emas</span>' : '') + '</div><div class="s">' + h([p.category, p.brand].filter(Boolean).join(' · ')) + ' · qoldiq ' + h(p.stock == null || p.stock === '' ? '—' : p.stock) + ' ' + h(p.unit || '') + '</div></div>' +
        '<span class="num" style="font-weight:750">' + F(p.price) + '</span></button>').join('') || '<div class="empty">Mahsulot yo\'q</div>') + '</div>'
  };
};
PAGES.productForm = (P) => {
  const p = P.F || (P.F = P.id ? JSON.parse(JSON.stringify(product(P.id))) : { id: '', name: '', category: '', brand: '', photoId: '', unit: 'dona', pack: '', price: 0, minPrice: 0, cost: 0, stock: 0, note: '', active: true });
  const inp = (k, l, ph) => '<div class="field"><label>' + l + '</label><input class="inp" id="pf_' + k + '" value="' + h(p[k]) + '" placeholder="' + (ph || '') + '"></div>';
  return {
    title: P.id ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot',
    html: '<div class="card">' + inp('name', 'Nomi *', 'Funchuza 200 g') + '<div class="two">' + inp('category', 'Kategoriya') + inp('brand', 'Brend') + '</div>' +
      '<div class="two"><div class="field"><label>Birlik</label><select class="inp" id="pf_unit">' + ['dona', 'kg', 'blok', 'quti', 'pachka', 'litr'].map(u => '<option ' + (p.unit === u ? 'selected' : '') + '>' + u + '</option>').join('') + '</select></div>' + inp('pack', "Qadoq og'irligi", '700 g') + '</div>' +
      '<div class="two"><div class="field"><label>Sotuv narxi *</label>' + money('pf_price', p.price) + '</div><div class="field"><label>Minimal narx</label>' + money('pf_minPrice', p.minPrice) + '</div></div>' +
      '<div class="two"><div class="field"><label>Tannarx</label>' + money('pf_cost', p.cost) + '</div><div class="field"><label>Ombor qoldig\'i</label><input class="inp num" inputmode="decimal" id="pf_stock" value="' + h(p.stock) + '"></div></div>' +
      inp('note', 'Izoh') +
      '<div class="field"><label>Rasm</label>' + (p.photoId || p._photo ? '<img class="photo" ' + (p._photo ? 'src="' + p._photo + '"' : 'data-photo="' + p.photoId + '"') + ' alt="">' : '') +
      '<div class="btns"><button class="btn soft sm" data-a="pfPhoto" data-c="1">📷 Kamera</button><button class="btn soft sm" data-a="pfPhoto">🖼 Galereya</button></div></div>' +
      '<label class="row" style="gap:10px;font-weight:650"><input type="checkbox" id="pf_active" style="width:24px;height:24px" ' + (p.active !== false ? 'checked' : '') + '> Faol (buyurtmada ko\'rinadi)</label></div>' +
      '<button class="btn full" data-a="pfSave">Saqlash</button>'
  };
};

/* ---------- Buyurtmalar ro'yxati ---------- */
PAGES.orders = (P) => {
  P.f = P.f || 'bugun';
  let arr = D.orders.slice();
  if (P.f === 'bugun') arr = arr.filter(o => o.date === today());
  else if (P.f !== 'all') arr = arr.filter(o => o.status === P.f);
  arr.sort((a, b) => Calc.key(b).localeCompare(Calc.key(a)));
  return {
    title: 'Buyurtmalar',
    html: '<div class="btns" style="margin-bottom:12px"><button class="btn" data-a="newOrder">+ Yangi buyurtma</button><button class="btn sec" data-a="voiceMain">🎤 Ovoz bilan</button></div>' +
      '<div class="hscroll">' + [['bugun', 'Bugun'], ['all', 'Hammasi'], ['yangi', 'Yangi'], ['tayyor', 'Tayyorlandi'], ['yetkazildi', 'Yetkazildi'], ['qisman', 'Qisman'], ['bekor', 'Bekor']]
        .map(([k, l]) => '<button class="chip ' + (P.f === k ? 'on' : '') + '" data-a="ordF" data-f="' + k + '">' + l + '</button>').join('') + '</div>' +
      listOrders(arr.slice(0, 300), true) +
      '<div class="btns"><button class="btn sec" data-a="newPay">💵 To\'lov yozish</button><button class="btn sec" data-a="newReturn">↩️ Qaytarish</button></div>'
  };
};

/* ---------- Buyurtma formasi ---------- */
function newOrderF(shopId, lines) {
  return { id: '', shopId: shopId || '', lines: lines || [], paid: 0, payType: 'naqd', returned: 0, status: 'yangi', date: today(), time: nowHM(), t: {}, created: Date.now(), q: '' };
}
function priceFor(shopId, p) { const s = shop(shopId); return (s && s.prices && s.prices[p.id]) || p.price; }
PAGES.orderForm = (P) => {
  const Fo = P.F;
  if (!Fo.shopId) return shopPicker('Buyurtma: do\'konni tanlang', 'pickOrderShop', Fo);
  const s = shop(Fo.shopId);
  const tot = Calc.orderTotals(Fo.lines);
  const k = Calc.key({ date: Fo.date, time: Fo.time, created: Fo.created });
  const prev = prevDebtFor(Fo.shopId, Fo.id || '__new', k);
  const paid = I(Fo.paid), ret = I(Fo.returned);
  const newDebt = Calc.remainingDebt(prev, Fo.status === 'bekor' ? 0 : tot.total, ret, paid);
  const prods = D.products.filter(p => p.active !== false);
  return {
    title: Fo.id ? 'Buyurtma №' + Fo.no : 'Yangi buyurtma',
    html: '<div class="card"><div class="row sb"><div class="grow"><div class="muted small">Do\'kon</div><b>' + h(s.name) + '</b></div><button class="btn soft sm" data-a="changeOrderShop">O\'zgartirish</button></div>' +
      (s.debtLimit && prev > s.debtLimit ? '<div class="banner red" style="margin:10px 0 0">Qarz limitdan oshgan: ' + F(prev) + ' / ' + F(s.debtLimit) + '</div>' : '') + '</div>' +
      '<div class="field"><label>Mahsulot qo\'shish (bosing)</label></div><div class="pgrid">' + prods.map(p => '<button class="pbtn" data-a="addLine" data-id="' + p.id + '"><b>' + h(p.name) + '</b><span class="num">' + F(priceFor(Fo.shopId, p)) + (p.stock !== '' && p.stock != null ? ' · ' + p.stock : '') + '</span></button>').join('') + '</div>' +
      (Fo.lines.length ? Fo.lines.map((l, i) => {
        const lt = Calc.lineTotal(l);
        return '<div class="oline" data-i="' + i + '"><div class="row sb" style="margin-bottom:8px"><b class="grow">' + h(l.name) + '</b><button class="del" data-a="delLine" data-i="' + i + '" aria-label="O\'chirish">✕</button></div>' +
          '<div class="row sb" style="margin-bottom:8px"><div class="qty"><button data-a="qty" data-i="' + i + '" data-d="-1">−</button><input class="inp num" inputmode="decimal" data-in="lineQty" data-i="' + i + '" value="' + h(l.qty) + '"><button data-a="qty" data-i="' + i + '" data-d="1">+</button></div>' +
          '<div style="text-align:right"><div class="small muted">Jami</div><b class="num" id="lt' + i + '">' + F(lt.total) + '</b></div></div>' +
          '<div class="two"><div><div class="small muted">Birlik narxi</div><input class="inp num money" inputmode="numeric" data-in="linePrice" data-i="' + i + '" value="' + F(l.price) + '"></div>' +
          '<div><div class="small muted">Chegirma (so\'m)</div><input class="inp num money" inputmode="numeric" data-in="lineDisc" data-i="' + i + '" value="' + (I(l.discount) ? F(l.discount) : '') + '" placeholder="0"></div></div>' +
          (l.minPrice && I(l.price) < I(l.minPrice) ? '<div class="small warn" style="margin-top:6px">Minimal narxdan past (' + F(l.minPrice) + ')</div>' : '') + '</div>';
      }).join('') : '<div class="card empty">Yuqoridan mahsulotni bosing</div>') +
      '<div class="card" id="orderTotals">' + orderTotalsHTML(tot, prev, ret, paid, newDebt) + '</div>' +
      '<div class="card"><h3>To\'lov va qaytarish</h3>' +
      '<div class="two"><div class="field"><label>To\'langan summa</label>' + money('of_paid', Fo.paid) + '</div><div class="field"><label>To\'lov turi</label><select class="inp" id="of_payType">' +
      ['naqd', 'click', 'payme', 'bank', 'karta'].map(t => '<option value="' + t + '" ' + (Fo.payType === t ? 'selected' : '') + '>' + Exp.PAYTYPE[t] + '</option>').join('') + '</select></div></div>' +
      '<div class="field"><label>Qaytarilgan tovar summasi</label>' + money('of_returned', Fo.returned) + '</div></div>' +
      '<div class="card">' + tf(Fo, 'note', 'Izoh', 2) +
      '<div class="two"><div class="field"><label>Sana</label><input type="date" class="inp" id="of_date" value="' + h(Fo.date) + '"></div><div class="field"><label>Vaqt</label><input type="time" class="inp" id="of_time" value="' + h(Fo.time) + '"></div></div>' +
      '<div class="field"><label>Holat</label><select class="inp" id="of_status">' + Object.entries(Exp.STATUS).map(([k, l]) => '<option value="' + k + '" ' + (Fo.status === k ? 'selected' : '') + '>' + l + '</option>').join('') + '</select></div></div>' +
      '<button class="btn full" data-a="saveOrder">Buyurtmani saqlash</button>'
  };
};
function orderTotalsHTML(tot, prev, ret, paid, newDebt) {
  const l = Calc.debtLabel(newDebt);
  return '<div class="kv"><span>Jami dona</span><b class="num">' + tot.totalQty + '</b></div>' +
    (tot.discount ? '<div class="kv"><span>Chegirma</span><span class="num">' + F(tot.discount) + '</span></div>' : '') +
    '<div class="kv big"><span>Buyurtma</span><span class="num">' + F(tot.total) + '</span></div>' +
    '<div class="kv"><span>Oldingi qarz</span>' + debtHTML(prev) + '</div>' +
    (ret ? '<div class="kv"><span>Qaytarilgan tovar</span><span class="num">−' + F(ret) + '</span></div>' : '') +
    (paid ? '<div class="kv"><span>To\'langan</span><span class="num ok">−' + F(paid) + '</span></div>' : '') +
    '<div class="kv big"><span>' + (l.kind === 'avans' ? 'Avans' : 'Yangi qarz') + '</span><span class="num ' + (l.kind === 'avans' ? 'ok' : 'red') + '">' + F(l.amount) + '</span></div>';
}
function updateOrderTotals() {
  const Fo = curF(); if (!Fo) return;
  readOrderSide(Fo);
  const tot = Calc.orderTotals(Fo.lines);
  const prev = prevDebtFor(Fo.shopId, Fo.id || '__new', Calc.key({ date: Fo.date, time: Fo.time, created: Fo.created }));
  const nd = Calc.remainingDebt(prev, Fo.status === 'bekor' ? 0 : tot.total, Fo.returned, Fo.paid);
  $('orderTotals').innerHTML = orderTotalsHTML(tot, prev, I(Fo.returned), I(Fo.paid), nd);
  Fo.lines.forEach((l, i) => { const e = $('lt' + i); if (e) e.textContent = F(Calc.lineTotal(l).total); });
}
function readOrderSide(Fo) {
  if ($('of_paid')) { Fo.paid = mval('of_paid'); Fo.returned = mval('of_returned'); Fo.payType = val('of_payType'); Fo.date = val('of_date') || today(); Fo.time = val('of_time') || nowHM(); Fo.status = val('of_status'); }
}
function shopPicker(title, action, Fx) {
  Fx.q = Fx.q || '';
  const q = TextUz.norm(Fx.q);
  const t = today();
  const list = D.shops.filter(s => !q || TextUz.norm(s.name + ' ' + s.owner + ' ' + s.region).includes(q))
    .sort((a, b) => ((b.nextVisit && b.nextVisit <= t) - (a.nextVisit && a.nextVisit <= t)) || a.name.localeCompare(b.name));
  return {
    title,
    html: '<div class="search"><input class="inp" data-in="pickQ" placeholder="Do\'kon nomini yozing" value="' + h(Fx.q) + '"><button class="btn" data-a="newShop">+</button></div>' +
      '<div class="list">' + (list.map(s => '<button class="item" data-a="' + action + '" data-id="' + s.id + '">' + avatar(s) + '<div class="grow"><div class="t ell">' + h(s.name) + '</div><div class="s">' + h(s.region || '') + (s.nextVisit && s.nextVisit <= t ? ' · <b class="warn">bugun</b>' : '') + '</div></div>' + debtHTML(bal(s.id)) + '</button>').join('') || '<div class="empty">Do\'kon topilmadi</div>') + '</div>'
  };
}

/* ---------- Buyurtmani ko'rish ---------- */
PAGES.order = (P) => {
  const o = D.orders.find(x => x.id === P.id); if (!o) return { title: 'Buyurtma', html: empty('Topilmadi') };
  const s = shop(o.shopId);
  return {
    title: 'Buyurtma №' + o.no,
    html: '<div class="card"><div class="row sb"><div><div class="muted small">' + dS(o.date) + ' ' + h(o.time) + '</div><b style="font-size:19px">' + h(s ? s.name : '') + '</b></div>' +
      '<span class="tag ' + (ST_TAG[o.status] || '') + '">' + h(Exp.STATUS[o.status]) + '</span></div></div>' +
      '<div class="list">' + o.lines.map(l => { const t = Calc.lineTotal(l); return '<div class="item"><div class="grow"><div class="t">' + h(l.name) + '</div><div class="s num">' + l.qty + ' × ' + F(l.price) + (t.discount ? ' − ' + F(t.discount) : '') + '</div></div><b class="num">' + F(t.total) + '</b></div>'; }).join('') + '</div>' +
      '<div class="card">' + orderTotalsHTML({ totalQty: o.totalQty, discount: o.discount, total: o.total }, o.prevDebt, I(o.returned), I(o.paid), o.newDebt) +
      (o.note ? '<div style="margin-top:8px"><span class="muted">Izoh:</span> ' + h(o.note) + '</div>' : '') + '</div>' +
      '<div class="btns" style="margin-bottom:10px"><button class="btn" data-a="oCopy" data-id="' + o.id + '">📋 Nusxalash</button><button class="btn" data-a="oTg" data-id="' + o.id + '">✈️ Telegramga</button>' +
      '<button class="btn sec" data-a="oShare" data-id="' + o.id + '">📤 Ulashish</button><button class="btn sec" data-a="oPdf" data-id="' + o.id + '">📄 PDF</button></div>' +
      '<button class="btn sec full" style="margin-bottom:10px" data-a="oPrint" data-id="' + o.id + '">🖨 Printer</button>' +
      '<div class="field"><label>Holatni o\'zgartirish</label><div class="chips">' + Object.entries(Exp.STATUS).map(([k, l]) => '<button class="chip ' + (o.status === k ? 'on' : '') + '" data-a="oStatus" data-id="' + o.id + '" data-s="' + k + '">' + l + '</button>').join('') + '</div></div>' +
      '<div class="btns"><button class="btn soft" data-a="oEdit" data-id="' + o.id + '">✏️ Tahrirlash</button><button class="btn soft" data-a="openShop" data-id="' + o.shopId + '">🏪 Do\'kon</button></div>' +
      '<div class="card" style="margin-top:12px"><h3>Telegram matni</h3><pre class="tg">' + h(Exp.orderText(o, s)) + '</pre></div>'
  };
};

/* ---------- To'lov formasi ---------- */
const PTYPES = ['naqd', 'click', 'payme', 'bank', 'karta', 'dollar', 'aralash'];
PAGES.payForm = (P) => {
  const Fp = P.F;
  if (!Fp.shopId) return shopPicker("To'lov: do'konni tanlang", 'pickPayShop', Fp);
  const b = Fp.id ? Calc.shopBalance({ shops: D.shops, orders: D.orders, returns: D.returns, payments: D.payments.filter(p => p.id !== Fp.id) }, Fp.shopId) : bal(Fp.shopId);
  const amount = payAmount(Fp);
  return {
    title: Fp.id ? "To'lovni tahrirlash" : "To'lov",
    html: '<div class="card"><div class="row sb"><div class="grow"><div class="muted small">Do\'kon</div><b>' + h(shopName(Fp.shopId)) + '</b></div>' + (Fp.id ? '' : '<button class="btn soft sm" data-a="changePayShop">O\'zgartirish</button>') + '</div>' +
      '<div class="kv" style="margin-top:8px"><span>Hozirgi holat</span>' + debtHTML(b, true) + '</div></div>' +
      '<div class="field"><label>To\'lov turi</label><div class="chips">' + PTYPES.map(t => '<button class="chip ' + (Fp.type === t ? 'on' : '') + '" data-a="payType" data-t="' + t + '">' + Exp.PAYTYPE[t] + '</button>').join('') + '</div></div>' +
      '<div class="card">' +
      (Fp.type === 'dollar' ? '<div class="two"><div class="field"><label>Dollar ($)</label><input class="inp num" inputmode="decimal" id="pf_usd" data-in="payRecalc" value="' + h(Fp.usdText || '') + '" placeholder="100.00"></div>' +
        '<div class="field"><label>Kurs (so\'m)</label>' + money('pf_rate', Fp.rate || D.settings.lastRate || '') + '</div></div>' : '') +
      (Fp.type === 'aralash' ? (Fp.parts.map((x, i) => '<div class="two" style="margin-bottom:8px"><select class="inp" data-ch="partType" data-i="' + i + '">' + PTYPES.filter(t => t !== 'aralash').map(t => '<option value="' + t + '" ' + (x.type === t ? 'selected' : '') + '>' + Exp.PAYTYPE[t] + '</option>').join('') + '</select>' +
        '<div class="row"><input class="inp num money" inputmode="numeric" data-in="partAmt" data-i="' + i + '" value="' + (I(x.amount) ? F(x.amount) : '') + '" placeholder="so\'m"><button class="del" data-a="delPart" data-i="' + i + '">✕</button></div></div>').join('') +
        '<button class="btn soft sm full" style="margin-bottom:10px" data-a="addPart">+ Qism qo\'shish</button>') : '') +
      (Fp.type !== 'dollar' && Fp.type !== 'aralash' ? '<div class="field"><label>Summa (so\'m)</label>' + money('pf_amount', Fp.amount) + '</div>' : '') +
      '<div class="kv big"><span>Jami to\'lov</span><span class="num ok" id="payTotal">' + F(amount) + '</span></div>' +
      '<div class="kv"><span>To\'lovdan keyin</span><span id="payAfter">' + debtHTML(b - amount) + '</span></div></div>' +
      '<div class="card"><div class="two"><div class="field"><label>Sana</label><input type="date" class="inp" id="pf_date" value="' + h(Fp.date) + '"></div><div class="field"><label>Vaqt</label><input type="time" class="inp" id="pf_time" value="' + h(Fp.time) + '"></div></div>' +
      tf(Fp, 'note', 'Izoh', 2) +
      '<div class="field"><label>Chek rasmi</label>' + (Fp._photo || Fp.photoId ? '<img class="photo" ' + (Fp._photo ? 'src="' + Fp._photo + '"' : 'data-photo="' + Fp.photoId + '"') + ' alt="">' : '') +
      '<div class="btns"><button class="btn soft sm" data-a="payPhoto" data-c="1">📷 Kamera</button><button class="btn soft sm" data-a="payPhoto">🖼 Galereya</button></div></div></div>' +
      '<button class="btn full" data-a="savePay">To\'lovni saqlash</button>' + (Fp.id ? '<button class="btn red full" style="margin-top:10px" data-a="delPay">To\'lovni o\'chirish</button>' : '')
  };
};
function readPay(Fp) {
  if ($('pf_amount')) Fp.amount = mval('pf_amount');
  if ($('pf_usd')) { Fp.usdText = val('pf_usd'); Fp.rate = mval('pf_rate'); }
  if ($('pf_date')) { Fp.date = val('pf_date') || today(); Fp.time = val('pf_time') || nowHM(); }
}
function payAmount(Fp) {
  if (Fp.type === 'dollar') return Calc.usdToUzs(Math.round(parseFloat(String(Fp.usdText || '0').replace(',', '.')) * 100) || 0, Fp.rate);
  if (Fp.type === 'aralash') return Fp.parts.reduce((s, x) => s + I(x.amount), 0);
  return I(Fp.amount);
}
function updatePayTotals() {
  const Fp = curF(); readPay(Fp);
  const b = Fp.id ? Calc.shopBalance({ shops: D.shops, orders: D.orders, returns: D.returns, payments: D.payments.filter(p => p.id !== Fp.id) }, Fp.shopId) : bal(Fp.shopId);
  const a = payAmount(Fp);
  if ($('payTotal')) { $('payTotal').textContent = F(a); $('payAfter').innerHTML = debtHTML(b - a); }
}

/* ---------- Qaytarish formasi ---------- */
PAGES.returnForm = (P) => {
  const Fr = P.F;
  if (!Fr.shopId) return shopPicker("Qaytarish: do'konni tanlang", 'pickRetShop', Fr);
  const tot = Calc.orderTotals(Fr.lines);
  return {
    title: 'Tovar qaytarish',
    html: '<div class="card"><div class="muted small">Do\'kon</div><b>' + h(shopName(Fr.shopId)) + '</b><div class="kv" style="margin-top:8px"><span>Hozirgi holat</span>' + debtHTML(bal(Fr.shopId), true) + '</div></div>' +
      '<div class="field"><label>Qaytgan mahsulotni bosing</label></div><div class="pgrid">' + D.products.map(p => '<button class="pbtn" data-a="retAdd" data-id="' + p.id + '"><b>' + h(p.name) + '</b><span class="num">' + F(priceFor(Fr.shopId, p)) + '</span></button>').join('') + '</div>' +
      Fr.lines.map((l, i) => '<div class="oline"><div class="row sb" style="margin-bottom:8px"><b class="grow">' + h(l.name) + '</b><button class="del" data-a="retDel" data-i="' + i + '">✕</button></div>' +
        '<div class="row sb"><div class="qty"><button data-a="retQty" data-i="' + i + '" data-d="-1">−</button><input class="inp num" inputmode="decimal" data-in="retQtyIn" data-i="' + i + '" value="' + h(l.qty) + '"><button data-a="retQty" data-i="' + i + '" data-d="1">+</button></div>' +
        '<input class="inp num money" style="width:120px" inputmode="numeric" data-in="retPrice" data-i="' + i + '" value="' + F(l.price) + '"></div></div>').join('') +
      '<div class="card"><div class="kv big"><span>Qaytarish summasi</span><span class="num ok" id="retTotal">' + F(tot.total) + '</span></div>' +
      '<div class="small muted">Qaytgan tovar omborga qaytib qo\'shiladi va qarzdan ayiriladi.</div></div>' +
      '<div class="card">' + tf(Fr, 'note', 'Sababi / izoh', 2) + '<div class="field"><label>Sana</label><input type="date" class="inp" id="rf_date" value="' + h(Fr.date) + '"></div></div>' +
      '<button class="btn full" data-a="saveReturn">Qaytarishni saqlash</button>'
  };
};

/* ---------- Fikrlar ro'yxati ---------- */
PAGES.notes = (P) => {
  P.f = P.f || 'bugun';
  let arr = D.notes.slice();
  if (P.f === 'bugun') arr = arr.filter(n => n.date === today());
  if (P.f === 'shikoyat') arr = arr.filter(Calc.isComplaint);
  if (P.f === 'muhim') arr = arr.filter(n => n.priority === 'yuqori');
  arr.sort((a, b) => Calc.key(b).localeCompare(Calc.key(a)));
  return {
    title: 'Fikrlar va shikoyatlar',
    html: '<div class="btns" style="margin-bottom:12px"><button class="btn" data-a="newNote">+ Yangi fikr</button><button class="btn sec" data-a="summary">📋 Umumlashtirish</button></div>' +
      '<div class="hscroll">' + [['bugun', 'Bugun'], ['all', 'Hammasi'], ['shikoyat', 'Shikoyatlar'], ['muhim', 'Muhim']].map(([k, l]) => '<button class="chip ' + (P.f === k ? 'on' : '') + '" data-a="noteF" data-f="' + k + '">' + l + '</button>').join('') + '</div>' +
      listNotes(arr.slice(0, 300), true)
  };
};

/* ---------- Fikr formasi ---------- */
function newNoteF(shopId) { return { id: '', shopId: shopId || '', tags: [], t: {}, product: '', competitor: '', priority: 'past', nextVisit: '', date: today(), time: nowHM(), q: '' }; }
PAGES.noteForm = (P) => {
  const Fn = P.F;
  if (!Fn.shopId) return shopPicker("Fikr: do'konni tanlang", 'pickNoteShop', Fn);
  return {
    title: Fn.id ? 'Fikrni tahrirlash' : 'Fikr: ' + shopName(Fn.shopId),
    html: '<div class="field"><label>Tezkor tugmalar</label><div class="chips">' + TextUz.QUICK.map(q => '<button class="chip ' + (Fn.tags.includes(q.id) ? 'on' : '') + '" data-a="noteTag" data-t="' + q.id + '">' + h(q.label) + '</button>').join('') + '</div></div>' +
      '<div class="card">' + tf(Fn, 'fikr', 'Fikr') + tf(Fn, 'shikoyat', 'Shikoyat') + tf(Fn, 'qoshimcha', "Qo'shimcha ma'lumot", 2) + tf(Fn, 'tavsiya', 'Tavsiya', 2) + '</div>' +
      '<div class="card"><div class="field"><label>Mahsulot</label><select class="inp" id="nf_product"><option value="">—</option>' + D.products.map(p => '<option ' + (Fn.product === p.name ? 'selected' : '') + '>' + h(p.name) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Raqobatchi</label><input class="inp" id="nf_competitor" value="' + h(Fn.competitor) + '" placeholder="Masalan: X firma 2 000 so\'m arzon"></div>' +
      '<div class="field"><label>Muhimlik darajasi</label><div class="seg">' + Object.entries(PRI).map(([k, [l]]) => '<button class="' + (Fn.priority === k ? 'on' : '') + '" data-a="notePri" data-p="' + k + '">' + l + '</button>').join('') + '</div></div>' +
      '<div class="field"><label>Keyingi tashrif</label><input type="date" class="inp" id="nf_next" value="' + h(Fn.nextVisit) + '">' +
      '<div class="chips" style="margin-top:8px">' + [['1', 'Ertaga'], ['2', 'Indinga'], ['7', '1 haftadan keyin'], ['14', '2 haftadan keyin']].map(([d, l]) => '<button class="chip" data-a="noteNext" data-d="' + d + '">' + l + '</button>').join('') + '</div></div>' +
      '<div class="field"><label>Sana</label><input type="date" class="inp" id="nf_date" value="' + h(Fn.date) + '"></div></div>' +
      '<button class="btn full" data-a="saveNote">Saqlash</button>' + (Fn.id ? '<button class="btn red full" style="margin-top:10px" data-a="delNote">O\'chirish</button>' : '')
  };
};

/* ---------- Ovozli yozuv: aniqlangan ma'lumotni tasdiqlash ---------- */
PAGES.voice = (P) => {
  const V = P.V;
  const shopOpts = '<option value="">— aniqlanmadi —</option>' + D.shops.map(s => '<option value="' + s.id + '" ' + (V.shopId === s.id ? 'selected' : '') + '>' + h(s.name) + '</option>').join('');
  return {
    title: 'Aniqlangan ma\'lumot',
    html: '<div class="card"><div class="muted small">Eshitildi</div><div>"' + h(V.raw) + '"</div>' + (V.source === 'ai' ? '<div class="tag ok" style="margin-top:6px">AI bilan ajratildi</div>' : '<div class="tag" style="margin-top:6px">Lokal ajratildi</div>') + '</div>' +
      '<div class="card"><div class="field"><label>Do\'kon</label><select class="inp" id="vShop">' + shopOpts + '</select></div>' +
      (V.lines.length ? '<label class="small muted" style="font-weight:650">Buyurtma</label>' + V.lines.map((l, i) => '<div class="oline"><div class="row sb"><select class="inp grow" data-ch="vProd" data-i="' + i + '">' + D.products.map(p => '<option value="' + p.id + '" ' + (l.productId === p.id ? 'selected' : '') + '>' + h(p.name) + '</option>').join('') + '</select><button class="del" data-a="vDel" data-i="' + i + '">✕</button></div>' +
        '<div class="two" style="margin-top:8px"><div><div class="small muted">Miqdor</div><input class="inp num" inputmode="decimal" data-in="vQty" data-i="' + i + '" value="' + h(l.qty) + '"></div><div><div class="small muted">Narx</div><input class="inp num money" inputmode="numeric" data-in="vPrice" data-i="' + i + '" value="' + (l.price ? F(l.price) : '') + '" placeholder="avtomatik"></div></div></div>').join('') : '<div class="muted small">Buyurtma aniqlanmadi</div>') +
      '</div><div class="card"><div class="field"><label>Talab (so\'ralgan)</label><input class="inp" id="vDem" value="' + h(V.demands.join('; ')) + '"></div>' +
      '<div class="field"><label>Raqobatchi</label><input class="inp" id="vComp" value="' + h(V.competitor) + '"></div>' +
      '<div class="field"><label>Keyingi tashrif</label><input type="date" class="inp" id="vNext" value="' + h(V.nextVisit || '') + '"></div>' +
      '<div class="field"><label>Fikr / izoh</label><textarea class="inp" id="vNotes" rows="2">' + h(V.notes.join('. ')) + '</textarea></div></div>' +
      (V.source !== 'ai' ? '<button class="btn soft full" style="margin-bottom:10px" data-a="vAI">🤖 AI bilan qayta ajratish</button>' : '') +
      '<button class="btn full" data-a="vOk">Tasdiqlash va saqlash</button><div class="small muted" style="margin-top:8px">Tasdiqlansa: fikr yoziladi, keyingi tashrif belgilanadi, buyurtma bo\'lsa buyurtma oynasi ochiladi.</div>'
  };
};

/* ---------- Hisobot ---------- */
PAGES.report = (P) => {
  P.m = P.m || 'day'; P.date = P.date || today(); P.month = P.month || today().slice(0, 7);
  let body = '';
  if (P.m === 'day') {
    const r = Calc.dailyReport(D, P.date);
    body = '<div class="row" style="gap:8px;margin-bottom:12px"><button class="btn sec sm" data-a="repDay" data-d="-1">‹</button><input type="date" class="inp" data-ch="repDate" value="' + P.date + '"><button class="btn sec sm" data-a="repDay" data-d="1">›</button></div>' +
      '<div class="stats">' + stat('Savdo', F(r.sales), 'hero wide', r.orderCount + ' ta buyurtma') + stat("To'lovlar", F(r.payments), '', '', 'ok') + stat('Qaytarilgan', F(r.returned)) +
      stat('Yangi qarz', F(r.newDebt), '', '', r.newDebt ? 'red' : '') + stat("Do'konlar soni", r.shopCount) + stat('Jami qarz', F(r.debtEnd), '', '', 'red') + stat('Jami avans', F(r.avansEnd), '', '', 'ok') +
      stat('Shikoyatlar', r.complaints, '', '', r.complaints ? 'warn' : '') + stat("Yangi do'konlar", r.newShops) + '</div>' +
      (Object.keys(r.paymentsByType).length ? '<div class="card"><h3>To\'lov turlari</h3>' + Object.entries(r.paymentsByType).map(([k, v]) => '<div class="kv"><span>' + Exp.PAYTYPE[k] + '</span><b class="num">' + F(v) + '</b></div>').join('') + '</div>' : '') +
      '<div class="card"><h3>Mahsulotlar</h3>' + (r.products.length ? r.products.map((p, i) => '<div class="kv"><span>' + (i === 0 ? '🏆 ' : '') + h(p.name) + ' <span class="muted">× ' + p.qty + '</span></span><b class="num">' + F(p.sum) + '</b></div>').join('') : '<div class="muted">Sotuv yo\'q</div>') + '</div>' +
      (r.biggestOrder ? '<div class="card"><h3>Eng katta buyurtma</h3><button class="item" style="padding:0" data-a="openOrder" data-id="' + r.biggestOrder.id + '"><div class="grow">№' + r.biggestOrder.no + ' · ' + h(shopName(r.biggestOrder.shopId)) + '</div><b class="num">' + F(r.biggestOrder.total) + '</b></button></div>' : '') +
      (r.recommendations.length ? '<div class="card"><h3>Tavsiyalar</h3>' + r.recommendations.map(x => '<div class="kv"><span class="muted">' + h(shopName(x.shopId)) + '</span><span>' + h(x.text) + '</span></div>').join('') + '</div>' : '') +
      '<div class="btns" style="margin-bottom:10px"><button class="btn" data-a="dayPdf">📄 PDF</button><button class="btn sec" data-a="dayPrint">🖨 Printer</button></div>' +
      '<button class="btn soft full" style="margin-bottom:10px" data-a="summary">📋 Bugungi fikrlarni umumlashtirish</button>';
  } else {
    const r = Calc.monthlyReport(D, P.month);
    body = '<div class="field"><input type="month" class="inp" data-ch="repMonth" value="' + P.month + '"></div>' +
      '<div class="stats">' + stat('Umumiy savdo', F(r.sales), 'hero wide', r.orderCount + ' ta buyurtma') + stat("To'lovlar", F(r.payments), '', '', 'ok') + stat('Qaytarilgan', F(r.returned)) +
      stat("O'rtacha buyurtma", F(r.avgOrder)) + stat('Shikoyatlar', r.complaints, '', '', r.complaints ? 'warn' : '') + stat("Qarz o'sishi", F(r.debtGrowth), '', '', 'red') + stat('Qarz kamayishi', F(r.debtDecrease), '', '', 'ok') + '</div>' +
      '<div class="card"><h3>Kunlar bo\'yicha savdo</h3>' + (r.byDay.map(d => '<div class="kv"><span>' + dS(d.date) + '</span><span class="num">' + F(d.sales) + ' <span class="muted small">/ ' + F(d.payments) + '</span></span></div>').join('') || '<div class="muted">Ma\'lumot yo\'q</div>') + '</div>' +
      '<div class="card"><h3>Mahsulotlar bo\'yicha</h3>' + (r.byProduct.map(p => '<div class="kv"><span>' + h(p.name) + ' <span class="muted">× ' + p.qty + '</span></span><b class="num">' + F(p.sum) + '</b></div>').join('') || '<div class="muted">—</div>') + '</div>' +
      '<div class="card"><h3>Do\'konlar bo\'yicha</h3>' + (r.byShop.map(s => '<div class="kv"><span>' + h(shopName(s.shopId)) + '</span><span class="num">' + F(s.sales) + '</span></div>').join('') || '<div class="muted">—</div>') + '</div>' +
      '<button class="btn full" style="margin-bottom:10px" data-a="monthPdf">📄 Oylik hisobot PDF</button>';
  }
  return {
    title: 'Hisobot',
    html: '<div class="seg"><button class="' + (P.m === 'day' ? 'on' : '') + '" data-a="repMode" data-m="day">Kunlik</button><button class="' + (P.m === 'month' ? 'on' : '') + '" data-a="repMode" data-m="month">Oylik</button></div>' + body +
      '<div class="card"><h3>Boshqa hisobotlar</h3><div class="btns"><button class="btn soft sm" data-a="debtPdf" data-f="A4">📄 Qarzdorlik PDF</button><button class="btn soft sm" data-a="debtPdf" data-f="print">🖨 Qarzdorlik chek</button>' +
      '<button class="btn soft sm" data-a="pricePdf" data-f="A4">📄 Narxlar PDF</button><button class="btn soft sm" data-a="excel">📊 Excel</button></div></div>'
  };
};

/* ---------- Kun oxirida umumlashtirish ---------- */
function summaryFacts(date) {
  const notes = D.notes.filter(n => n.date === date);
  const r = Calc.dailyReport(D, date);
  const groups = TextUz.groupNotes(notes, shopName);
  const competitors = notes.filter(n => n.competitor).map(n => ({ shop: shopName(n.shopId), text: n.competitor }));
  const important = notes.filter(n => n.priority === 'yuqori' && Calc.isComplaint(n)).map(n => ({ shop: shopName(n.shopId), text: (n.shikoyat && n.shikoyat.text) || (n.fikr && n.fikr.text) || '' }));
  const recs = notes.filter(n => n.tavsiya && n.tavsiya.text).map(n => ({ shop: shopName(n.shopId), text: n.tavsiya.text }));
  return { date, shopCount: r.shopCount, noteCount: notes.length, complaints: r.complaints, sales: r.sales, payments: r.payments, orderCount: r.orderCount, groups, competitors, important, recs };
}
PAGES.summary = (P) => {
  P.date = P.date || today();
  const S = summaryFacts(P.date), saved = D.summaries.find(s => s.date === P.date);
  const g = (id) => S.groups.find(x => x.id === id);
  const block = (title, arr, fmt) => '<div class="card"><h3>' + title + '</h3>' + (arr && arr.length ? arr.map(fmt).join('') : '<div class="muted">Yo\'q</div>') + '</div>';
  const itemF = (x) => '<div class="kv"><span class="muted">' + h(x.shop) + '</span><span style="text-align:right">' + h(x.text) + '</span></div>';
  const grp = (id, title) => block(title + (g(id) ? ' (' + g(id).shopCount + " do'kon)" : ''), g(id) ? g(id).items : [], itemF);
  return {
    title: 'Kunlik umumlashtirish',
    html: '<div class="field"><input type="date" class="inp" data-ch="sumDate" value="' + P.date + '"></div>' +
      '<div class="stats">' + stat("Kirilgan do'konlar", S.shopCount) + stat('Yozilgan fikrlar', S.noteCount) + stat('Shikoyatlar', S.complaints, '', '', S.complaints ? 'warn' : '') +
      stat("Eng ko'p muammo", S.groups[0] ? S.groups[0].title : '—') + '</div>' +
      block('Muammolar guruhlari', S.groups, x => '<div class="kv"><span>' + h(x.title) + '</span><b>' + x.shopCount + " do'kon · " + x.count + ' ta</b></div>') +
      grp('narx', "Narx bo'yicha e'tirozlar") + grp('talab', 'Mahsulot talablari') + grp('yetkazish', 'Yetkazib berish muammolari') +
      block('Raqobatchilar', S.competitors, itemF) + block('Muhim shikoyatlar', S.important, itemF) + block('Foydalanuvchi tavsiyalari', S.recs, itemF) +
      '<div class="card"><h3>AI tavsiyasi</h3>' + (saved && saved.ai ? '<div style="white-space:pre-wrap">' + h(saved.ai) + '</div>' : '<div class="muted small">AI faqat yuqoridagi haqiqiy ma\'lumotlardan foydalanadi, raqam to\'qimaydi.</div>') +
      '<button class="btn full" style="margin-top:10px" data-a="aiSummary">🤖 ' + (saved && saved.ai ? 'Qayta yaratish' : 'AI tavsiyasini olish') + '</button></div>' +
      '<div class="btns"><button class="btn sec" data-a="sumCopy">📋 Nusxalash</button><button class="btn sec" data-a="sumPdf">📄 PDF</button></div>'
  };
};
function summaryText(S, ai) {
  const L = ['ORIF BLaknoti — kunlik xulosa ' + dS(S.date), "Kirilgan do'konlar: " + S.shopCount, 'Fikrlar: ' + S.noteCount, 'Shikoyatlar: ' + S.complaints,
    'Savdo: ' + F(S.sales) + " so'm, to'lov: " + F(S.payments) + " so'm", ''];
  S.groups.forEach(g => L.push(g.title + ': ' + g.shopCount + " do'kon (" + [...new Set(g.items.map(i => i.shop))].join(', ') + ')'));
  if (S.competitors.length) L.push('', 'Raqobatchilar:', ...S.competitors.map(c => '- ' + c.shop + ': ' + c.text));
  if (S.recs.length) L.push('', 'Tavsiyalar:', ...S.recs.map(c => '- ' + c.shop + ': ' + c.text));
  if (ai) L.push('', 'AI tavsiyasi:', ai);
  return L.join('\n');
}

/* ---------- Sozlamalar ---------- */
PAGES.settings = () => {
  const s = D.settings;
  return {
    title: 'Sozlamalar',
    html: '<div class="card"><h3>Foydalanuvchi</h3><div class="field"><label>Ism</label><input class="inp" id="st_name" value="' + h(s.userName) + '"></div>' +
      '<label class="row" style="gap:10px;font-weight:650;margin-bottom:12px"><input type="checkbox" id="st_bio" style="width:24px;height:24px" ' + (s.bio ? 'checked' : '') + '> Barmoq izi / yuz bilan kirish</label>' +
      '<div class="btns"><button class="btn" data-a="stSave">Saqlash</button><button class="btn sec" data-a="stPin">Parolni o\'zgartirish</button></div></div>' +
      '<div class="card"><h3>Ovoz va AI</h3><div class="field"><label>Ovoz tili</label><select class="inp" id="st_lang"><option value="uz-UZ" ' + (s.voiceLang === 'uz-UZ' ? 'selected' : '') + '>O\'zbekcha</option><option value="ru-RU" ' + (s.voiceLang === 'ru-RU' ? 'selected' : '') + '>Ruscha</option></select></div>' +
      '<div class="field"><label>AI server manzili</label><input class="inp" id="st_url" value="' + h(s.serverUrl) + '" placeholder="https://orif-ai.onrender.com"></div>' +
      '<div class="field"><label>Ilova kaliti (APP_TOKEN)</label><input class="inp" id="st_token" value="' + h(s.appToken) + '"></div>' +
      '<div class="btns"><button class="btn" data-a="stSaveAI">Saqlash</button><button class="btn sec" data-a="stTestAI">Tekshirish</button></div>' +
      '<div class="small muted" style="margin-top:8px">AI kaliti ilovada emas, serverda saqlanadi. Internet bo\'lmasa lokal tuzatish ishlaydi.</div></div>' +
      '<div class="card"><h3>Printer</h3><div class="seg">' + [['58', '58 mm'], ['80', '80 mm'], ['A4', 'A4']].map(([k, l]) => '<button class="' + (s.printer === k ? 'on' : '') + '" data-a="stPrinter" data-p="' + k + '">' + l + '</button>').join('') + '</div>' +
      '<div class="small muted">"Printer" tugmasi chek PDF yaratib ulashish oynasini ochadi. Wi-Fi printer uchun "Chop etish"ni, Bluetooth 58/80 mm termoprinter uchun bepul <b>RawBT</b> ilovasini tanlang.</div></div>' +
      '<div class="card"><h3>Mahsulotlar</h3><button class="btn sec full" data-a="products">📦 Mahsulotlar ro\'yxati</button></div>' +
      '<div class="card"><h3>Zaxira nusxa</h3><div class="small muted" style="margin-bottom:10px">' + (Svc.isNative ? 'Avtomatik zaxira: Fayllar → Documents → OrifBlaknoti' + (s.lastBackup ? ' (oxirgi: ' + h(s.lastBackup) + ')' : '') : 'Brauzerda avtomatik zaxira yo\'q') + '</div>' +
      '<div class="btns"><button class="btn" data-a="bkZip">🗜 ZIP zaxira</button><button class="btn sec" data-a="bkJson">{ } JSON</button>' +
      '<button class="btn sec" data-a="excel">📊 Excel</button><button class="btn sec" data-a="bkRestore">♻️ Tiklash</button></div>' +
      '<div class="small muted" style="margin-top:8px">Zaxirani Telegram yoki kompyuterga yuboring. Ilova o\'chsa, "Tiklash" orqali qaytarasiz.</div></div>' +
      '<div class="card"><h3>Boshqa</h3><div class="btns"><button class="btn soft" data-a="demo">Demo ma\'lumot</button><button class="btn soft" data-a="lockNow">🔒 Qulflash</button></div>' +
      '<button class="btn red full" style="margin-top:10px" data-a="wipe">Barcha ma\'lumotlarni o\'chirish</button></div>' +
      '<div class="empty small">ORIF BLaknoti 1.0 · muallif: ORIF</div>'
  };
};

/* ================= AMALLAR ================= */
const A = {};
A.modalBg = (d, el, e) => { if (e.target === el) closeModal(); };
A.openShop = (d) => go('shop', { id: d.id });
A.newShop = () => go('shopForm', {});
A.editShop = (d) => go('shopForm', { id: d.id });
A.shopF = (d) => { top().params.f = d.f; refresh(); };
A.shopTab = (d) => { top().params.tab = d.t; refresh(); };
A.products = () => go('products', {});
A.newProduct = () => go('productForm', {});
A.editProduct = (d) => go('productForm', { id: d.id });
A.markVisit = (d) => { addVisit(d.id); save(); toast('Tashrif belgilandi'); refresh(); };
A.tgOpen = (d, el, e) => { e.preventDefault(); const p = d.p.replace(/[^\d+]/g, ''); location.href = 'https://t.me/' + (p.startsWith('+') ? p : '+' + p); };

A.sfGps = async () => {
  try { const g = await busy('GPS aniqlanmoqda...', Svc.gps); curF().gps = g; $('gpsTxt').textContent = g.lat + ', ' + g.lng; }
  catch (e) { toast(e.message); }
};
function readShopForm() {
  const s = curF();
  ['name', 'owner', 'phone', 'telegram', 'region', 'address', 'nextVisit', 'note', 'level'].forEach(k => { if ($('sf_' + k)) s[k] = val('sf_' + k).trim(); });
  s.debtLimit = mval('sf_debtLimit'); s.openingDebt = mval('sf_openingDebt');
}
A.sfPhoto = async (d) => { readShopForm(); const img = await Svc.pickImage(!!d.c); if (img) { curF()._photo = img; refresh(); } };
A.sfSave = async () => {
  readShopForm(); const s = curF();
  if (!s.name) return toast("Do'kon nomini kiriting");
  if (D.shops.some(x => x.id !== s.id && TextUz.norm(x.name) === TextUz.norm(s.name))) return toast("Bu nomli do'kon bor");
  if (s._photo) { const pid = s.photoId || 'ph_' + uid(); await Store.putPhoto(pid, s._photo); s.photoId = pid; delete s._photo; }
  if (s.id) { const i = D.shops.findIndex(x => x.id === s.id); D.shops[i] = s; }
  else { s.id = 's' + uid(); s.code = 'D-' + String(++D.counters.shop).padStart(4, '0'); s.created = today() + ' ' + nowHM(); s.prices = s.prices || {}; D.shops.push(s); }
  save(); toast('Saqlandi');
  const isNew = !top().params.id;
  back();
  // buyurtma/to'lov formasidan kelingan bo'lsa, yangi do'kon avtomatik tanlanadi
  setTimeout(() => {
    const st = top(); if (isNew && st.params.F && 'shopId' in st.params.F && !st.params.F.shopId) { st.params.F.shopId = s.id; refresh(); }
  }, 60);
};
A.sfDelete = () => {
  const s = curF();
  const n = D.orders.filter(o => o.shopId === s.id).length + D.payments.filter(p => p.shopId === s.id).length;
  if (!confirm(s.name + " o'chirilsinmi?" + (n ? '\nUning ' + n + ' ta buyurtma/to\'lovi ham o\'chadi.' : ''))) return;
  ['orders', 'payments', 'returns', 'notes', 'visits'].forEach(k => D[k] = D[k].filter(x => x.shopId !== s.id));
  D.shops = D.shops.filter(x => x.id !== s.id); Store.delPhoto(s.photoId);
  save(); toast("O'chirildi"); history.go(-2);
};

function readProdForm() {
  const p = curF();
  ['name', 'category', 'brand', 'unit', 'pack', 'note'].forEach(k => p[k] = val('pf_' + k).trim());
  p.price = mval('pf_price'); p.minPrice = mval('pf_minPrice'); p.cost = mval('pf_cost');
  const st = val('pf_stock').replace(',', '.').trim(); p.stock = st === '' ? '' : (parseFloat(st) || 0);
  p.active = $('pf_active').checked;
}
A.pfPhoto = async (d) => { readProdForm(); const img = await Svc.pickImage(!!d.c); if (img) { curF()._photo = img; refresh(); } };
A.pfSave = async () => {
  readProdForm(); const p = curF();
  if (!p.name) return toast('Mahsulot nomini kiriting');
  if (!(p.price > 0)) return toast('Sotuv narxini kiriting');
  if (p.minPrice && p.minPrice > p.price) return toast('Minimal narx sotuv narxidan katta bo\'lmasin');
  if (p._photo) { const pid = p.photoId || 'ph_' + uid(); await Store.putPhoto(pid, p._photo); p.photoId = pid; delete p._photo; }
  if (p.id) D.products[D.products.findIndex(x => x.id === p.id)] = p; else { p.id = 'p' + uid(); D.products.push(p); }
  save(); toast('Saqlandi'); back();
};

/* --- buyurtma --- */
A.newOrder = (d) => go('orderForm', { F: newOrderF(d.shop || (top().p === 'shop' ? top().params.id : '')) });
A.pickOrderShop = (d) => { curF().shopId = d.id; curF().lines.forEach(l => { const p = product(l.productId); if (p && !l._fixedPrice) l.price = priceFor(d.id, p); }); render(true); };
A.changeOrderShop = () => { readOrderSide(curF()); curF().shopId = ''; render(true); };
A.addLine = (d) => {
  const Fo = curF(); readOrderSide(Fo);
  const p = product(d.id); const ex = Fo.lines.find(l => l.productId === p.id);
  if (ex) ex.qty = (Calc.qtyMilli(ex.qty) + 1000) / 1000;
  else Fo.lines.push({ productId: p.id, name: p.name, qty: 1, price: priceFor(Fo.shopId, p), discount: 0, minPrice: p.minPrice || 0 });
  refresh();
};
A.delLine = (d) => { const Fo = curF(); readOrderSide(Fo); Fo.lines.splice(+d.i, 1); refresh(); };
A.qty = (d) => {
  const Fo = curF(); const l = Fo.lines[+d.i];
  l.qty = Math.max(0, (Calc.qtyMilli(l.qty) + (+d.d) * 1000) / 1000);
  const inp = document.querySelector('[data-in="lineQty"][data-i="' + d.i + '"]'); if (inp) inp.value = l.qty;
  updateOrderTotals();
};
A.saveOrder = () => {
  const Fo = curF(); readOrderSide(Fo);
  const lines = Fo.lines.map(l => ({ productId: l.productId, name: l.name, qty: Calc.qtyMilli(l.qty) / 1000, price: I(l.price), discount: I(l.discount), minPrice: I(l.minPrice) }));
  const tot = Calc.orderTotals(lines);
  const old = Fo.id ? D.orders.find(o => o.id === Fo.id) : null;
  // omborda mavjud qoldiq (tahrirda eski buyurtma miqdori qaytib qo'shiladi)
  const stockOf = (pid) => {
    const p = product(pid); if (!p || p.stock === '' || p.stock == null) return null;
    let m = Calc.qtyMilli(p.stock);
    if (old && old.status !== 'bekor') old.lines.filter(l => l.productId === pid).forEach(l => m += Calc.qtyMilli(l.qty));
    return m / 1000;
  };
  const v = Calc.validateOrder({ shopId: Fo.shopId, lines, total: tot.total, paid: Fo.paid, returned: Fo.returned }, Fo.status === 'bekor' ? null : stockOf);
  if (!v.ok) return toast(v.errors.join('\n'), 4500);
  if (v.warnings.length && !confirm('Diqqat:\n' + v.warnings.join('\n') + '\n\nBaribir saqlansinmi?')) return;
  const noteV = tfVal(Fo, 'note');
  if (old) {
    if (old.status !== 'bekor') applyStock(old.lines, +1);
    D.payments = D.payments.filter(p => !(p.orderId === old.id && p.fromOrder));
    D.returns = D.returns.filter(r => !(r.orderId === old.id && r.fromOrder));
  }
  const id = old ? old.id : 'o' + uid();
  const o = { id, no: old ? old.no : String(++D.counters.order).padStart(4, '0'), shopId: Fo.shopId, date: Fo.date, time: Fo.time, created: Fo.created || Date.now(),
    lines: lines.map(({ minPrice, ...l }) => l), totalQty: tot.totalQty, discount: tot.discount, total: tot.total, status: Fo.status,
    note: noteV ? noteV.text : '', noteOriginal: noteV ? noteV.original : '', paid: I(Fo.paid), returned: I(Fo.returned) };
  o.prevDebt = prevDebtFor(o.shopId, id, Calc.key(o));
  o.newDebt = Calc.remainingDebt(o.prevDebt, o.status === 'bekor' ? 0 : o.total, o.returned, o.paid);
  if (o.status !== 'bekor') applyStock(o.lines, -1);
  if (o.paid > 0) D.payments.push({ id: 'y' + uid(), no: ++D.counters.payment, shopId: o.shopId, orderId: id, fromOrder: true, date: o.date, time: o.time, created: o.created + 1, type: Fo.payType, amount: o.paid, parts: [], note: 'Buyurtma №' + o.no, photoId: '' });
  if (o.returned > 0) D.returns.push({ id: 'r' + uid(), shopId: o.shopId, orderId: id, fromOrder: true, date: o.date, time: o.time, created: o.created + 1, lines: [], total: o.returned, note: 'Buyurtma №' + o.no });
  if (old) D.orders[D.orders.findIndex(x => x.id === id)] = o; else D.orders.push(o);
  addVisit(o.shopId, o.date);
  save();
  toast('Buyurtma saqlandi. ' + Calc.debtLabel(o.newDebt).text, 3500);
  replace('order', { id });
};
A.openOrder = (d) => go('order', { id: d.id });
const orderById = (id) => D.orders.find(o => o.id === id);
A.oCopy = async (d) => { const o = orderById(d.id); await Svc.copy(Exp.orderText(o, shop(o.shopId))); toast('Nusxalandi'); };
A.oTg = async (d) => { const o = orderById(d.id); await Svc.sendTelegram(Exp.orderText(o, shop(o.shopId))); toast('Matn nusxalandi. Telegram ochilmasa, kerakli chatga joylang.', 3500); };
A.oShare = async (d) => { const o = orderById(d.id); await Svc.shareText(Exp.orderText(o, shop(o.shopId)), 'Buyurtma №' + o.no); };
A.oPdf = (d) => { const o = orderById(d.id); outPdf(Exp.orderPdf(o, shop(o.shopId), 'A4'), 'buyurtma-' + o.no + '.pdf'); };
A.oPrint = (d) => { const o = orderById(d.id); printDoc(f => Exp.orderPdf(o, shop(o.shopId), f), 'chek-buyurtma-' + o.no); };
A.oStatus = (d) => {
  const o = orderById(d.id); if (o.status === d.s) return;
  if (d.s === 'bekor' && !confirm("Buyurtma bekor qilinsinmi? Tovar omborga qaytadi, qarzdan ayiriladi. Olingan to'lov saqlanib qoladi.")) return;
  if (o.status === 'bekor' && d.s !== 'bekor') applyStock(o.lines, -1);
  if (o.status !== 'bekor' && d.s === 'bekor') applyStock(o.lines, +1);
  o.status = d.s; o.newDebt = Calc.remainingDebt(o.prevDebt, o.status === 'bekor' ? 0 : o.total, o.returned, o.paid);
  save(); refresh();
};
A.oEdit = (d) => {
  const o = orderById(d.id);
  const Fo = Object.assign(newOrderF(o.shopId), JSON.parse(JSON.stringify({ id: o.id, no: o.no, lines: o.lines, paid: o.paid, returned: o.returned, status: o.status, date: o.date, time: o.time, created: o.created })));
  const lp = D.payments.find(p => p.orderId === o.id && p.fromOrder); if (lp) Fo.payType = lp.type;
  Fo.lines.forEach(l => { const p = product(l.productId); l.minPrice = p ? p.minPrice : 0; });
  Fo.t = { note: { text: o.note || '', original: o.noteOriginal || o.note || '', fixed: !!o.noteOriginal && o.noteOriginal !== o.note } };
  go('orderForm', { F: Fo });
};

/* --- to'lov --- */
function newPayF(shopId) { return { id: '', shopId: shopId || '', type: 'naqd', amount: 0, parts: [{ type: 'naqd', amount: 0 }, { type: 'click', amount: 0 }], usdText: '', rate: 0, date: today(), time: nowHM(), t: {}, q: '', photoId: '' }; }
A.newPay = (d) => go('payForm', { F: newPayF(d.shop || (top().p === 'shop' ? top().params.id : '')) });
A.pickPayShop = (d) => { curF().shopId = d.id; render(true); };
A.changePayShop = () => { readPay(curF()); curF().shopId = ''; render(true); };
A.payType = (d) => { const Fp = curF(); readPay(Fp); Fp.type = d.t; refresh(); };
A.addPart = () => { readPay(curF()); curF().parts.push({ type: 'naqd', amount: 0 }); refresh(); };
A.delPart = (d) => { readPay(curF()); curF().parts.splice(+d.i, 1); refresh(); };
A.payPhoto = async (d) => { readPay(curF()); const img = await Svc.pickImage(!!d.c); if (img) { curF()._photo = img; refresh(); } };
A.savePay = async () => {
  const Fp = curF(); readPay(Fp);
  const amount = payAmount(Fp);
  if (!(amount > 0)) return toast("To'lov summasini kiriting");
  if (Fp.type === 'dollar' && !(Fp.rate > 0)) return toast('Dollar kursini kiriting');
  if (Fp.type === 'aralash' && Fp.parts.filter(x => I(x.amount) > 0).length < 1) return toast("Aralash to'lov qismlarini kiriting");
  const noteV = tfVal(Fp, 'note');
  const old = Fp.id ? D.payments.find(p => p.id === Fp.id) : null;
  const p = { id: old ? old.id : 'y' + uid(), no: old ? old.no : ++D.counters.payment, shopId: Fp.shopId, orderId: old ? old.orderId : '', fromOrder: old ? old.fromOrder : false,
    date: Fp.date, time: Fp.time, created: old ? old.created : Date.now(), type: Fp.type, amount,
    parts: Fp.type === 'aralash' ? Fp.parts.filter(x => I(x.amount) > 0).map(x => ({ type: x.type, amount: I(x.amount) })) : [],
    usd: Fp.type === 'dollar' ? Math.round(parseFloat(String(Fp.usdText).replace(',', '.')) * 100) : 0, rate: Fp.type === 'dollar' ? I(Fp.rate) : 0,
    note: noteV ? noteV.text : '', noteOriginal: noteV ? noteV.original : '', photoId: Fp.photoId || '' };
  if (Fp._photo) { const pid = p.photoId || 'ph_' + uid(); await Store.putPhoto(pid, Fp._photo); p.photoId = pid; }
  if (p.type === 'dollar') D.settings.lastRate = p.rate;
  if (old) D.payments[D.payments.findIndex(x => x.id === old.id)] = p; else D.payments.push(p);
  addVisit(p.shopId, p.date); save();
  const after = bal(p.shopId);
  toast("To'lov saqlandi. " + Calc.debtLabel(after).text, 3500);
  replace('payView', { id: p.id });
};
PAGES.payView = (P) => {
  const p = D.payments.find(x => x.id === P.id); if (!p) return { title: "To'lov", html: empty('Topilmadi') };
  const after = Calc.shopBalance(D, p.shopId, Calc.key(p));
  return {
    title: "To'lov",
    html: '<div class="stats"><div class="stat hero wide"><div class="l">' + h(shopName(p.shopId)) + ' · ' + dS(p.date) + ' ' + h(p.time) + '</div><div class="v num">' + F(p.amount) + " so'm</div><div class=\"small\">" + h(Exp.PAYTYPE[p.type]) + '</div></div></div>' +
      '<div class="card">' + Calc.paymentParts(p).map(x => '<div class="kv"><span>' + Exp.PAYTYPE[x.type] + '</span><b class="num">' + F(x.amount) + '</b></div>').join('') +
      (p.usd ? '<div class="kv"><span>Dollar</span><span class="num">$' + (p.usd / 100).toFixed(2) + ' × ' + F(p.rate) + '</span></div>' : '') +
      '<div class="kv"><span>To\'lovdan keyin</span>' + debtHTML(after, true) + '</div>' + (p.note ? '<div class="kv"><span>Izoh</span><span>' + h(p.note) + '</span></div>' : '') + '</div>' +
      (p.photoId ? '<img class="photo" data-photo="' + p.photoId + '" alt="Chek">' : '') +
      '<div class="btns"><button class="btn" data-a="payPrint" data-id="' + p.id + '">🖨 Chek</button><button class="btn sec" data-a="payPdf" data-id="' + p.id + '">📄 PDF</button>' +
      '<button class="btn sec" data-a="payShare" data-id="' + p.id + '">📤 Ulashish</button><button class="btn soft" data-a="payEdit" data-id="' + p.id + '">✏️ Tahrir</button></div>'
  };
};
A.openPay = (d) => go('payView', { id: d.id });
const payText = (p) => "ORIF BLaknoti\nTo'lov: " + shopName(p.shopId) + '\nSana: ' + dS(p.date) + ' ' + p.time + '\nSumma: ' + F(p.amount) + " so'm (" + Exp.PAYTYPE[p.type] + ')\n' + Calc.debtLabel(Calc.shopBalance(D, p.shopId, Calc.key(p))).text.replace('Qarz:', 'Qolgan qarz:');
A.payShare = async (d) => { const p = D.payments.find(x => x.id === d.id); await Svc.shareText(payText(p)); };
A.payPdf = (d) => { const p = D.payments.find(x => x.id === d.id); outPdf(Exp.paymentPdf(p, shop(p.shopId), Calc.shopBalance(D, p.shopId, Calc.key(p)), 'A4'), 'tolov-' + p.no + '.pdf'); };
A.payPrint = (d) => { const p = D.payments.find(x => x.id === d.id); printDoc(f => Exp.paymentPdf(p, shop(p.shopId), Calc.shopBalance(D, p.shopId, Calc.key(p)), f), 'chek-tolov-' + p.no); };
A.payEdit = (d) => {
  const p = D.payments.find(x => x.id === d.id);
  const Fp = Object.assign(newPayF(p.shopId), JSON.parse(JSON.stringify(p)));
  if (p.type === 'aralash') Fp.parts = JSON.parse(JSON.stringify(p.parts)); else Fp.parts = newPayF().parts;
  Fp.usdText = p.usd ? (p.usd / 100).toFixed(2) : '';
  Fp.t = { note: { text: p.note || '', original: p.noteOriginal || p.note || '', fixed: false } };
  go('payForm', { F: Fp });
};
A.delPay = () => {
  const Fp = curF(); if (!confirm("To'lov o'chirilsinmi?")) return;
  D.payments = D.payments.filter(p => p.id !== Fp.id); save(); toast("O'chirildi"); history.go(-2);
};

/* --- qaytarish --- */
A.newReturn = (d) => go('returnForm', { F: { shopId: d.shop || (top().p === 'shop' ? top().params.id : ''), lines: [], date: today(), t: {}, q: '' } });
A.pickRetShop = (d) => { curF().shopId = d.id; render(true); };
A.retAdd = (d) => {
  const Fr = curF(); const p = product(d.id); const ex = Fr.lines.find(l => l.productId === p.id);
  if (ex) ex.qty = (Calc.qtyMilli(ex.qty) + 1000) / 1000; else Fr.lines.push({ productId: p.id, name: p.name, qty: 1, price: priceFor(Fr.shopId, p) });
  refresh();
};
A.retDel = (d) => { curF().lines.splice(+d.i, 1); refresh(); };
A.retQty = (d) => { const l = curF().lines[+d.i]; l.qty = Math.max(0, (Calc.qtyMilli(l.qty) + (+d.d) * 1000) / 1000); refresh(); };
A.saveReturn = () => {
  const Fr = curF(); Fr.date = val('rf_date') || today();
  const lines = Fr.lines.filter(l => Calc.qtyMilli(l.qty) > 0).map(l => ({ productId: l.productId, name: l.name, qty: Calc.qtyMilli(l.qty) / 1000, price: I(l.price) }));
  if (!lines.length) return toast('Qaytgan mahsulotni tanlang');
  const total = Calc.orderTotals(lines).total;
  if (!(total > 0)) return toast('Narxni tekshiring');
  const n = tfVal(Fr, 'note');
  D.returns.push({ id: 'r' + uid(), shopId: Fr.shopId, orderId: '', date: Fr.date, time: nowHM(), created: Date.now(), lines, total, note: n ? n.text : '', noteOriginal: n ? n.original : '' });
  applyStock(lines, +1); addVisit(Fr.shopId, Fr.date); save();
  toast('Qaytarish saqlandi: ' + F(total) + " so'm. " + Calc.debtLabel(bal(Fr.shopId)).text, 3500); back();
};

/* --- fikrlar --- */
A.newNote = (d) => go('noteForm', { F: newNoteF(d.shop || (top().p === 'shop' ? top().params.id : '')) });
A.pickNoteShop = (d) => { curF().shopId = d.id; render(true); };
A.noteTag = (d) => { const Fn = curF(); readNote(Fn); const i = Fn.tags.indexOf(d.t); if (i >= 0) Fn.tags.splice(i, 1); else Fn.tags.push(d.t); refresh(); };
A.notePri = (d) => { readNote(curF()); curF().priority = d.p; refresh(); };
A.noteNext = (d) => { $('nf_next').value = addDays(today(), +d.d); };
function readNote(Fn) { if ($('nf_date')) { Fn.product = val('nf_product'); Fn.competitor = val('nf_competitor').trim(); Fn.nextVisit = val('nf_next'); Fn.date = val('nf_date') || today(); } }
A.saveNote = () => {
  const Fn = curF(); readNote(Fn);
  const n = { id: Fn.id || 'n' + uid(), shopId: Fn.shopId, date: Fn.date, time: Fn.time || nowHM(), created: Fn.created || Date.now(), tags: Fn.tags.slice(),
    fikr: tfVal(Fn, 'fikr'), shikoyat: tfVal(Fn, 'shikoyat'), qoshimcha: tfVal(Fn, 'qoshimcha'), tavsiya: tfVal(Fn, 'tavsiya'),
    product: Fn.product, competitor: Fn.competitor, priority: Fn.priority, nextVisit: Fn.nextVisit };
  if (!n.tags.length && !n.fikr && !n.shikoyat && !n.qoshimcha && !n.tavsiya && !n.competitor) return toast('Kamida bitta fikr yoki tugma tanlang');
  const i = D.notes.findIndex(x => x.id === n.id); if (i >= 0) D.notes[i] = n; else D.notes.push(n);
  if (n.nextVisit) { const s = shop(n.shopId); if (s) s.nextVisit = n.nextVisit; }
  addVisit(n.shopId, n.date); save(); toast('Saqlandi'); back();
};
A.openNote = (d) => {
  const n = D.notes.find(x => x.id === d.id);
  const Fn = Object.assign(newNoteF(n.shopId), JSON.parse(JSON.stringify(n)));
  Fn.t = {}; ['fikr', 'shikoyat', 'qoshimcha', 'tavsiya'].forEach(k => { if (n[k]) Fn.t[k] = { text: n[k].text, original: n[k].original, fixed: n[k].original !== n[k].text }; });
  go('noteForm', { F: Fn });
};
A.delNote = () => { if (!confirm("O'chirilsinmi?")) return; D.notes = D.notes.filter(x => x.id !== curF().id); save(); back(); };
A.noteF = (d) => { top().params.f = d.f; refresh(); };
A.ordF = (d) => { top().params.f = d.f; refresh(); };

/* --- matn maydoni: mikrofon va tuzatish --- */
A.tfMic = async (d) => {
  const Fx = curF(); const s = tfState(Fx, d.k);
  const ta = document.querySelector('[data-tf="' + d.k + '"]'); if (ta) s.text = ta.value;
  try {
    const heard = await Svc.listen(D.settings.voiceLang);
    if (!heard) return toast('Hech narsa eshitilmadi');
    logVoice(heard, top().p + ':' + d.k);
    s.text = (s.text ? s.text.trim() + ' ' : '') + heard;
    s.original = s.fixed ? (s.original ? s.original + ' ' : '') + heard : s.text;
    if (ta) ta.value = s.text;
  } catch (e) { toast(e.message || 'Ovoz tanilmadi. Internetni tekshiring.', 3500); }
};
A.tfFix = (d) => {
  const Fx = curF(); const s = tfState(Fx, d.k);
  const ta = document.querySelector('[data-tf="' + d.k + '"]'); if (ta) s.text = ta.value;
  if (!s.text.trim()) return toast('Avval matn yozing');
  const original = s.fixed ? (s.original || s.text) : s.text;
  FX = { key: d.k, original, corrected: TextUz.localFix(s.text) };
  fixModal();
};
A.fxLocal = () => { FX.corrected = TextUz.localFix(FX.original); $('fxText').value = FX.corrected; toast('Lokal tuzatildi'); };
A.fxAI = async () => {
  try { const r = await busy('AI to\'g\'rilayapti...', () => Svc.ai(D.settings, '/api/correct', { text: FX.original })); FX.corrected = r.text || FX.corrected; $('fxText').value = FX.corrected; }
  catch (e) { FX.corrected = TextUz.localFix(FX.original); $('fxText').value = FX.corrected; toast('AI ishlamadi: ' + e.message + '. Lokal tuzatish qo\'llandi.', 4000); }
};
A.fxRevert = () => { FX.corrected = FX.original; $('fxText').value = FX.original; };
A.fxOk = () => {
  const s = tfState(curF(), FX.key); s.text = $('fxText').value.trim(); s.original = FX.original; s.fixed = true;
  closeModal(); setTimeout(refresh, 30);
};

/* --- ovoz bilan yozish (bosh sahifa) --- */
A.voiceMain = async () => {
  let text;
  try { text = await Svc.listen(D.settings.voiceLang); } catch (e) { return toast(e.message || 'Ovoz tanilmadi', 3500); }
  if (!text) return toast('Hech narsa eshitilmadi');
  logVoice(text, 'asosiy');
  openVoice(text);
};
function openVoice(text) {
  const r = TextUz.parseVoice(text, D.shops, D.products, today());
  go('voice', { V: { raw: text, source: 'local', shopId: r.shop ? r.shop.id : '', lines: r.lines.map(l => ({ productId: l.productId, qty: l.qty, price: l.price || 0 })),
    demands: r.demands, competitor: r.competitor, nextVisit: r.nextVisit ? r.nextVisit.date : '', notes: r.notes, tags: r.tags } });
}
function readVoice(V) {
  if (!$('vShop')) return;
  V.shopId = val('vShop'); V.demands = val('vDem').split(';').map(s => s.trim()).filter(Boolean); V.competitor = val('vComp').trim();
  V.nextVisit = val('vNext'); V.notes = val('vNotes').split(/\.\s*/).map(s => s.trim()).filter(Boolean);
}
A.vDel = (d) => { const V = top().params.V; readVoice(V); V.lines.splice(+d.i, 1); refresh(); };
A.vAI = async () => {
  const V = top().params.V; readVoice(V);
  try {
    const r = await busy('AI ajratayapti...', () => Svc.ai(D.settings, '/api/parse', { text: V.raw, today: today(), shops: D.shops.map(s => s.name), products: D.products.map(p => p.name) }));
    const sh = r.shop ? TextUz.findShop(r.shop, D.shops) : null;
    V.shopId = sh ? sh.shop.id : V.shopId;
    V.lines = (r.lines || []).map(l => { const p = TextUz.findProduct(l.product || '', D.products); return p ? { productId: p.id, qty: +l.qty || 1, price: I(l.price) } : null; }).filter(Boolean);
    V.demands = r.demands || []; V.competitor = r.competitor || ''; V.nextVisit = /^\d{4}-\d{2}-\d{2}$/.test(r.nextVisit || '') ? r.nextVisit : V.nextVisit;
    V.notes = r.notes || []; V.source = 'ai'; refresh();
  } catch (e) { toast('AI ishlamadi: ' + e.message, 4000); }
};
A.vOk = () => {
  const V = top().params.V; readVoice(V);
  if (!V.shopId) return toast("Do'konni tanlang");
  const texts = [];
  if (V.demands.length) texts.push("So'radi: " + V.demands.join(', '));
  if (V.notes.length) texts.push(V.notes.join('. '));
  const tags = V.tags || [];
  if (texts.length || V.competitor || V.nextVisit || tags.length) {
    D.notes.push({ id: 'n' + uid(), shopId: V.shopId, date: today(), time: nowHM(), created: Date.now(), tags,
      fikr: texts.length ? { text: texts.join('. '), original: V.raw } : null, shikoyat: null, qoshimcha: null, tavsiya: null,
      product: '', competitor: V.competitor, priority: 'past', nextVisit: V.nextVisit, voice: true });
  }
  if (V.nextVisit) shop(V.shopId).nextVisit = V.nextVisit;
  addVisit(V.shopId); save();
  const lines = V.lines.map(l => { const p = product(l.productId); return p ? { productId: p.id, name: p.name, qty: l.qty, price: l.price || priceFor(V.shopId, p), discount: 0, minPrice: p.minPrice || 0 } : null; }).filter(Boolean);
  if (lines.length) { toast('Fikr saqlandi. Buyurtmani tekshirib saqlang.'); replace('orderForm', { F: newOrderF(V.shopId, lines) }); }
  else { toast('Saqlandi'); back(); }
};

/* --- hisobot va PDF --- */
A.repMode = (d) => { top().params.m = d.m; refresh(); };
A.repDay = (d) => { const P = top().params; P.date = addDays(P.date, +d.d); refresh(); };
async function outPdf(doc, name) {
  try { const r = await Svc.shareFile(name, Exp.pdfBase64(doc), { mime: 'application/pdf', title: 'PDF' }); if (r.saved) toast('Saqlandi: ' + r.saved, 3000); }
  catch (e) { toast('PDF saqlanmadi: ' + e.message, 4000); }
}
// Printer: tanlangan o'lchamda chek PDF → ulashish oynasi (Chop etish yoki RawBT)
async function printDoc(build, name) {
  const f = D.settings.printer || '80';
  try { await Svc.shareFile(name + '-' + f + '.pdf', Exp.pdfBase64(build(f)), { mime: 'application/pdf', title: 'Printerga yuborish' }); }
  catch (e) { toast('Printer ishlamadi, A4 PDF yaratildi', 3500); outPdf(build('A4'), name + '.pdf'); }
}
A.dayPdf = () => { const P = top().params; const r = Calc.dailyReport(D, P.date); const s = D.summaries.find(x => x.date === P.date); outPdf(Exp.dailyPdf(r, shopName, s && s.ai ? 'AI tavsiyasi: ' + s.ai : '', 'A4'), 'kunlik-' + P.date + '.pdf'); };
A.dayPrint = () => { const P = top().params; const r = Calc.dailyReport(D, P.date); printDoc(f => Exp.dailyPdf(r, shopName, '', f), 'kunlik-' + P.date); };
A.monthPdf = () => { const P = top().params; outPdf(Exp.monthlyPdf(Calc.monthlyReport(D, P.month), shopName), 'oylik-' + P.month + '.pdf'); };
function debtRows() { return D.shops.map(s => ({ name: s.name, region: s.region, phone: s.phone, limit: s.debtLimit, bal: bal(s.id) })).filter(r => r.bal !== 0).sort((a, b) => b.bal - a.bal); }
A.debtPdf = (d) => d.f === 'print' ? printDoc(f => Exp.debtPdf(debtRows(), f), 'qarzdorlik-' + today()) : outPdf(Exp.debtPdf(debtRows(), 'A4'), 'qarzdorlik-' + today() + '.pdf');
A.pricePdf = (d) => { const ps = D.products.filter(p => p.active !== false); return d.f === 'print' ? printDoc(f => Exp.pricePdf(ps, f), 'narxlar-' + today()) : outPdf(Exp.pricePdf(ps, 'A4'), 'narxlar-' + today() + '.pdf'); };
A.shopStatement = (d) => {
  const s = shop(d.id);
  const rows = [];
  D.orders.filter(o => o.shopId === s.id && o.status !== 'bekor').forEach(o => rows.push({ k: Calc.key(o), date: o.date, t: 'Buyurtma №' + o.no, plus: o.total, minus: 0 }));
  D.payments.filter(p => p.shopId === s.id).forEach(p => rows.push({ k: Calc.key(p), date: p.date, t: "To'lov (" + Exp.PAYTYPE[p.type] + ')', plus: 0, minus: p.amount }));
  D.returns.filter(r => r.shopId === s.id).forEach(r => rows.push({ k: Calc.key(r), date: r.date, t: 'Qaytarish', plus: 0, minus: r.total }));
  rows.sort((a, b) => a.k.localeCompare(b.k));
  outPdf(Exp.statementPdf(s, rows, I(s.openingDebt)), 'akt-' + s.code + '-' + today() + '.pdf');
};
A.excel = async () => {
  try { const b64 = await busy('Excel tayyorlanmoqda...', async () => Exp.excelAll(D)); const r = await Svc.shareFile('orif-blaknoti-' + today() + '.xlsx', b64, { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); if (r.saved) toast('Saqlandi: ' + r.saved); }
  catch (e) { toast('Excel xatosi: ' + e.message, 4000); }
};

/* --- umumlashtirish --- */
A.summary = () => go('summary', {});
A.aiSummary = async () => {
  const P = top().params; const S = summaryFacts(P.date);
  if (!S.noteCount && !S.shopCount) return toast("Bu kunda ma'lumot yo'q");
  try {
    const facts = JSON.parse(JSON.stringify(S)); facts.groups = facts.groups.map(g => ({ title: g.title, shopCount: g.shopCount, count: g.count, examples: g.items.slice(0, 8).map(i => i.shop + ': ' + i.text) }));
    const r = await busy('AI tahlil qilmoqda...', () => Svc.ai(D.settings, '/api/summary', { facts }));
    const i = D.summaries.findIndex(x => x.date === P.date); const rec = { date: P.date, ai: r.text, created: Date.now() };
    if (i >= 0) D.summaries[i] = rec; else D.summaries.push(rec);
    save(); refresh();
  } catch (e) { toast('AI ishlamadi: ' + e.message + '. Lokal xulosa ekranda turibdi.', 4500); }
};
A.sumCopy = async () => { const P = top().params; const s = D.summaries.find(x => x.date === P.date); await Svc.copy(summaryText(summaryFacts(P.date), s && s.ai)); toast('Nusxalandi'); };
A.sumPdf = () => { const P = top().params; const s = D.summaries.find(x => x.date === P.date); outPdf(Exp.dailyPdf(Calc.dailyReport(D, P.date), shopName, summaryText(summaryFacts(P.date), s && s.ai), 'A4'), 'xulosa-' + P.date + '.pdf'); };

/* --- sozlamalar --- */
A.stSave = async () => {
  D.settings.userName = val('st_name').trim() || D.settings.userName;
  const want = $('st_bio').checked;
  if (want && !D.settings.bio) {
    if (!(await Svc.bioAvailable())) { $('st_bio').checked = false; return toast('Telefonda barmoq izi sozlanmagan'); }
    try { await Svc.bioVerify(); } catch (e) { $('st_bio').checked = false; return toast('Tasdiqlanmadi'); }
  }
  D.settings.bio = want; save(); toast('Saqlandi');
};
A.stPin = () => { lockUI('change'); };
A.stSaveAI = () => { D.settings.serverUrl = val('st_url').trim(); D.settings.appToken = val('st_token').trim(); save(); toast('Saqlandi'); };
A.stTestAI = async () => {
  A.stSaveAI();
  try { const r = await busy('Tekshirilmoqda...', () => Svc.ai(D.settings, '/api/correct', { text: 'narhi qimat' })); toast('AI ishlayapti: "' + r.text + '"', 4000); }
  catch (e) { toast('Ulanmadi: ' + e.message, 4500); }
};
A.stPrinter = (d) => { D.settings.printer = d.p; save(); refresh(); };
A.demo = () => {
  if (D.shops.length && !confirm("Demo do'kon va mahsulotlar mavjud ma'lumotlarga qo'shilsinmi?")) return;
  const tmp = Store.demo(Store.empty(), today());
  tmp.shops.forEach(s => { if (!D.shops.some(x => x.name === s.name)) { s.code = 'D-' + String(++D.counters.shop).padStart(4, '0'); D.shops.push(s); } });
  tmp.products.forEach(p => { if (!D.products.some(x => x.name === p.name)) D.products.push(p); });
  save(); toast("Demo ma'lumot qo'shildi");
};
A.lockNow = () => lockUI('login');
A.wipe = async () => {
  if (!confirm("Barcha ma'lumotlar o'chiriladi! Avval zaxira oldingizmi?")) return;
  if (prompt("Tasdiqlash uchun O'CHIRISH deb yozing") !== "O'CHIRISH") return toast('Bekor qilindi');
  const keep = D.settings; D = Store.empty(); D.settings = keep; await Store.clearPhotos(); await Store.save(D, true); toast("O'chirildi"); setTab('home');
};
function backupJSON() { return JSON.stringify(Object.assign({ app: 'orif-blaknoti', exported: new Date().toISOString() }, D)); }
A.bkJson = async () => { const r = await Svc.shareFile('orif-blaknoti-' + today() + '.json', backupJSON(), { isText: true, mime: 'application/json' }); if (r.saved) toast('Saqlandi: ' + r.saved); };
A.bkZip = async () => {
  try {
    const b64 = await busy('ZIP tayyorlanmoqda...', async () => Exp.zipBackup(JSON.parse(JSON.stringify(D)), await Store.allPhotos()));
    const r = await Svc.shareFile('orif-blaknoti-zaxira-' + today() + '.zip', b64, { mime: 'application/zip', title: 'Zaxira' });
    D.settings.lastBackup = dS(today()) + ' ' + nowHM(); save(); if (r.saved) toast('Saqlandi: ' + r.saved, 3000);
  } catch (e) { toast('Zaxira xatosi: ' + e.message, 4000); }
};
A.bkRestore = () => {
  const i = document.createElement('input'); i.type = 'file'; i.accept = '.zip,.json,application/zip,application/json,*/*';
  i.onchange = async () => {
    const f = i.files[0]; if (!f) return;
    try {
      let data, photos = {};
      if (/\.zip$/i.test(f.name) || f.type.includes('zip')) ({ data, photos } = await Exp.readZip(await f.arrayBuffer()));
      else data = JSON.parse(await f.text());
      if (!data || !Array.isArray(data.shops) || !Array.isArray(data.orders)) throw new Error("Bu ORIF BLaknoti zaxirasi emas");
      if (!confirm(data.shops.length + " ta do'kon, " + data.orders.length + " ta buyurtma tiklanadi. Hozirgi ma'lumotlar almashtiriladi. Davom etilsinmi?")) return;
      const keepLogin = { userName: D.settings.userName, pinHash: D.settings.pinHash, bio: D.settings.bio };
      delete data.app; delete data.exported;
      D = Store.migrate(data); Object.assign(D.settings, keepLogin);
      await Store.clearPhotos(); for (const id in photos) await Store.putPhoto(id, photos[id]);
      await Store.save(D, true); toast('Tiklandi', 3000); setTab('home');
    } catch (e) { toast('Tiklanmadi: ' + e.message, 4500); }
  };
  i.click();
};

/* ================= voqealar ================= */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const fn = A[el.dataset.a]; if (fn) fn(el.dataset, el, e);
});
const IN = {
  shopQ: (el) => { top().params.q = el.value; $('shopList').innerHTML = shopListHTML(top().params); },
  prodQ: (el) => { top().params.q = el.value; const pos = el.selectionStart; refresh(); const n = document.querySelector('[data-in="prodQ"]'); n.focus(); n.setSelectionRange(pos, pos); },
  pickQ: (el) => { curF().q = el.value; const pos = el.selectionStart; refresh(); const n = document.querySelector('[data-in="pickQ"]'); n.focus(); n.setSelectionRange(pos, pos); },
  lineQty: (el) => { curF().lines[+el.dataset.i].qty = el.value.replace(',', '.'); updateOrderTotals(); },
  linePrice: (el) => { const l = curF().lines[+el.dataset.i]; l.price = I(el.value); l._fixedPrice = true; updateOrderTotals(); },
  lineDisc: (el) => { curF().lines[+el.dataset.i].discount = I(el.value); updateOrderTotals(); },
  retQtyIn: (el) => { curF().lines[+el.dataset.i].qty = el.value.replace(',', '.'); upRet(); },
  retPrice: (el) => { curF().lines[+el.dataset.i].price = I(el.value); upRet(); },
  partAmt: (el) => { curF().parts[+el.dataset.i].amount = I(el.value); updatePayTotals(); },
  payRecalc: () => updatePayTotals(),
  vQty: (el) => { top().params.V.lines[+el.dataset.i].qty = parseFloat(el.value.replace(',', '.')) || 0; },
  vPrice: (el) => { top().params.V.lines[+el.dataset.i].price = I(el.value); },
  shopPrice: (el) => { const s = shop(el.dataset.sid); s.prices = s.prices || {}; const v = I(el.value); if (v) s.prices[el.dataset.pid] = v; else delete s.prices[el.dataset.pid]; save(); }
};
function upRet() { const e = $('retTotal'); if (e) e.textContent = F(Calc.orderTotals(curF().lines).total); }
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.classList.contains('money')) {           // minglik ajratgich bilan formatlash
    const pos = el.value.length - el.selectionStart; const v = I(el.value);
    el.value = v ? F(v) : ''; const p = Math.max(0, el.value.length - pos); try { el.setSelectionRange(p, p); } catch (x) { }
  }
  if (el.dataset.tf) { const s = tfState(curF(), el.dataset.tf); s.text = el.value; if (!s.fixed) s.original = el.value; }
  if (el.dataset.in && IN[el.dataset.in]) IN[el.dataset.in](el);
  if (el.id === 'of_paid' || el.id === 'of_returned') updateOrderTotals();
  if (el.id === 'pf_amount' || el.id === 'pf_rate') updatePayTotals();
});
const CH = {
  shopRegion: (el) => { top().params.region = el.value; refresh(); },
  repDate: (el) => { top().params.date = el.value || today(); refresh(); },
  repMonth: (el) => { top().params.month = el.value || today().slice(0, 7); refresh(); },
  sumDate: (el) => { top().params.date = el.value || today(); refresh(); },
  partType: (el) => { curF().parts[+el.dataset.i].type = el.value; },
  vProd: (el) => { top().params.V.lines[+el.dataset.i].productId = el.value; }
};
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.ch && CH[el.dataset.ch]) CH[el.dataset.ch](el);
  if (['of_status', 'of_date', 'of_time'].includes(el.id)) updateOrderTotals();
});
$('back').onclick = back;
document.querySelectorAll('#nav button').forEach(b => b.onclick = () => setTab(b.dataset.tab));

/* ================= kirish (parol / barmoq izi) ================= */
let pinBuf = '', pinMode = 'login', pinFirst = '';
function lockUI(mode) {
  pinMode = mode; pinBuf = ''; pinFirst = '';
  const s = D.settings;
  if (mode === 'setup') {
    $('lock').innerHTML = '<div class="lock"><div class="logo">ORIF</div><h1>ORIF BLaknoti</h1><p>Savdo agenti bloknoti. Birinchi sozlash.</p><div class="box">' +
      '<input class="inp" id="lk_name" placeholder="Ismingiz" value="' + h(s.userName || '') + '"><input class="inp" id="lk_p1" type="password" inputmode="numeric" placeholder="Parol (4–8 raqam)">' +
      '<input class="inp" id="lk_p2" type="password" inputmode="numeric" placeholder="Parolni takrorlang">' +
      '<label class="row" style="gap:10px;margin:6px 0 16px;justify-content:center"><input type="checkbox" id="lk_bio" style="width:22px;height:22px"> Barmoq izi / yuz bilan kirish</label>' +
      '<label class="row" style="gap:10px;margin:0 0 16px;justify-content:center"><input type="checkbox" id="lk_demo" checked style="width:22px;height:22px"> Demo mahsulot va do\'konlar</label>' +
      '<button class="btn full" data-a="lkSetup">Boshlash</button></div></div>';
    return;
  }
  const title = mode === 'change' ? (pinFirst ? 'Yangi parolni takrorlang' : 'Yangi parolni kiriting') : 'Parolni kiriting';
  $('lock').innerHTML = '<div class="lock"><div class="logo">ORIF</div><h1>' + h(s.userName || 'ORIF BLaknoti') + '</h1><p id="lkTitle">' + title + '</p>' +
    '<div class="dots" id="dots">' + '<i></i>'.repeat(4) + '</div><div class="pad">' +
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => '<button data-a="pinKey" data-k="' + n + '">' + n + '</button>').join('') +
    (mode === 'login' && s.bio ? '<button data-a="lkBio">👆</button>' : (mode === 'change' ? '<button data-a="lkCancel" style="font-size:16px">Bekor</button>' : '<span></span>')) +
    '<button data-a="pinKey" data-k="0">0</button><button data-a="pinKey" data-k="del">⌫</button></div>' +
    (mode === 'login' ? '<button class="btn" style="margin-top:22px;min-width:180px" data-a="pinOk">Kirish</button>' : '<button class="btn" style="margin-top:22px;min-width:180px" data-a="pinOk">Davom etish</button>') + '</div>';
  if (mode === 'login' && s.bio) setTimeout(A.lkBio, 350);
}
function drawDots() { const n = Math.max(4, pinBuf.length); $('dots').innerHTML = Array.from({ length: n }, (_, i) => '<i class="' + (i < pinBuf.length ? 'f' : '') + '"></i>').join(''); }
A.pinKey = (d) => {
  if (d.k === 'del') pinBuf = pinBuf.slice(0, -1); else if (pinBuf.length < 8) pinBuf += d.k;
  drawDots();
  if (pinMode === 'login' && pinBuf.length >= 4) checkPin(true);
};
async function checkPin(silent) {
  if ((await Svc.hashPin(pinBuf)) === D.settings.pinHash) return unlock();
  if (!silent || pinBuf.length >= 8) { toast("Parol noto'g'ri"); pinBuf = ''; drawDots(); }
}
A.pinOk = async () => {
  if (pinMode === 'login') return checkPin(false);
  if (pinBuf.length < 4) return toast('Kamida 4 ta raqam');
  if (!pinFirst) { pinFirst = pinBuf; pinBuf = ''; drawDots(); $('lkTitle').textContent = 'Yangi parolni takrorlang'; return; }
  if (pinFirst !== pinBuf) { toast('Parollar mos emas'); pinFirst = ''; pinBuf = ''; drawDots(); $('lkTitle').textContent = 'Yangi parolni kiriting'; return; }
  D.settings.pinHash = await Svc.hashPin(pinBuf); save(); toast("Parol o'zgartirildi"); $('lock').innerHTML = '';
};
A.lkCancel = () => { $('lock').innerHTML = ''; };
A.lkBio = async () => { try { await Svc.bioVerify(); unlock(); } catch (e) { /* parol bilan kiriladi */ } };
A.lkSetup = async () => {
  const name = val('lk_name').trim(), p1 = val('lk_p1'), p2 = val('lk_p2');
  if (!name) return toast('Ismingizni yozing');
  if (!/^\d{4,8}$/.test(p1)) return toast("Parol 4–8 ta raqamdan iborat bo'lsin");
  if (p1 !== p2) return toast('Parollar mos emas');
  let bio = $('lk_bio').checked;
  if (bio) { if (!(await Svc.bioAvailable())) { bio = false; toast('Barmoq izi mavjud emas — faqat parol ishlatiladi', 3500); } else { try { await Svc.bioVerify(); } catch (e) { bio = false; } } }
  D.settings.userName = name; D.settings.pinHash = await Svc.hashPin(p1); D.settings.bio = bio;
  if ($('lk_demo').checked && !D.products.length) Store.demo(D, today());
  await Store.save(D, true); unlock();
};
let hiddenAt = 0;
function unlock() { $('lock').innerHTML = ''; render(true); }
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (hiddenAt && Date.now() - hiddenAt > 5 * 60 * 1000 && D && D.settings.pinHash) lockUI('login');   // 5 daqiqadan keyin qayta qulflanadi
});

/* ================= avtomatik zaxira ================= */
let bkTimer = null;
window.onDbSaved = () => {
  if (!Svc.isNative) return;
  clearTimeout(bkTimer);
  bkTimer = setTimeout(async () => {
    try { await Svc.writeDocument('orif-blaknoti-avto-zaxira.json', backupJSON()); D.settings.lastBackup = dS(today()) + ' ' + nowHM(); } catch (e) { }
  }, 4000);
};

/* ================= ishga tushirish ================= */
(async function start() {
  history.replaceState({ n: 1 }, '');
  D = (await Store.load()) || Store.empty();
  netBadge();
  render(true);
  if (!D.settings.pinHash) lockUI('setup'); else lockUI('login');
  window.__orif = { get D() { return D; }, go, openVoice, A, today };
})();
})();
