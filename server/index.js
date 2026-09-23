/* ORIF BLaknoti — AI server.
   Gemini API kaliti faqat shu serverda (muhit o'zgaruvchisida) saqlanadi, ilovada emas.
   Muhit o'zgaruvchilari:
     GEMINI_API_KEY  — Google AI Studio'dan olingan kalit (majburiy)
     APP_TOKEN       — ilova bilan server orasidagi maxfiy so'z (tavsiya etiladi)
     GEMINI_MODEL    — ixtiyoriy, standart: gemini-flash-latest
     PORT            — Render o'zi beradi */
'use strict';
const http = require('http');

const KEY = process.env.GEMINI_API_KEY || '';
const TOKEN = process.env.APP_TOKEN || '';
const MODELS = [process.env.GEMINI_MODEL || 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite'];
const PORT = process.env.PORT || 3000;

/* ---------- Gemini ---------- */
async function gemini(system, user, json) {
  if (!KEY) throw new Error('Serverda GEMINI_API_KEY sozlanmagan');
  let lastErr;
  for (const model of [...new Set(MODELS)]) {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: Object.assign({ temperature: 0.2 }, json ? { responseMimeType: 'application/json' } : {})
      })
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
      const text = parts.filter(p => !p.thought && p.text).map(p => p.text).join('').trim();
      if (!text) throw new Error('AI bo\'sh javob qaytardi');
      return text;
    }
    lastErr = new Error('Gemini xatosi ' + r.status + ': ' + ((j.error && j.error.message) || '').slice(0, 200));
    if (r.status !== 404 && r.status !== 400) break;   // model topilmasa keyingisini sinaymiz
  }
  throw lastErr;
}
function parseJSON(t) {
  const s = t.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(s);
}

/* ---------- Vazifalar ---------- */
const RULES_CORRECT = `Sen o'zbek tili (lotin yozuvi) muharririsan. Savdo agentining do'kondagi qisqa yozuvini to'g'rila.
Qoidalar:
- Imlo, tinish belgilari va o'zbekcha harflarni (o', g', sh, ch, x/h) to'g'rila.
- Ma'noni O'ZGARTIRMA. Yangi fakt qo'shma. Hech narsani o'chirma.
- Raqamlar, narxlar, miqdorlar, sanalar va o'lchovlarni (g, kg, dona) aynan saqla.
- Mahsulot, brend va do'kon nomlarini o'zgartirma.
- Gapni tabiiy, qisqa va tushunarli qil.
Faqat JSON qaytar: {"text": "to'g'rilangan matn"}`;

const RULES_PARSE = `Sen savdo agentining ovozli gapidan ma'lumot ajratuvchisan. Gap o'zbek tilida.
Berilgan do'konlar va mahsulotlar ro'yxatidan FAQAT mos nomlarni tanla (aynan ro'yxatdagi yozilishida). Topilmasa null yoki bo'sh qoldir.
Raqamlarni so'zdan raqamga aylantir ("ellik ming besh yuz" = 50500). Narxni faqat gapda aytilgan bo'lsa yoz, aks holda null.
"keyingi hafta" = bugundan keyingi dushanba; "ertaga" = bugun+1. Sanani YYYY-MM-DD ko'rinishida ber.
Hech narsa to'qima. Faqat JSON qaytar:
{"shop": string|null, "lines": [{"product": string, "qty": number, "price": number|null}], "demands": [string], "competitor": string, "nextVisit": string|null, "notes": [string]}`;

const RULES_SUMMARY = `Sen savdo menejerining yordamchisisan. Senga savdo agentining BIR KUNLIK haqiqiy ma'lumotlari JSON ko'rinishida beriladi.
Vazifa: o'zbek tilida (lotin) qisqa kunlik xulosa va tavsiya yoz.
Qat'iy qoidalar:
- FAQAT berilgan ma'lumotlardan foydalan. Hech qanday raqam, do'kon, mahsulot yoki fakt to'qima.
- Raqamlarni aynan berilganidek yoz. Hisob-kitob qilma.
- Bir xil muammolarni birlashtir: "N ta do'konda ..." ko'rinishida.
Tuzilishi (oddiy matn, markdown belgilarsiz):
1) Umumiy holat — 1-2 gap.
2) Asosiy muammolar — eng ko'p takrorlangandan boshlab, har biri alohida qatorda "- " bilan.
3) Tavsiyalar — 2-4 ta amaliy qadam, "- " bilan.
Maksimal 900 belgi. Faqat JSON qaytar: {"text": "..."}`;

async function handle(path, body) {
  if (path === '/api/correct') {
    const text = String(body.text || '').slice(0, 4000);
    if (!text.trim()) return { text: '' };
    const r = parseJSON(await gemini(RULES_CORRECT, text, true));
    return { text: String(r.text || text) };
  }
  if (path === '/api/parse') {
    const u = JSON.stringify({ bugun: body.today, dokonlar: (body.shops || []).slice(0, 500), mahsulotlar: (body.products || []).slice(0, 500), gap: String(body.text || '').slice(0, 3000) });
    const r = parseJSON(await gemini(RULES_PARSE, u, true));
    return {
      shop: r.shop || null,
      lines: Array.isArray(r.lines) ? r.lines.filter(l => l && l.product).map(l => ({ product: String(l.product), qty: Number(l.qty) || 1, price: l.price ? Math.round(Number(l.price)) : null })) : [],
      demands: Array.isArray(r.demands) ? r.demands.map(String) : [],
      competitor: r.competitor ? String(r.competitor) : '',
      nextVisit: r.nextVisit || null,
      notes: Array.isArray(r.notes) ? r.notes.map(String) : []
    };
  }
  if (path === '/api/summary') {
    const r = parseJSON(await gemini(RULES_SUMMARY, JSON.stringify(body.facts || {}).slice(0, 20000), true));
    return { text: String(r.text || '') };
  }
  const e = new Error('Topilmadi'); e.status = 404; throw e;
}

/* ---------- oddiy himoya: so'rovlar chegarasi ---------- */
const hits = new Map();
function limited(ip) {
  const now = Date.now(), w = hits.get(ip) || [];
  const recent = w.filter(t => now - t < 60000); recent.push(now); hits.set(ip, recent);
  return recent.length > 30;
}

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Token');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method === 'GET') return send(200, { ok: true, app: 'ORIF BLaknoti AI', key: !!KEY });
  if (req.method !== 'POST') return send(405, { error: 'Faqat POST' });
  if (TOKEN && req.headers['x-app-token'] !== TOKEN) return send(401, { error: "Ilova kaliti (APP_TOKEN) noto'g'ri" });
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (limited(ip)) return send(429, { error: "Juda ko'p so'rov, bir daqiqa kuting" });
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 200000) req.destroy(); });
  req.on('end', async () => {
    try { send(200, await handle(req.url.split('?')[0], JSON.parse(raw || '{}'))); }
    catch (e) { console.error(e.message); send(e.status || 500, { error: e.message }); }
  });
}).listen(PORT, () => console.log('ORIF AI server port ' + PORT));
