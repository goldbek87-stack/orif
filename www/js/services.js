/* ORIF DAFTARI — telefon xizmatlari va AI server bilan aloqa */
(function (root) {
  'use strict';
  const Cap = root.Capacitor;
  const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  const cache = {};
  function plugin(name) {
    if (!isNative) return null;
    if (!cache[name]) cache[name] = (Cap.Plugins && Cap.Plugins[name]) || (Cap.registerPlugin && Cap.registerPlugin(name));
    return cache[name];
  }

  /* ---------- Ovozdan matn (Google, o'zbekcha) ---------- */
  let webRec = null;
  async function listen(lang, onPartial) {
    lang = lang || 'uz-UZ';
    if (isNative) {
      const SR = plugin('SpeechRecognition');
      const perm = await SR.requestPermissions();
      if (perm && perm.speechRecognition && perm.speechRecognition !== 'granted') throw new Error('Mikrofonga ruxsat berilmadi');
      const av = await SR.available();
      if (av && av.available === false) throw new Error('Telefonda Google ovoz xizmati topilmadi');
      // popup: Google oynasi gap tugashi bilan o'zi to'xtaydi va tayyor matnni qaytaradi
      const r = await SR.start({ language: lang, popup: true, maxResults: 1, partialResults: false, prompt: 'Gapiring...' });
      return (r && r.matches && r.matches[0]) || '';
    }
    const W = root.SpeechRecognition || root.webkitSpeechRecognition;
    if (!W) throw new Error('Bu qurilmada ovoz kiritish ishlamaydi');
    return new Promise((res, rej) => {
      webRec = new W(); webRec.lang = lang; webRec.interimResults = true; webRec.continuous = false;
      let text = '';
      webRec.onresult = (e) => { text = ''; for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript; if (onPartial) onPartial(text); };
      webRec.onerror = (e) => rej(new Error(e.error === 'not-allowed' ? 'Mikrofonga ruxsat berilmadi' : 'Ovoz tanilmadi'));
      webRec.onend = () => { webRec = null; res(text.trim()); };
      webRec.start();
    });
  }
  function stopListen() { if (webRec) webRec.stop(); }

  /* ---------- Barmoq izi / yuz orqali kirish ---------- */
  async function bioAvailable() {
    if (!isNative) return false;
    try { const r = await plugin('NativeBiometric').isAvailable({ useFallback: false }); return !!(r && r.isAvailable); } catch (e) { return false; }
  }
  async function bioVerify() {
    await plugin('NativeBiometric').verifyIdentity({ reason: 'ORIF BLaknotiga kirish', title: 'ORIF BLaknoti', subtitle: 'Barmoq izi yoki yuz bilan kiring', negativeButtonText: 'Parol bilan' });
    return true;
  }
  async function hashPin(pin) {
    const s = 'orif-blaknoti:' + pin;
    try {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
    } catch (e) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return 'x' + (h >>> 0).toString(16); }
  }

  /* ---------- Fayllar va ulashish ---------- */
  function b64FromText(t) { return btoa(unescape(encodeURIComponent(t))); }
  // data: base64 (yoki isText=true bo'lsa oddiy matn)
  async function shareFile(filename, data, opts) {
    opts = opts || {};
    if (!isNative) {
      const bytes = opts.isText ? new TextEncoder().encode(data) : Uint8Array.from(atob(data), c => c.charCodeAt(0));
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: opts.mime || 'application/octet-stream' }));
      a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      return { saved: 'Yuklab olindi' };
    }
    const FS = plugin('Filesystem'), SH = plugin('Share');
    const base = { path: filename, data: opts.isText ? data : data };
    if (opts.isText) base.encoding = 'utf8';
    let saved = '';
    try { await FS.writeFile(Object.assign({}, base, { path: 'OrifBlaknoti/' + filename, directory: 'DOCUMENTS', recursive: true })); saved = 'Documents/OrifBlaknoti/' + filename; } catch (e) { }
    if (opts.saveOnly) return { saved };
    const w = await FS.writeFile(Object.assign({}, base, { directory: 'CACHE' }));
    try { await SH.share({ title: filename, files: [w.uri], dialogTitle: opts.title || 'Ulashish' }); }
    catch (e) { if (!/cancel/i.test(String(e && e.message))) { try { await SH.share({ title: filename, url: w.uri }); } catch (e2) { } } }
    return { saved };
  }
  async function writeDocument(filename, text) {
    if (!isNative) return false;
    await plugin('Filesystem').writeFile({ path: 'OrifBlaknoti/' + filename, data: text, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true });
    return true;
  }
  async function shareText(text, title) {
    if (isNative) { try { await plugin('Share').share({ title: title || 'ORIF BLaknoti', text, dialogTitle: 'Ulashish' }); return true; } catch (e) { return false; } }
    if (navigator.share) { try { await navigator.share({ text }); return true; } catch (e) { return false; } }
    await copy(text); return false;
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { } t.remove(); return ok;
    }
  }
  // Telegram: avval matn nusxalanadi, keyin Telegram ochiladi. Ochilmasa matn baribir clipboard'da qoladi.
  async function sendTelegram(text, phone) {
    await copy(text);
    const url = 'tg://msg?text=' + encodeURIComponent(text);
    try { root.location.href = url; return true; } catch (e) { return false; }
  }

  /* ---------- Internet va AI server ---------- */
  function online() { return navigator.onLine !== false; }
  async function ai(settings, path, body) {
    if (!settings.serverUrl) throw new Error('AI server manzili Sozlamada kiritilmagan');
    if (!online()) throw new Error("Internet yo'q");
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 70000);
    try {
      const r = await fetch(settings.serverUrl.replace(/\/+$/, '') + path, {
        method: 'POST', signal: ctl.signal,
        headers: { 'Content-Type': 'application/json', 'X-App-Token': settings.appToken || '' },
        body: JSON.stringify(body)
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || ('Server xatosi: ' + r.status));
      return j;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('AI javob bermadi (vaqt tugadi)');
      throw e;
    } finally { clearTimeout(tm); }
  }

  /* ---------- Rasm: kamera yoki galereyadan, siqib saqlash ---------- */
  function pickImage(capture) {
    return new Promise((res) => {
      const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
      if (capture) i.setAttribute('capture', 'environment');
      i.onchange = () => {
        const f = i.files[0]; if (!f) return res(null);
        const rd = new FileReader();
        rd.onload = () => {
          const img = new Image();
          img.onload = () => {
            const max = 1100, k = Math.min(1, max / Math.max(img.width, img.height));
            const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            res(c.toDataURL('image/jpeg', 0.72));
          };
          img.onerror = () => res(null);
          img.src = rd.result;
        };
        rd.readAsDataURL(f);
      };
      i.click();
    });
  }
  function gps() {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) return rej(new Error('GPS ishlamaydi'));
      navigator.geolocation.getCurrentPosition(p => res({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }),
        e => rej(new Error(e.code === 1 ? 'Joylashuvga ruxsat berilmadi' : 'GPS aniqlanmadi')), { enableHighAccuracy: true, timeout: 20000 });
    });
  }

  root.Svc = { isNative, plugin, listen, stopListen, bioAvailable, bioVerify, hashPin, shareFile, writeDocument, shareText, copy, sendTelegram,
    online, ai, pickImage, gps, b64FromText };
})(window);
