const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../www/js/text.js');

test("So'zdagi sonlar raqamga", () => {
  assert.equal(T.wordsToDigits("o'n dona"), '10 dona');
  assert.equal(T.wordsToDigits('ellik ming besh yuz'), '50500');
  assert.equal(T.wordsToDigits('ikki yuz grammlik'), '200 grammlik');
  assert.equal(T.wordsToDigits('bir million ikki yuz ming'), '1200000');
  assert.equal(T.wordsToDigits('150 000'), '150000');
});
test('Lokal imlo tuzatish', () => {
  const r = T.localFix('narhi qimat 200gr lik funchiza sorayapdi yetkazip berish kechikdi');
  assert.equal(r, "Narxi qimmat 200 grammlik funchoza so'rayapti yetkazib berish kechikdi.");
  assert.ok(T.localFix('Sharq 700 g').includes('Sharq 700 g'));  // mahsulot nomi va raqam o'zgarmaydi
});
const shops = [{ id: 's1', name: 'Aziz Market' }, { id: 's2', name: 'Baraka' }];
const products = [
  { id: 'p1', name: 'Sharq setka 700 g' }, { id: 'p2', name: 'Salanmiy 700 g' },
  { id: 'p5', name: 'Funchuza 150 g' }, { id: 'p6', name: 'Funchuza 200 g' }, { id: 'p7', name: 'Funchuza 300 g' }
];
test('Ovozli gap: hujjatdagi misol', () => {
  const r = T.parseVoice("Aziz Market o'n dona Sharq oldi, narxini ellik ming besh yuz qilib qo'y, ikki yuz grammlik funchoza so'radi, raqobatchi ikki ming arzon ekan, keyingi hafta yana kiraman.", shops, products, '2026-09-23');
  assert.equal(r.shop.id, 's1');
  assert.equal(r.lines.length, 1);
  assert.equal(r.lines[0].productId, 'p1');
  assert.equal(r.lines[0].qty, 10);
  assert.equal(r.lines[0].price, 50500);
  assert.equal(r.demands.length, 1);
  assert.match(r.demands[0], /200 grammlik funchoza/);
  assert.equal(r.competitor, "Raqobatchi 2 000 so'm arzon");
  assert.equal(r.nextVisit.date, '2026-09-28');   // keyingi dushanba
});
test("Mahsulotni og'irligi bo'yicha tanlash", () => {
  assert.equal(T.findProduct('funchoza 300 gramm', products).id, 'p7');
  assert.equal(T.findProduct('funchuza', products).id, 'p5');
});
test("Keyingi tashrif sanasi", () => {
  assert.equal(T.visitDate('ertaga kelaman', '2026-09-23').date, '2026-09-24');
  assert.equal(T.visitDate('juma kuni kiraman', '2026-09-23').date, '2026-09-25');
  assert.equal(T.visitDate('3 kundan keyin', '2026-09-23').date, '2026-09-26');
});
test("Bir xil fikrlar bitta guruhga birlashadi", () => {
  const notes = [
    { shopId: 'a', tags: ['narx_qimmat'], fikr: { text: 'narxi baland' } },
    { shopId: 'b', fikr: { text: 'narxni tushiring' } },
    { shopId: 'c', tags: ['raqobatchi_arzon'] },
    { shopId: 'd', tags: ['kechikdi'] }
  ];
  const g = T.groupNotes(notes, id => id);
  assert.equal(g[0].id, 'narx');
  assert.equal(g[0].shopCount, 3);
  assert.ok(g.find(x => x.id === 'yetkazish'));
});
