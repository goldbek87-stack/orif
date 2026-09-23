// Hisob-kitob testlari: node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../www/js/calc.js');

test("Qarz formulasi: hujjatdagi misol avans chiqaradi", () => {
  const r = C.remainingDebt(40187250, 4994350, 87054, 47000000);
  assert.equal(r, -1905454);
  const l = C.debtLabel(r);
  assert.equal(l.kind, 'avans');
  assert.equal(l.text, "Avans: 1 905 454 so'm");
});
test('Qarz formulasi: oddiy qarz', () => {
  assert.equal(C.remainingDebt(1000000, 500000, 0, 200000), 1300000);
  assert.equal(C.debtLabel(1300000).text, "Qarz: 1 300 000 so'm");
  assert.equal(C.debtLabel(0).kind, 'nol');
});
test("Qarz formulasi: satr ko'rinishidagi summalar", () => {
  assert.equal(C.remainingDebt('40 187 250', '4 994 350', '87 054', '47 000 000'), -1905454);
});
test('Qator jami: miqdor × narx − chegirma', () => {
  assert.deepEqual(C.lineTotal({ qty: 10, price: 50500, discount: 0 }), { gross: 505000, discount: 0, total: 505000 });
  assert.equal(C.lineTotal({ qty: 3, price: 33333, discount: 999 }).total, 99000);
  assert.equal(C.lineTotal({ qty: 1.25, price: 88000 }).total, 110000);   // kg
  assert.equal(C.lineTotal({ qty: 0.1, price: 3 }).total, 0);              // yaxlitlash
});
test("Floating-point xatosi yo'q (0.1+0.2 muammosi)", () => {
  const t = C.orderTotals([{ qty: 0.1, price: 1000000 }, { qty: 0.2, price: 1000000 }]);
  assert.equal(t.total, 300000);
  assert.equal(t.totalQty, 0.3);
});
test('Buyurtma jami: bir nechta qator', () => {
  const t = C.orderTotals([{ qty: 10, price: 50500, discount: 5000 }, { qty: 24, price: 12500 }, { qty: 2, price: 150000, discount: 0 }]);
  assert.equal(t.gross, 505000 + 300000 + 300000);
  assert.equal(t.discount, 5000);
  assert.equal(t.total, 1100000);
  assert.equal(t.totalQty, 36);
});
test('Buyurtma tekshiruvi', () => {
  const bad = C.validateOrder({ shopId: '', lines: [] });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some(e => e.includes("Do'kon")));
  const z = C.validateOrder({ shopId: 's', lines: [{ productId: 'p', name: 'X', qty: 0, price: 100 }] });
  assert.ok(z.errors.some(e => e.includes('miqdor')));
  const neg = C.validateOrder({ shopId: 's', lines: [{ productId: 'p', name: 'X', qty: 1, price: 100, discount: 200 }] });
  assert.ok(neg.errors.some(e => e.includes('chegirma')));
  const wrongTotal = C.validateOrder({ shopId: 's', total: 999, lines: [{ productId: 'p', name: 'X', qty: 2, price: 500 }] });
  assert.ok(wrongTotal.errors.some(e => e.includes('Jami')));
  const stock = C.validateOrder({ shopId: 's', total: 1000, lines: [{ productId: 'p', name: 'X', qty: 2, price: 500 }] }, () => 1);
  assert.equal(stock.ok, true);
  assert.ok(stock.warnings.some(w => w.includes('Omborda')));
});
test("Dollar to'lov kursi butun songa", () => {
  assert.equal(C.usdToUzs(10050, 12750), 1281375);   // 100.50 $ × 12 750
  assert.equal(C.usdToUzs(100, 12745), 12745);
});

