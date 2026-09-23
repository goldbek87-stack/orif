# ORIF BLaknoti — savdo agenti uchun Android ilova

Do'konlar, mahsulotlar, buyurtmalar, to'lovlar, qarz/avans, qaytarishlar, fikr va shikoyatlar, ovoz bilan yozish, AI tavsiya, PDF/Excel/printer va zaxira.
Barcha ma'lumot telefonning o'zida saqlanadi (internetsiz ishlaydi). Faqat ovozni matnga aylantirish va AI uchun internet kerak.

---

## 1. APK'ni yig'ish (GitHub orqali, bepul)

1. GitHub'da yangi repozitoriy oching, masalan `orif-blaknoti`.
2. ZIP ichidagi **hamma narsani** repozitoriyga yuklang ("Add file → Upload files").
3. `.github` papkasi yuklanmay qolsa (ko'p uchraydi):
   - "Add file → Create new file" ni bosing.
   - Nomiga `.github/workflows/build-apk.yml` deb yozing.
   - Ichiga `github-workflow-nusxa.txt` faylidagi matnni joylang va "Commit" bosing.
4. **Actions** bo'limida "APK yig'ish" ishga tushadi (~5–8 daqiqa). Yashil ✅ bo'lgach, pastdagi **orif-blaknoti-apk** ni yuklab oling.
5. ZIP ichidagi `app-debug.apk` ni telefonga o'tkazib o'rnating. "Noma'lum manbalar"ga ruxsat bering.

Yig'ish avval hisob-kitob testlarini ishga tushiradi. Qarz formulasi buzilgan bo'lsa, APK chiqmaydi.

## 2. Birinchi ishga tushirish

- Ismingizni va 4–8 raqamli parolni kiriting.
- Xohlasangiz barmoq izi yoki yuz bilan kirishni yoqing.
- "Demo mahsulot va do'konlar" belgisi 8 ta mahsulot va 3 ta do'kon qo'shadi. Keyin ularni tahrirlashingiz yoki o'chirishingiz mumkin.
- Ilova fonda 5 daqiqadan ko'p tursa, qayta qulflanadi.

## 3. AI server (Render, bepul)

AI kaliti ilova ichida emas, **serverda** saqlanadi.

1. **Gemini kaliti:** https://aistudio.google.com → "Get API key" → "Create API key" → nusxalab oling.
2. **Server:** `server` papkasini alohida GitHub repozitoriyga yuklang (masalan `orif-ai`).
   Ichida `index.js` va `package.json` bo'lishi kerak.
3. https://render.com da GitHub bilan kiring → **New → Web Service** → `orif-ai` repozitoriyni tanlang.
   - Runtime: **Node**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance type: **Free**
4. **Environment** bo'limiga qo'shing:
   - `GEMINI_API_KEY` = Gemini kalitingiz
   - `APP_TOKEN` = o'zingiz o'ylab topgan maxfiy so'z, masalan `orif-2026-xyz`
5. Deploy tugagach manzilni oling (`https://orif-ai.onrender.com` kabi).
6. Ilovada **Sozlama → Ovoz va AI** bo'limiga manzil va APP_TOKEN'ni yozing → **Tekshirish**.

Eslatmalar:
- Bepul Render server 15 daqiqa ishlatilmasa uxlaydi. Birinchi so'rov 30–60 soniya kutadi, keyingilari tez.
- AI ishlamasa ham ilova to'xtamaydi: lokal imlo tuzatish va lokal xulosa ishlayveradi.
- Boshqa Gemini modelini ishlatish uchun `GEMINI_MODEL` o'zgaruvchisini qo'shing. Standart qiymat: `gemini-flash-latest`.

## 4. Printer

**Sozlama → Printer** bo'limida o'lchamni tanlang: 58 mm, 80 mm yoki A4.

"🖨 Printer" tugmasi shu o'lchamda chek PDF yaratib, ulashish oynasini ochadi:
- **Bluetooth termoprinter (58/80 mm):** Play Market'dan bepul **RawBT** ilovasini o'rnating, printerni unda ulang, ulashishda RawBT'ni tanlang.
- **Wi-Fi yoki oddiy printer:** ulashishda "Chop etish" (Print) ni tanlang.

## 5. Zaxira va tiklash

- **Avtomatik:** har o'zgarishdan keyin `Documents/OrifBlaknoti/orif-blaknoti-avto-zaxira.json` yangilanadi.
- **ZIP zaxira:** Sozlama → ZIP zaxira. Ichida barcha ma'lumot va rasmlar bor. Telegram'dagi "Saqlangan xabarlar"ga yuborib qo'ying.
- **Tiklash:** Sozlama → Tiklash → ZIP yoki JSON faylni tanlang.
- **Excel:** barcha jadvallar alohida varaqlarda.

## 6. Ovoz bilan yozish

Bosh sahifadagi katta 🎤 tugmani bosib, masalan shunday deng:

> "Aziz Market o'n dona Sharq oldi, narxini ellik ming besh yuz qilib qo'y, ikki yuz grammlik funchoza so'radi, raqobatchi ikki ming arzon ekan, keyingi hafta yana kiraman."

Ilova do'kon, mahsulot, miqdor, narx, talab, raqobatchi va keyingi tashrif sanasini ajratadi. Siz tekshirib tasdiqlaysiz.

Har bir matn maydonida ikkita tugma bor:
- 🎤 **Gapirish**
- ✍️ **Imloni tuzatish** — lokal yoki AI bilan tuzatadi. Asl matn doim saqlanadi.

## 7. Hisob-kitob qoidasi

```
Qolgan qarz = Oldingi qarz + Buyurtma − Qaytarilgan tovar − To'langan summa
```

Natija manfiy bo'lsa, u **avans** hisoblanadi.
Misol: 40 187 250 + 4 994 350 − 87 054 − 47 000 000 = **Avans: 1 905 454 so'm**.

Barcha summalar butun sonda hisoblanadi, shuning uchun tiyin xatosi bo'lmaydi.

## Fayllar

| Papka / fayl | Vazifasi |
|---|---|
| `www/` | ilovaning o'zi (ekranlar, hisob-kitob, matn, PDF) |
| `www/js/calc.js` | qarz va hisobot formulalari |
| `www/js/text.js` | o'zbekcha sonlar, imlo tuzatish, ovoz tahlili |
| `test/` | avtomatik testlar (`npm test`) |
| `server/` | AI server (Render uchun) |
| `android/` | Android loyiha |
| `.github/workflows/build-apk.yml` | APK yig'ish buyrug'i |

Muallif: ORIF
