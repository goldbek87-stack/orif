/* ORIF DAFTARI — lokal baza (telefon xotirasida, IndexedDB).
   Asosiy ma'lumotlar bitta yozuvda, rasmlar alohida omborda saqlanadi. */
(function (root) {
  'use strict';
  const DB_NAME = 'orif_daftari', DB_VER = 1, SCHEMA = 2;
  let idb = null;

  function open() {
    return new Promise((res, rej) => {
      if (!('indexedDB' in window)) return rej(new Error('IndexedDB yo\'q'));
      const r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('data')) d.createObjectStore('data');
        if (!d.objectStoreNames.contains('photos')) d.createObjectStore('photos');
      };
      r.onsuccess = () => { idb = r.result; res(idb); };
      r.onerror = () => rej(r.error);
    });
  }
  function tx(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = idb.transaction(store, mode); const s = t.objectStore(store);
      const q = fn(s);
      t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error);
    });
  }
  function empty() {
    return { schema: SCHEMA, settings: { userName: '', pinHash: '', bio: false, serverUrl: '', appToken: '', printer: '80', voiceLang: 'uz-UZ', lastBackup: '' },
      counters: { order: 0, shop: 0, payment: 0 },
      shops: [], products: [], orders: [], payments: [], returns: [], notes: [], visits: [], voiceLogs: [], summaries: [] };
  }
  // eski versiyadagi bazani yangi tuzilmaga o'tkazish
  function migrate(d) {
    const base = empty();
    for (const k in base) if (d[k] === undefined) d[k] = base[k];
    d.settings = Object.assign(base.settings, d.settings || {});
    d.counters = Object.assign(base.counters, d.counters || {});
    if ((d.schema || 1) < 2) {
      // 1 -> 2: to'lovlarda "parts", mahsulotda "active" maydoni
      d.payments.forEach(p => { if (!p.parts) p.parts = []; });
      d.products.forEach(p => { if (p.active === undefined) p.active = true; });
      d.schema = 2;
    }
    return d;
  }
  async function load() {
    try {
      await open();
      const d = await tx('data', 'readonly', s => s.get('main'));
      return d ? migrate(d) : null;
    } catch (e) {
      const raw = localStorage.getItem(DB_NAME);
      return raw ? migrate(JSON.parse(raw)) : null;
    }
  }
  let saveTimer = null, pending = null;
  function save(d, now) {
    pending = d;
    clearTimeout(saveTimer);
    const run = async () => {
      const data = JSON.parse(JSON.stringify(pending));
      try { if (!idb) await open(); await tx('data', 'readwrite', s => s.put(data, 'main')); }
      catch (e) { try { localStorage.setItem(DB_NAME, JSON.stringify(data)); } catch (e2) { } }
      if (root.onDbSaved) root.onDbSaved();
    };
    if (now) return run();
    saveTimer = setTimeout(run, 250);
  }
  async function putPhoto(id, dataUrl) { if (!idb) await open(); return tx('photos', 'readwrite', s => s.put(dataUrl, id)); }
  async function getPhoto(id) { if (!id) return null; if (!idb) await open(); return tx('photos', 'readonly', s => s.get(id)); }
  async function delPhoto(id) { if (!id) return; if (!idb) await open(); return tx('photos', 'readwrite', s => s.delete(id)); }
  async function allPhotos() {
    if (!idb) await open();
    return new Promise((res, rej) => {
      const out = {}; const t = idb.transaction('photos', 'readonly'); const c = t.objectStore('photos').openCursor();
      c.onsuccess = () => { const cur = c.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error);
    });
  }
  async function clearPhotos() { if (!idb) await open(); return tx('photos', 'readwrite', s => s.clear()); }

  function demo(d, today) {
    const P = (name, category, brand, unit, pack, price, minPrice, cost, stock) =>
      ({ id: 'p' + Math.random().toString(36).slice(2, 9), name, category, brand, unit, pack, price, minPrice, cost, stock, note: '', active: true, photoId: '' });
    d.products = [
      P('Sharq setka 700 g', 'Makaron', 'Sharq', 'dona', '700 g', 12500, 11800, 10400, 480),
      P('Salanmiy 700 g', 'Makaron', 'Salanmiy', 'dona', '700 g', 11800, 11000, 9800, 360),
      P('Sir qattiq', 'Sir', 'Mahalliy', 'kg', '1 kg', 88000, 84000, 76000, 60),
      P('Sir yumshoq', 'Sir', 'Mahalliy', 'kg', '1 kg', 72000, 69000, 62000, 45),
      P('Funchuza 150 g', 'Funchoza', 'Orif', 'dona', '150 g', 6500, 6000, 5100, 600),
      P('Funchuza 200 g', 'Funchoza', 'Orif', 'dona', '200 g', 8200, 7700, 6500, 540),
      P('Funchuza 300 g', 'Funchoza', 'Orif', 'dona', '300 g', 11500, 10900, 9300, 420),
      P('Funchuza 400 g', 'Funchoza', 'Orif', 'dona', '400 g', 14900, 14000, 12100, 300)
    ];
    const S = (n, name, owner, phone, region, address, level, limit, open, next) => ({
      id: 's' + Math.random().toString(36).slice(2, 9), code: 'D-' + String(n).padStart(4, '0'), name, owner, phone, telegram: phone,
      region, address, gps: null, photoId: '', level, debtLimit: limit, openingDebt: open, nextVisit: next, prices: {}, note: '',
      created: '2026-01-15 09:00' });
    d.shops = [
      S(1, 'Aziz Market', 'Aziz aka', '+998 90 123 45 67', 'Chilonzor', '9-kvartal, 12-uy', 'A', 50000000, 40187250, today),
      S(2, 'Baraka savdo', 'Bahodir', '+998 93 555 11 22', 'Yunusobod', '4-mavze bozor yonida', 'B', 10000000, 2350000, today),
      S(3, 'Oila do\'koni', 'Nodira opa', '+998 97 700 80 90', 'Sergeli', 'Yangi Sergeli ko\'chasi 5', 'C', 3000000, 0, '')
    ];
    d.counters.shop = 3;
    return d;
  }

  root.Store = { load, save, empty, migrate, demo, putPhoto, getPhoto, delPhoto, allPhotos, clearPhotos, SCHEMA };
})(window);
