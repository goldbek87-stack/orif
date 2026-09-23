/* ORIF DAFTARI — hisob-kitob moduli.
   Qoida: barcha pul summalari so'mda BUTUN son (integer). Kasr son pul uchun ishlatilmaydi.
   Miqdor (qty) kg uchun kasr bo'lishi mumkin — shuning uchun u mingdan bir ulushlarda
   (milli) butun songa aylantirilib hisoblanadi. */
(function (root) {
  'use strict';

  function toInt(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : 0;
    const s = String(v == null ? '' : v).replace(/[^\d-]/g, '');
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : 0;
  }
  // miqdorni 3 xonagacha aniqlikda butun "milli" birlikka o'tkazish
  function qtyMilli(q) {
    const n = typeof q === 'number' ? q : parseFloat(String(q || '').replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n * 1000) : 0;
  }
  // bitta qator: miqdor × narx − chegirma = jami
  function lineTotal(line) {
    const gross = Math.round(qtyMilli(line.qty) * toInt(line.price) / 1000);
    const disc = toInt(line.discount);
    return { gross, discount: disc, total: gross - disc };
  }
  function orderTotals(lines) {
    let qtyM = 0, gross = 0, discount = 0, total = 0;
    for (const l of lines || []) {
      const t = lineTotal(l);
      qtyM += qtyMilli(l.qty); gross += t.gross; discount += t.discount; total += t.total;
    }
    return { totalQty: qtyM / 1000, gross, discount, total };
  }
  // Qarz formulasi: oldingi qarz + yangi buyurtma − qaytarilgan tovar − to'langan summa
  function remainingDebt(prevDebt, orderSum, returned, paid) {
    return toInt(prevDebt) + toInt(orderSum) - toInt(returned) - toInt(paid);
  }
  // natija: qarz yoki avans (manfiy bo'lsa avans)
  function debtLabel(amount) {
    const a = toInt(amount);
    if (a > 0) return { kind: 'qarz', amount: a, text: 'Qarz: ' + fmt(a) + " so'm" };
    if (a < 0) return { kind: 'avans', amount: -a, text: 'Avans: ' + fmt(-a) + " so'm" };
    return { kind: 'nol', amount: 0, text: "Qarz yo'q" };
  }
  function fmt(n) {
    n = toInt(n);
    const s = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (n < 0 ? '−' : '') + s;
  }

  // Buyurtmani saqlashdan oldin tekshirish. stockOf(productId) -> mavjud qoldiq (yoki null)
  function validateOrder(order, stockOf) {
    const errors = [], warnings = [];
    if (!order.shopId) errors.push("Do'kon tanlanmagan");
    const lines = order.lines || [];
    if (!lines.length) errors.push('Mahsulot tanlanmagan');
    const need = {};
    lines.forEach((l, i) => {
      const n = i + 1;
      if (!l.productId && !l.name) errors.push(n + '-qator: mahsulot tanlanmagan');
      if (!(qtyMilli(l.qty) > 0)) errors.push(n + '-qator: miqdor noldan katta bo\'lishi kerak');
      if (!(toInt(l.price) > 0)) errors.push(n + '-qator: narx noto\'g\'ri');
      if (toInt(l.discount) < 0) errors.push(n + '-qator: chegirma manfiy bo\'lishi mumkin emas');
      const t = lineTotal(l);
      if (t.total < 0) errors.push(n + '-qator: chegirma summadan katta');
      if (l.minPrice && toInt(l.price) < toInt(l.minPrice)) warnings.push(n + '-qator: narx minimal narxdan past (' + fmt(l.minPrice) + ')');
      if (l.productId) need[l.productId] = (need[l.productId] || 0) + qtyMilli(l.qty);
    });
    if (stockOf) for (const pid in need) {
      const s = stockOf(pid);
      if (s != null && qtyMilli(s) < need[pid]) warnings.push('Omborda yetarli emas: ' + (lines.find(l => l.productId === pid) || {}).name + ' (qoldiq ' + s + ')');
    }
    // jami summa qayta hisoblanib, saqlangan qiymat bilan solishtiriladi
    const t = orderTotals(lines);
    if (order.total != null && toInt(order.total) !== t.total) errors.push('Jami summa noto\'g\'ri hisoblangan');
    if (toInt(order.paid) < 0 || toInt(order.returned) < 0) errors.push("To'lov yoki qaytarish manfiy bo'lishi mumkin emas");
    return { ok: errors.length === 0, errors, warnings, totals: t };
  }

  /* ---------- Do'kon balansi (ledger) ----------
     balans > 0 — do'kon qarzdor, balans < 0 — avans. */
  const active = (o) => o.status !== 'bekor';
  function shopBalance(db, shopId, uptoKey) {
    let b = 0;
    const within = (x) => !uptoKey || key(x) <= uptoKey;
    for (const o of db.orders) if (o.shopId === shopId && active(o) && within(o)) b += toInt(o.total);
    for (const r of db.returns) if (r.shopId === shopId && within(r)) b -= toInt(r.total);
    for (const p of db.payments) if (p.shopId === shopId && within(p)) b -= toInt(p.amount);
    b += toInt((db.shops.find(s => s.id === shopId) || {}).openingDebt);
    return b;
  }
  function key(x) { return (x.date || '') + ' ' + (x.time || '00:00') + ' ' + String(x.created || 0).padStart(15, '0'); }
  function totalsAll(db, uptoKey) {
    let debt = 0, avans = 0;
    for (const s of db.shops) { const b = shopBalance(db, s.id, uptoKey); if (b > 0) debt += b; else avans -= b; }
    return { debt, avans };
  }

  /* ---------- Kunlik hisobot ---------- */
  function dailyReport(db, date) {
    const orders = db.orders.filter(o => o.date === date && active(o));
    const pays = db.payments.filter(p => p.date === date);
    const rets = db.returns.filter(r => r.date === date);
    const notes = db.notes.filter(n => n.date === date);
    const sales = sum(orders, 'total');
    const payments = sum(pays, 'amount');
    const returned = sum(rets, 'total');
    const byType = {};
    for (const p of pays) for (const part of paymentParts(p)) byType[part.type] = (byType[part.type] || 0) + toInt(part.amount);
    const shops = new Set();
    for (const x of [].concat(orders, pays, rets, notes, db.visits.filter(v => v.date === date))) shops.add(x.shopId);
    const prod = productStats(orders);
    const biggest = orders.slice().sort((a, b) => toInt(b.total) - toInt(a.total))[0] || null;
    const end = totalsAll(db, date + ' 99:99');
    return {
      date, sales, orderCount: orders.length, payments, paymentsByType: byType, returned,
      netChange: sales - returned - payments,              // bugungi qarz o'zgarishi
      newDebt: Math.max(0, sales - returned - payments),
      debtEnd: end.debt, avansEnd: end.avans,
      shopCount: shops.size,
      complaints: notes.filter(isComplaint).length, noteCount: notes.length,
      newShops: db.shops.filter(s => (s.created || '').slice(0, 10) === date).length,
      topProduct: prod[0] || null, products: prod, biggestOrder: biggest,
      recommendations: notes.filter(n => n.tavsiya && n.tavsiya.text).map(n => ({ shopId: n.shopId, text: n.tavsiya.text }))
    };
  }
  /* ---------- Oylik hisobot (month = 'YYYY-MM') ---------- */
  function monthlyReport(db, month) {
    const inM = (x) => (x.date || '').slice(0, 7) === month;
    const orders = db.orders.filter(o => inM(o) && active(o));
    const pays = db.payments.filter(inM), rets = db.returns.filter(inM), notes = db.notes.filter(inM);
    const sales = sum(orders, 'total'), payments = sum(pays, 'amount'), returned = sum(rets, 'total');
    const days = {};
    const day = (d) => days[d] || (days[d] = { date: d, sales: 0, orders: 0, payments: 0, returned: 0 });
    for (const o of orders) { day(o.date).sales += toInt(o.total); day(o.date).orders++; }
    for (const p of pays) day(p.date).payments += toInt(p.amount);
    for (const r of rets) day(r.date).returned += toInt(r.total);
    const shopMap = {};
    const sh = (id) => shopMap[id] || (shopMap[id] = { shopId: id, sales: 0, payments: 0, returned: 0, orders: 0 });
    for (const o of orders) { sh(o.shopId).sales += toInt(o.total); sh(o.shopId).orders++; }
    for (const p of pays) sh(p.shopId).payments += toInt(p.amount);
    for (const r of rets) sh(r.shopId).returned += toInt(r.total);
    let growth = 0, decrease = 0;
    for (const id in shopMap) {
      const s = shopMap[id]; s.net = s.sales - s.returned - s.payments;
      if (s.net > 0) growth += s.net; else decrease -= s.net;
    }
    return {
      month, sales, orderCount: orders.length, payments, returned,
      avgOrder: orders.length ? Math.round(sales / orders.length) : 0,
      byDay: Object.values(days).sort((a, b) => a.date.localeCompare(b.date)),
      byProduct: productStats(orders),
      byShop: Object.values(shopMap).sort((a, b) => b.sales - a.sales),
      debtGrowth: growth, debtDecrease: decrease,
      complaints: notes.filter(isComplaint).length, noteCount: notes.length
    };
  }
  function productStats(orders) {
    const m = {};
    for (const o of orders) for (const l of o.lines || []) {
      const k = l.productId || l.name;
      const x = m[k] || (m[k] = { productId: l.productId, name: l.name, qtyM: 0, sum: 0 });
      x.qtyM += qtyMilli(l.qty); x.sum += lineTotal(l).total;
    }
    return Object.values(m).map(x => ({ productId: x.productId, name: x.name, qty: x.qtyM / 1000, sum: x.sum }))
      .sort((a, b) => b.sum - a.sum || b.qty - a.qty);
  }
  function paymentParts(p) {
    if (p.type === 'aralash' && Array.isArray(p.parts) && p.parts.length) return p.parts;
    return [{ type: p.type || 'naqd', amount: p.amount }];
  }
  // dollar: summa (sent) × kurs → so'm (butun)
  function usdToUzs(usdCents, rate) { return Math.round(toInt(usdCents) * toInt(rate) / 100); }
  const COMPLAINT_TAGS = ['narx_qimmat', 'sifat', 'qadoq', 'kechikdi', 'tugagan'];
  function isComplaint(n) {
    return !!((n.shikoyat && n.shikoyat.text && n.shikoyat.text.trim()) || (n.tags || []).some(t => COMPLAINT_TAGS.includes(t)));
  }
  function sum(arr, f) { let s = 0; for (const x of arr) s += toInt(x[f]); return s; }

  const api = { toInt, qtyMilli, lineTotal, orderTotals, remainingDebt, debtLabel, fmt, validateOrder, shopBalance, totalsAll,
    dailyReport, monthlyReport, productStats, paymentParts, usdToUzs, isComplaint, key, COMPLAINT_TAGS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Calc = api;
})(this);
