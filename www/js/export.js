/* ORIF DAFTARI — PDF, printer cheki, Excel, ZIP zaxira, Telegram matni */
(function (root) {
  'use strict';
  const F = (n) => Calc.fmt(n);
  const clean = (s) => String(s == null ? '' : s).replace(/[ʻʼ‘’`´]/g, "'").replace(/−/g, '-');
  const STATUS = { yangi: 'Yangi', tayyor: 'Tayyorlandi', yetkazildi: 'Yetkazildi', qisman: 'Qisman yetkazildi', bekor: 'Bekor qilindi' };
  const PAYTYPE = { naqd: 'Naqd', click: 'Click', payme: 'Payme', bank: 'Bank', karta: 'Karta', dollar: 'Dollar', aralash: "Aralash" };
  const dShort = (iso) => iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '';

  /* ---------- Telegram / nusxalash uchun buyurtma matni ---------- */
  function orderText(o, shop) {
    const L = ['ORIF BLaknoti', 'Buyurtma № ' + o.no, 'Sana: ' + dShort(o.date) + ' ' + (o.time || ''), "Do'kon: " + (shop ? shop.name : ''), ''];
    L.push('Mahsulot | Miqdor | Narx | Jami');
    for (const l of o.lines) {
      const t = Calc.lineTotal(l);
      L.push(l.name + ' | ' + l.qty + ' | ' + F(l.price) + ' | ' + F(t.total) + (t.discount ? ' (chegirma ' + F(t.discount) + ')' : ''));
    }
    L.push('');
    L.push('Oldingi qarz: ' + signed(o.prevDebt));
    L.push('Buyurtma summasi: ' + F(o.total) + " so'm");
    if (o.returned) L.push('Qaytarilgan tovar: ' + F(o.returned) + " so'm");
    L.push("To'langan summa: " + F(o.paid || 0) + " so'm");
    L.push(Calc.debtLabel(o.newDebt).text.replace('Qarz:', 'Qolgan qarz:'));
    if (o.note) L.push('Izoh: ' + o.note);
    return L.join('\n');
  }
  function signed(n) { const l = Calc.debtLabel(n); return l.kind === 'avans' ? 'avans ' + F(l.amount) + " so'm" : F(l.amount) + " so'm"; }

  /* ---------- PDF asoslari ---------- */
  function newDoc(format, heightMm) {
    const { jsPDF } = root.jspdf;
    const fmt = format === 'A4' ? 'a4' : [format === '58' ? 58 : 80, Math.max(60, heightMm || 200)];
    const doc = new jsPDF({ unit: 'mm', format: fmt });
    doc.addFileToVFS('DejaVu.ttf', root.PDF_FONTS.regular); doc.addFont('DejaVu.ttf', 'DejaVu', 'normal');
    doc.addFileToVFS('DejaVu-Bold.ttf', root.PDF_FONTS.bold); doc.addFont('DejaVu-Bold.ttf', 'DejaVu', 'bold');
    doc.setFont('DejaVu', 'normal');
    return doc;
  }
  function header(doc, title, subs, shopName) {
    let y = 15;
    doc.setFontSize(9); doc.setTextColor(120); doc.text('ORIF BLaknoti' + (shopName ? '' : ''), 14, y); y += 7;
    doc.setFont('DejaVu', 'bold'); doc.setFontSize(15); doc.setTextColor(22, 71, 52); doc.text(clean(title), 14, y); y += 7;
    doc.setFont('DejaVu', 'normal'); doc.setFontSize(10); doc.setTextColor(90);
    for (const s of [].concat(subs || [])) { doc.text(clean(s), 14, y); y += 5.2; }
    doc.setTextColor(0); return y + 2;
  }
  function table(doc, y, head, body, foot, cols) {
    doc.autoTable({
      startY: y, head: [head.map(clean)], body: body.map(r => r.map(clean)), foot: foot ? [foot.map(clean)] : undefined, showFoot: 'lastPage',
      theme: 'grid', margin: { left: 14, right: 14 },
      styles: { font: 'DejaVu', fontSize: 9, cellPadding: 1.8, lineColor: [222, 226, 214], lineWidth: 0.2, textColor: [30, 35, 30] },
      headStyles: { font: 'DejaVu', fontStyle: 'bold', fillColor: [22, 71, 52], textColor: 255 },
      footStyles: { font: 'DejaVu', fontStyle: 'bold', fillColor: [246, 241, 228], textColor: [30, 35, 30] },
      columnStyles: cols || {},
      didDrawPage: () => { doc.setFontSize(8); doc.setTextColor(150); doc.text('ORIF BLaknoti · muallif: ORIF', 14, 290); }
    });
    return doc.lastAutoTable.finalY + 6;
  }
  const R = { halign: 'right' };

  /* ---------- Chek (58 / 80 mm) — oddiy qatorlar bilan ---------- */
  function receipt(format, blocks) {
    const w = format === '58' ? 58 : 80, m = 3, fs = format === '58' ? 7.5 : 9;
    const lh = fs * 0.45;
    const measure = newDoc(format, 1000);
    measure.setFontSize(fs);
    const width = w - 2 * m;
    let h = 12;
    for (const b of blocks) {
      if (b.t === 'line') h += 3;
      else if (b.t === 'row') h += lh * Math.max(1, measure.splitTextToSize(clean(b.left), width * 0.62).length);
      else h += lh * measure.splitTextToSize(clean(b.text), width).length + (b.t === 'title' ? 1.5 : 0);
    }
    const doc = newDoc(format, h + 10);
    let y = 7;
    doc.setFontSize(fs);
    for (const b of blocks) {
      if (b.t === 'line') { doc.setDrawColor(120); doc.setLineDashPattern([0.8, 0.8], 0); doc.line(m, y - 1, w - m, y - 1); y += 3; continue; }
      if (b.t === 'row') {
        doc.setFont('DejaVu', b.bold ? 'bold' : 'normal');
        const left = doc.splitTextToSize(clean(b.left), width * 0.62);
        doc.text(left, m, y); doc.text(clean(b.right), w - m, y, { align: 'right' });
        y += lh * left.length + 0.6; continue;
      }
      doc.setFont('DejaVu', b.t === 'title' || b.bold ? 'bold' : 'normal');
      doc.setFontSize(b.t === 'title' ? fs + 2 : fs);
      const lines = doc.splitTextToSize(clean(b.text), width);
      doc.text(lines, b.center ? w / 2 : m, y, b.center ? { align: 'center' } : undefined);
      y += lh * lines.length + (b.t === 'title' ? 2 : 0.6);
      doc.setFontSize(fs);
    }
    return doc;
  }

  /* ---------- Buyurtma ---------- */
  function orderPdf(o, shop, format) {
    if (format && format !== 'A4') {
      const B = [{ t: 'title', text: 'ORIF BLaknoti', center: true }, { t: 'text', text: 'Buyurtma № ' + o.no, center: true },
        { t: 'text', text: dShort(o.date) + ' ' + (o.time || ''), center: true }, { t: 'text', text: "Do'kon: " + (shop ? shop.name : ''), bold: true }, { t: 'line' }];
      for (const l of o.lines) {
        const t = Calc.lineTotal(l);
        B.push({ t: 'row', left: l.name + '\n' + l.qty + ' × ' + F(l.price) + (t.discount ? ' −' + F(t.discount) : ''), right: F(t.total) });
      }
      B.push({ t: 'line' }, { t: 'row', left: 'Jami dona', right: String(o.totalQty) }, { t: 'row', left: 'Buyurtma', right: F(o.total), bold: true },
        { t: 'row', left: 'Oldingi qarz', right: signed(o.prevDebt) });
      if (o.returned) B.push({ t: 'row', left: 'Qaytarildi', right: F(o.returned) });
      B.push({ t: 'row', left: "To'landi", right: F(o.paid || 0) }, { t: 'row', left: Calc.debtLabel(o.newDebt).kind === 'avans' ? 'Avans' : 'Qolgan qarz', right: F(Math.abs(o.newDebt)), bold: true });
      if (o.note) B.push({ t: 'line' }, { t: 'text', text: 'Izoh: ' + o.note });
      B.push({ t: 'line' }, { t: 'text', text: 'Rahmat!', center: true });
      return receipt(format, B);
    }
    const doc = newDoc('A4');
    let y = header(doc, 'Buyurtma № ' + o.no, [dShort(o.date) + ' ' + (o.time || '') + '   Holat: ' + (STATUS[o.status] || o.status),
      "Do'kon: " + (shop ? shop.name + (shop.owner ? ' (' + shop.owner + ')' : '') : '') + (shop && shop.phone ? '   Tel: ' + shop.phone : '')]);
    y = table(doc, y, ['№', 'Mahsulot', 'Miqdor', 'Narx', 'Chegirma', 'Jami'],
      o.lines.map((l, i) => { const t = Calc.lineTotal(l); return [String(i + 1), l.name, String(l.qty), F(l.price), t.discount ? F(t.discount) : '', F(t.total)]; }),
      ['', 'Jami', String(o.totalQty), '', o.discount ? F(o.discount) : '', F(o.total)], { 0: { cellWidth: 8 }, 2: R, 3: R, 4: R, 5: R });
    table(doc, y, ['Hisob-kitob', "So'm"], [
      ['Oldingi qarz', signed(o.prevDebt)], ['Buyurtma summasi', F(o.total)], ['Qaytarilgan tovar', F(o.returned || 0)],
      ["To'langan summa", F(o.paid || 0)]], [Calc.debtLabel(o.newDebt).kind === 'avans' ? 'Avans' : 'Qolgan qarz', F(Math.abs(o.newDebt))], { 1: R });
    if (o.note) { doc.setFontSize(10); doc.text(clean('Izoh: ' + o.note), 14, doc.lastAutoTable.finalY + 8, { maxWidth: 180 }); }
    return doc;
  }

  /* ---------- To'lov cheki ---------- */
  function paymentPdf(p, shop, balanceAfter, format) {
    const parts = Calc.paymentParts(p);
    if (format && format !== 'A4') {
      const B = [{ t: 'title', text: 'ORIF BLaknoti', center: true }, { t: 'text', text: "To'lov cheki № " + (p.no || ''), center: true },
        { t: 'text', text: dShort(p.date) + ' ' + (p.time || ''), center: true }, { t: 'text', text: "Do'kon: " + (shop ? shop.name : ''), bold: true }, { t: 'line' }];
      for (const x of parts) B.push({ t: 'row', left: PAYTYPE[x.type] || x.type, right: F(x.amount) });
      if (p.usd) B.push({ t: 'text', text: '$' + (p.usd / 100).toFixed(2) + ' × ' + F(p.rate) });
      B.push({ t: 'line' }, { t: 'row', left: "Jami to'lov", right: F(p.amount), bold: true }, { t: 'row', left: Calc.debtLabel(balanceAfter).kind === 'avans' ? 'Avans' : 'Qolgan qarz', right: F(Math.abs(balanceAfter)) });
      if (p.note) B.push({ t: 'text', text: 'Izoh: ' + p.note });
      return receipt(format, B);
    }
    const doc = newDoc('A4');
    const y = header(doc, "To'lov cheki", [dShort(p.date) + ' ' + (p.time || ''), "Do'kon: " + (shop ? shop.name : '')]);
    table(doc, y, ["To'lov turi", "So'm"], parts.map(x => [PAYTYPE[x.type] || x.type, F(x.amount)]).concat(p.usd ? [['Dollar: $' + (p.usd / 100).toFixed(2) + ' × ' + F(p.rate), '']] : []),
      ["Jami to'lov", F(p.amount)], { 1: R });
    doc.setFontSize(11); doc.text(clean(Calc.debtLabel(balanceAfter).text), 14, doc.lastAutoTable.finalY + 8);
    return doc;
  }

  /* ---------- Qarzdorlik ro'yxati ---------- */
  function debtPdf(rows, format) {
    let debt = 0, av = 0; rows.forEach(r => { if (r.bal > 0) debt += r.bal; else av -= r.bal; });
    if (format && format !== 'A4') {
      const B = [{ t: 'title', text: 'Qarzdorlik', center: true }, { t: 'text', text: dShort(today()), center: true }, { t: 'line' }];
      rows.forEach(r => B.push({ t: 'row', left: r.name, right: r.bal < 0 ? 'avans ' + F(-r.bal) : F(r.bal) }));
      B.push({ t: 'line' }, { t: 'row', left: 'Jami qarz', right: F(debt), bold: true }, { t: 'row', left: 'Jami avans', right: F(av) });
      return receipt(format, B);
    }
    const doc = newDoc('A4');
    const y = header(doc, 'Qarzdorlik hisoboti', [dShort(today()) + ' holatiga', 'Jami qarz: ' + F(debt) + " so'm   Jami avans: " + F(av) + " so'm"]);
    table(doc, y, ['№', "Do'kon", 'Hudud', 'Telefon', 'Limit', 'Qarz / avans'],
      rows.map((r, i) => [String(i + 1), r.name, r.region || '', r.phone || '', r.limit ? F(r.limit) : '', r.bal < 0 ? 'avans ' + F(-r.bal) : F(r.bal)]),
      ['', 'Jami', '', '', '', F(debt)], { 0: { cellWidth: 8 }, 4: R, 5: R });
    return doc;
  }
  /* ---------- Narxlar ro'yxati ---------- */
  function pricePdf(products, format, shop) {
    const price = (p) => shop && shop.prices && shop.prices[p.id] ? shop.prices[p.id] : p.price;
    if (format && format !== 'A4') {
      const B = [{ t: 'title', text: "Narxlar ro'yxati", center: true }, { t: 'text', text: dShort(today()) + (shop ? ' · ' + shop.name : ''), center: true }, { t: 'line' }];
      products.forEach(p => B.push({ t: 'row', left: p.name, right: F(price(p)) }));
      return receipt(format, B);
    }
    const doc = newDoc('A4');
    const y = header(doc, "Narxlar ro'yxati", [dShort(today()) + (shop ? "   Do'kon: " + shop.name : '')]);
    table(doc, y, ['№', 'Mahsulot', 'Kategoriya', 'Birlik', 'Narx'], products.map((p, i) => [String(i + 1), p.name, p.category || '', p.unit || '', F(price(p))]), null, { 0: { cellWidth: 8 }, 4: R });
    return doc;
  }
  /* ---------- Kunlik hisobot ---------- */
  function dailyPdf(r, shopName, summary, format) {
    const types = Object.entries(r.paymentsByType).map(([k, v]) => [PAYTYPE[k] || k, F(v)]);
    if (format && format !== 'A4') {
      const B = [{ t: 'title', text: 'Kunlik hisobot', center: true }, { t: 'text', text: dShort(r.date), center: true }, { t: 'line' },
        { t: 'row', left: 'Savdo', right: F(r.sales), bold: true }, { t: 'row', left: 'Buyurtmalar', right: String(r.orderCount) },
        { t: 'row', left: "To'lovlar", right: F(r.payments) }];
      types.forEach(([a, b]) => B.push({ t: 'row', left: '  ' + a, right: b }));
      B.push({ t: 'row', left: 'Qaytarildi', right: F(r.returned) }, { t: 'row', left: 'Yangi qarz', right: F(r.newDebt) },
        { t: 'row', left: 'Jami qarz', right: F(r.debtEnd) }, { t: 'row', left: 'Jami avans', right: F(r.avansEnd) },
        { t: 'row', left: "Do'konlar", right: String(r.shopCount) }, { t: 'row', left: 'Shikoyatlar', right: String(r.complaints) });
      if (r.topProduct) B.push({ t: 'text', text: "Eng ko'p sotilgan: " + r.topProduct.name + ' (' + r.topProduct.qty + ')' });
      return receipt(format, B);
    }
    const doc = newDoc('A4');
    let y = header(doc, 'Kunlik hisobot: ' + dShort(r.date), ['Savdo: ' + F(r.sales) + " so'm   To'lovlar: " + F(r.payments) + " so'm"]);
    y = table(doc, y, ['Ko\'rsatkich', 'Qiymat'], [
      ['Savdo (buyurtmalar summasi)', F(r.sales)], ['Buyurtmalar soni', String(r.orderCount)], ["To'lovlar", F(r.payments)]]
      .concat(types.map(([a, b]) => ['   ' + a, b]))
      .concat([['Qaytarilgan mahsulot', F(r.returned)], ["Bugungi qarz o'zgarishi", (r.netChange >= 0 ? '+' : '') + F(r.netChange)],
        ['Kun oxiridagi jami qarz', F(r.debtEnd)], ['Kun oxiridagi jami avans', F(r.avansEnd)], ["Aylangan do'konlar", String(r.shopCount)],
        ["Yangi do'konlar", String(r.newShops)], ['Shikoyatlar', String(r.complaints)],
        ["Eng ko'p sotilgan", r.topProduct ? r.topProduct.name + ' — ' + r.topProduct.qty + ' / ' + F(r.topProduct.sum) : '—'],
        ['Eng katta buyurtma', r.biggestOrder ? '№' + r.biggestOrder.no + ' ' + shopName(r.biggestOrder.shopId) + ' — ' + F(r.biggestOrder.total) : '—']]), null, { 1: R });
    if (r.products.length) y = table(doc, y, ['Mahsulot', 'Miqdor', 'Summa'], r.products.map(p => [p.name, String(p.qty), F(p.sum)]), null, { 1: R, 2: R });
    if (r.recommendations.length) y = table(doc, y, ["Do'kon", 'Tavsiya'], r.recommendations.map(x => [shopName(x.shopId), x.text]));
    if (summary) { doc.setFontSize(10); const lines = doc.splitTextToSize(clean(summary), 180); if (y > 250) { doc.addPage(); y = 20; } doc.text(lines, 14, y); }
    return doc;
  }
  /* ---------- Oylik hisobot ---------- */
  function monthlyPdf(r, shopName) {
    const doc = newDoc('A4');
    let y = header(doc, 'Oylik hisobot: ' + r.month, ['Umumiy savdo: ' + F(r.sales) + " so'm   Buyurtmalar: " + r.orderCount]);
    y = table(doc, y, ["Ko'rsatkich", 'Qiymat'], [['Umumiy savdo', F(r.sales)], ["To'lovlar", F(r.payments)], ['Qaytarilgan mahsulot', F(r.returned)],
      ["O'rtacha buyurtma", F(r.avgOrder)], ["Qarz o'sishi", F(r.debtGrowth)], ['Qarz kamayishi', F(r.debtDecrease)], ['Shikoyatlar', String(r.complaints)]], null, { 1: R });
    y = table(doc, y, ['Sana', 'Buyurtma', 'Savdo', "To'lov", 'Qaytarish'], r.byDay.map(d => [dShort(d.date), String(d.orders), F(d.sales), F(d.payments), F(d.returned)]),
      ['Jami', String(r.orderCount), F(r.sales), F(r.payments), F(r.returned)], { 1: R, 2: R, 3: R, 4: R });
    y = table(doc, y, ['Mahsulot', 'Miqdor', 'Summa'], r.byProduct.map(p => [p.name, String(p.qty), F(p.sum)]), null, { 1: R, 2: R });
    table(doc, y, ["Do'kon", 'Savdo', "To'lov", 'Qaytarish', "Qarz o'zgarishi"], r.byShop.map(s => [shopName(s.shopId), F(s.sales), F(s.payments), F(s.returned), (s.net >= 0 ? '+' : '') + F(s.net)]),
      null, { 1: R, 2: R, 3: R, 4: R });
    return doc;
  }

  /* ---------- Do'kon bilan solishtirma dalolatnoma (akt) ---------- */
  function statementPdf(shop, rows, opening) {
    const doc = newDoc('A4');
    let run = opening || 0;
    const body = [["Boshlang'ich qarz", '', '', '', F(run)]].concat(rows.map(r => { run += r.plus - r.minus; return [dShort(r.date), r.t, r.plus ? F(r.plus) : '', r.minus ? F(r.minus) : '', F(run)]; }));
    const y = header(doc, shop.name + ' — solishtirma dalolatnoma', [shop.code + (shop.owner ? '   ' + shop.owner : '') + (shop.phone ? '   ' + shop.phone : ''), dShort(today()) + ' holatiga: ' + Calc.debtLabel(run).text]);
    table(doc, y, ['Sana', 'Amal', 'Qarz (+)', "To'lov (−)", 'Qoldiq'], body, ['', 'Yakuniy qoldiq', '', '', F(run)], { 2: R, 3: R, 4: R });
    return doc;
  }

  /* ---------- Excel ---------- */
  function excelAll(db) {
    const X = root.XLSX, wb = X.utils.book_new();
    const shopName = (id) => (db.shops.find(s => s.id === id) || {}).name || '';
    const add = (name, rows) => X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rows.length ? rows : [{ '': "Ma'lumot yo'q" }]), name);
    add("Do'konlar", db.shops.map(s => ({ ID: s.code, Nomi: s.name, Egasi: s.owner, Telefon: s.phone, Telegram: s.telegram, Hudud: s.region, Manzil: s.address,
      GPS: s.gps ? s.gps.lat + ',' + s.gps.lng : '', Daraja: s.level, 'Qarz limiti': s.debtLimit || 0, "Boshlang'ich qarz": s.openingDebt || 0,
      'Hozirgi balans': Calc.shopBalance(db, s.id), 'Keyingi tashrif': s.nextVisit || '' })));
    add('Mahsulotlar', db.products.map(p => ({ Nomi: p.name, Kategoriya: p.category, Brend: p.brand, Birlik: p.unit, Qadoq: p.pack, 'Sotuv narxi': p.price,
      'Minimal narx': p.minPrice, Tannarx: p.cost, 'Ombor qoldig\'i': p.stock, Faol: p.active === false ? "yo'q" : 'ha', Izoh: p.note })));
    add('Buyurtmalar', db.orders.map(o => ({ '№': o.no, Sana: o.date, Vaqt: o.time, "Do'kon": shopName(o.shopId), Holat: STATUS[o.status] || o.status, 'Jami dona': o.totalQty,
      Chegirma: o.discount, Summa: o.total, 'Oldingi qarz': o.prevDebt, "To'langan": o.paid, Qaytarilgan: o.returned, 'Yangi qarz': o.newDebt, Izoh: o.note })));
    const lines = []; db.orders.forEach(o => o.lines.forEach(l => { const t = Calc.lineTotal(l); lines.push({ 'Buyurtma №': o.no, Sana: o.date, "Do'kon": shopName(o.shopId), Mahsulot: l.name, Miqdor: l.qty, Narx: l.price, Chegirma: t.discount, Jami: t.total }); }));
    add('Buyurtma qatorlari', lines);
    add("To'lovlar", db.payments.map(p => ({ Sana: p.date, Vaqt: p.time, "Do'kon": shopName(p.shopId), Summa: p.amount, Turi: PAYTYPE[p.type] || p.type,
      Tafsilot: Calc.paymentParts(p).map(x => (PAYTYPE[x.type] || x.type) + ': ' + x.amount).join('; '), Dollar: p.usd ? p.usd / 100 : '', Kurs: p.rate || '', Izoh: p.note })));
    add('Qaytarishlar', db.returns.map(r => ({ Sana: r.date, "Do'kon": shopName(r.shopId), Tovarlar: (r.lines || []).map(l => l.name + ' ' + l.qty).join('; '), Summa: r.total, Izoh: r.note })));
    add('Fikrlar', db.notes.map(n => ({ Sana: n.date, Vaqt: n.time, "Do'kon": shopName(n.shopId), Fikr: txt(n.fikr), Shikoyat: txt(n.shikoyat), "Qo'shimcha": txt(n.qoshimcha),
      Tavsiya: txt(n.tavsiya), Mahsulot: n.product || '', Raqobatchi: n.competitor || '', Muhimlik: n.priority || '', Belgilar: (n.tags || []).join(', '), 'Keyingi tashrif': n.nextVisit || '' })));
    return X.write(wb, { bookType: 'xlsx', type: 'base64' });
  }
  const txt = (f) => f && f.text ? f.text : '';

  /* ---------- ZIP zaxira ---------- */
  async function zipBackup(db, photos) {
    const z = new root.JSZip();
    z.file('orif-blaknoti.json', JSON.stringify(Object.assign({ app: 'orif-blaknoti', exported: new Date().toISOString() }, db)));
    const f = z.folder('rasmlar');
    for (const id in photos) { const s = photos[id]; if (s && s.indexOf(',') > 0) f.file(id + '.jpg', s.split(',')[1], { base64: true }); }
    return z.generateAsync({ type: 'base64', compression: 'DEFLATE' });
  }
  async function readZip(arrayBuffer) {
    const z = await root.JSZip.loadAsync(arrayBuffer);
    const jf = z.file('orif-blaknoti.json'); if (!jf) throw new Error("ZIP ichida orif-blaknoti.json yo'q");
    const data = JSON.parse(await jf.async('string'));
    const photos = {};
    const files = z.file(/^rasmlar\/.+\.jpg$/);
    for (const f of files) photos[f.name.replace(/^rasmlar\//, '').replace(/\.jpg$/, '')] = 'data:image/jpeg;base64,' + await f.async('base64');
    return { data, photos };
  }
  function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function pdfBase64(doc) { return doc.output('datauristring').split(',')[1]; }

  root.Exp = { statementPdf, orderText, orderPdf, paymentPdf, debtPdf, pricePdf, dailyPdf, monthlyPdf, excelAll, zipBackup, readZip, pdfBase64, STATUS, PAYTYPE, dShort };
})(window);