function db() {
  return {
    shops: [{ id: 'a', name: 'Aziz Market', created: '2026-09-01 09:00', openingDebt: 40187250 }, { id: 'b', name: 'Baraka', created: '2026-09-23 10:00' }],
    orders: [
      { id: 'o1', shopId: 'a', date: '2026-09-23', time: '10:00', status: 'yetkazildi', total: 4994350, lines: [{ productId: 'p1', name: 'Sharq', qty: 10, price: 499435 }] },
      { id: 'o2', shopId: 'b', date: '2026-09-23', time: '11:00', status: 'yangi', total: 505000, lines: [{ productId: 'p1', name: 'Sharq', qty: 10, price: 50500 }] },
      { id: 'o3', shopId: 'b', date: '2026-09-23', time: '12:00', status: 'bekor', total: 999999, lines: [{ productId: 'p2', name: 'Sir', qty: 1, price: 999999 }] },
      { id: 'o4', shopId: 'b', date: '2026-09-10', time: '12:00', status: 'yetkazildi', total: 200000, lines: [{ productId: 'p2', name: 'Sir', qty: 2, price: 100000 }] },
      { id: 'o5', shopId: 'a', date: '2026-08-30', time: '12:00', status: 'yetkazildi', total: 300000, lines: [{ productId: 'p2', name: 'Sir', qty: 3, price: 100000 }] }
    ],
    payments: [
      { id: 'p1', shopId: 'a', date: '2026-09-23', time: '10:05', amount: 47000000, type: 'aralash', parts: [{ type: 'naqd', amount: 40000000 }, { type: 'click', amount: 7000000 }] },
      { id: 'p2', shopId: 'b', date: '2026-09-23', time: '11:05', amount: 300000, type: 'naqd' },
      { id: 'p3', shopId: 'b', date: '2026-09-11', time: '11:05', amount: 50000, type: 'payme' }
    ],
    returns: [{ id: 'r1', shopId: 'a', date: '2026-09-23', time: '10:03', total: 87054 }],
    notes: [
      { id: 'n1', shopId: 'a', date: '2026-09-23', tags: ['narx_qimmat'], fikr: { text: 'Narxi baland' } },
      { id: 'n2', shopId: 'b', date: '2026-09-23', tags: ['mamnun'], tavsiya: { text: 'Kichik qadoq chiqarish kerak' } }
    ],
    visits: []
  };
}
test('Do\'kon balansi: boshlang\'ich qarz + buyurtma − qaytarish − to\'lov', () => {
  const d = db();
  // a: 40 187 250 + 300 000 (avgust) + 4 994 350 − 87 054 − 47 000 000
  assert.equal(C.shopBalance(d, 'a'), 40187250 + 300000 + 4994350 - 87054 - 47000000);
  // b: 200 000 − 50 000 + 505 000 − 300 000 (bekor qilingan hisobga olinmaydi)
  assert.equal(C.shopBalance(d, 'b'), 355000);
  assert.equal(C.shopBalance(d, 'b', '2026-09-22 99:99'), 150000);
});
test('Kunlik hisobot summalari', () => {
  const r = C.dailyReport(db(), '2026-09-23');
  assert.equal(r.sales, 4994350 + 505000);
  assert.equal(r.orderCount, 2);
  assert.equal(r.payments, 47300000);
  assert.equal(r.returned, 87054);
  assert.equal(r.netChange, 4994350 + 505000 - 87054 - 47300000);
  assert.equal(r.newDebt, 0);
  assert.deepEqual(r.paymentsByType, { naqd: 40300000, click: 7000000 });
  assert.equal(r.shopCount, 2);
  assert.equal(r.complaints, 1);
  assert.equal(r.newShops, 1);
  assert.equal(r.biggestOrder.id, 'o1');
  assert.equal(r.topProduct.name, 'Sharq');
  assert.equal(r.topProduct.qty, 20);
  assert.equal(r.recommendations.length, 1);
  assert.equal(r.debtEnd, 355000);
  assert.equal(r.avansEnd, -(40187250 + 300000 + 4994350 - 87054 - 47000000));
});
test('Oylik hisobot summalari', () => {
  const r = C.monthlyReport(db(), '2026-09');
  assert.equal(r.sales, 4994350 + 505000 + 200000);
  assert.equal(r.orderCount, 3);
  assert.equal(r.payments, 47000000 + 300000 + 50000);
  assert.equal(r.returned, 87054);
  assert.equal(r.avgOrder, Math.round((4994350 + 505000 + 200000) / 3));
  assert.equal(r.byDay.length, 3);
  assert.equal(r.byDay.reduce((s, d) => s + d.sales, 0), r.sales);
  assert.equal(r.byShop.reduce((s, x) => s + x.sales, 0), r.sales);
  assert.equal(r.byProduct.reduce((s, x) => s + x.sum, 0), r.sales);
  const a = r.byShop.find(s => s.shopId === 'a'), b = r.byShop.find(s => s.shopId === 'b');
  assert.equal(a.net, 4994350 - 87054 - 47000000);
  assert.equal(b.net, 705000 - 350000);
  assert.equal(r.debtGrowth, 355000);
  assert.equal(r.debtDecrease, -(4994350 - 87054 - 47000000));
  const aug = C.monthlyReport(db(), '2026-08');
  assert.equal(aug.sales, 300000);
});
