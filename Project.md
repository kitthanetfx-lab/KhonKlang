# Project.md — สรุปงานที่ทำแล้ว

## 2026-07-14 (01:07)

### แก้ og:url ชี้โดเมนผิด — Facebook Debugger เตือน redirect

**สาเหตุ**: `og:url`/`metadataBase` ใน `layout.tsx` ชี้ `https://glanghub.com` (ไม่มี www) แต่โดเมนหลักปัจจุบันคือ `www.glanghub.com` (non-www ถูก redirect) → Facebook ตาม og:url เจอ redirect วน

**แก้ไข** (`src/app/layout.tsx`): `metadataBase` + `openGraph.url` → `https://www.glanghub.com`

**งานฝั่งผู้ใช้**: Vercel → Domains → glanghub.com เปลี่ยน 307 → 308 Permanent Redirect, แล้วกด "Scrape Again" ใน Facebook Debugger หลัง deploy

### ไฟล์ที่แก้ไข (2026-07-14 01:07)
- `src/app/layout.tsx`

---

## 2026-07-14 (00:25)

### แก้ dark mode ทั้งเว็บ — โซนพื้น var(--ink) พลิกเป็นขาว

**สาเหตุ (anti-pattern เดียวกันทั้งเว็บ)**: โซน "แถบน้ำเงินเข้ม+ตัวอักษรขาว" ใช้ `var(--ink)` เป็นสีพื้นหลัง — dark mode `--ink` พลิกเป็น #f4f7ff (เกือบขาว) → พื้นขาว+อักษรขาว มองไม่เห็น

**แก้ไข** (`src/app/globals.css`):
1. เพิ่มตัวแปร `--navy-band: #10224d` — คงน้ำเงินเข้มทั้ง 2 ธีม พร้อมคอมเมนต์ห้ามใช้ var(--ink) เป็นพื้นหลัง
2. เปลี่ยน 6 จุดจาก `var(--ink)` → `var(--navy-band)`: `.footer`, `.scam-band` (gradient), `.cc-banner` (แถบคุกกี้), `.btn-dark`, `.ss-arrow:hover`, `.rv-av.platform`
3. `.rv-tag` / `.rv-comment` — พื้น `#fff` + ขอบ `#d9e2f2` hardcode → `var(--surface)` + `var(--line)` (เดิมใน dark เป็นอักษรอ่อนบนพื้นขาว)

### ไฟล์ที่แก้ไข (2026-07-14 00:25)
- `src/app/globals.css`

---

## 2026-07-14 (00:06)

### แก้ dark mode contrast ใน consent modal ทั้ง 2 ตัว + โลโก้ dark ตัวจริง

**สาเหตุ**: `ProfileConsentModal` และ `ConsentModal` ใช้ตัวแปร CSS ที่ไม่มีในโปรเจกต์ (`--fg`, `--muted-fg`, `--card`, `--green-50`) → fallback เป็นสีเข้ม (#111, #374151) บนพื้นเข้มของ dark theme ตัวอักษรจม/มองไม่เห็นทุกโซน + ปุ่ม "ไม่ยอมรับ" hardcode `background:#fff`

**แก้ไข** (ทั้ง 2 ไฟล์ ใช้ตัวแปรธีมจริง ปรับตาม light/dark อัตโนมัติ):
- พื้น modal → `var(--surface)` + ขอบ `var(--line)`, การ์ดย่อย → `var(--surface-2)`
- หัวข้อ → `var(--ink)`, เนื้อหา → `var(--ink-2)`, รอง → `var(--muted)`
- ปุ่ม "ไม่ยอมรับ" → พื้นโปร่งใส ขอบ/ตัวอักษรแดง #ef4444
- ปุ่ม "ยอมรับ" disabled → `var(--line-2)` + `var(--faint)`
- checkbox ติ๊กแล้ว → ไฮไลต์เขียว `color-mix(#16a34a 12%)` โปร่งแสง
- `public/logo-dark.png` → แทนที่ placeholder ด้วยไฟล์จริงจากผู้ใช้

### ไฟล์ที่แก้ไข (2026-07-14 00:06)
- `src/components/ProfileConsentModal.tsx`
- `src/components/ConsentModal.tsx`
- `public/logo-dark.png` (ไฟล์จริง)

---

## 2026-07-13 (23:42)

### บังคับกรอกโปรไฟล์หลังล็อกอิน + consent popup + avatar/ชื่อจากแพลตฟอร์ม + โลโก้ dark theme

1. **บังคับกรอกโปรไฟล์ทันทีหลังล็อกอิน** — bridge pages ทั้ง 2 (`auth/line/complete`, `auth/oauth/complete`) เช็คฟิลด์บังคับ (ชื่อ-นามสกุล, เบอร์โทร, บัญชีธนาคาร) ถ้าไม่ครบ → redirect ไป `/profile?returnTo=<หน้าเดิม>` ก่อนเสมอ
2. **ProfileConsentModal** (ไฟล์ใหม่) — popup แจ้งเหตุผลการเก็บข้อมูลก่อนเข้าฟอร์มโปรไฟล์ (เลขบัญชี: ผู้ขาย/คนกลางรับเงินเมื่อดีลสำเร็จ, ผู้ซื้อรับเงินคืนเมื่อมีข้อพิพาท) รูปแบบเดียวกับ ConsentModal สมัครผู้ขาย/คนกลาง responsive ทุกอุปกรณ์ — แสดงเมื่อ `locked && !consentOk` (จำการยอมรับใน sessionStorage `kk.profile_consent`) กดไม่ยอมรับ → กลับหน้าหลัก
3. **ชื่อ+รูปจากแพลตฟอร์ม** — LINE callback เก็บ `pictureUrl` ลง user_metadata (ทั้งสร้างใหม่และ refresh ตอน re-login); `useUser.ts` เพิ่ม `prefs.avatarUrl` + default displayName จาก metadata (displayName/full_name/name); Header แสดงรูป avatar แทนไอคอน; หน้าโปรไฟล์ pf-avatar แสดงรูป + displayName default จากแพลตฟอร์ม
4. **Migration `0013_signup_platform_display_name.sql`** (ใหม่) — trigger สร้าง profiles อ่านชื่อจาก full_name/name (Google) เพิ่มจาก displayName (LINE) — **ต้องรันใน Supabase SQL Editor**
5. **โลโก้หน้าแรกสลับตาม dark theme** — เพิ่ม `/logo-dark.png` (ตอนนี้เป็น copy ของ logo.png ชั่วคราว รอไฟล์จริง), hero render 2 รูป + CSS `.hero-logo-light/.hero-logo-dark` สลับตาม `html[data-theme='dark']`
6. **ข้อ 4 (Google "ไปยัง supabase.co")** — ไม่ใช่โค้ด: ตั้ง Branding ใน Google Cloud OAuth consent screen (App name "กลางฮับ (Glanghub)" + โลโก้ + verify) — ผู้ใช้ดำเนินการเองแล้วบางส่วน

### ไฟล์ที่แก้ไข (2026-07-13 23:42)
- `src/app/auth/line/complete/page.tsx`
- `src/app/auth/oauth/complete/page.tsx`
- `src/components/ProfileConsentModal.tsx` (ใหม่)
- `src/app/profile/page.tsx`
- `src/app/api/auth/line/callback/route.ts`
- `src/lib/useUser.ts`
- `src/components/HeaderAccountActions.tsx`
- `src/app/page.tsx`
- `src/app/globals.css`
- `supabase/migrations/0013_signup_platform_display_name.sql` (ใหม่)
- `public/logo-dark.png` (ใหม่ — placeholder)

---

## 2026-07-13 (22:31)

### แก้ header ไม่แสดงสถานะล็อกอินหลัง LINE login สำเร็จ

**สาเหตุ**: `useUser.ts` → `fetchProfile()` คืน `null` ทันทีถ้าไม่มีแถวในตาราง `profiles` — ผู้ใช้ LINE ที่สร้างผ่าน `admin.createUser` อาจยังไม่มีแถว profiles (ถ้า trigger `0004_profile_on_signup.sql` ยังไม่ได้รันบน DB จริง) → มี session แต่ header แสดงเหมือนไม่ได้ล็อกอิน

**แก้ไข** (`src/lib/useUser.ts`):
1. แยก `fetchProfileRow()` helper + เปลี่ยน `.single()` → `.maybeSingle()`
2. ถ้ามี session แต่ไม่มีแถว profiles → เรียก `POST /api/profile/sync` (ผ่าน `verifyUser` ฝั่ง server จะสร้างแถวให้อัตโนมัติ) แล้ว fetch ใหม่
3. fallback สุดท้าย: คืน AppUser จากข้อมูล session (id, email, displayName จาก user_metadata) → สถานะล็อกอินแสดงเสมอเมื่อมี session

**งานฝั่ง DB (ผู้ใช้ทำเอง)**: รัน `supabase/migrations/0004_profile_on_signup.sql` ใน Supabase SQL Editor เพื่อให้ trigger สร้างแถว profiles อัตโนมัติ (แก้ที่ต้นตอ)

**ตั้งค่าที่ทำไปก่อนหน้าในวันเดียวกัน**: Vercel Domains ตั้ง `glanghub.com` → 307 redirect → `www.glanghub.com` (แก้ปัญหา session อยู่คนละ origin ระหว่าง www/non-www)

### ไฟล์ที่แก้ไข (2026-07-13 22:31)
- `src/lib/useUser.ts`

---

## 2026-07-13 (21:45)

### แก้ LINE login ใช้งานไม่ได้ + เปลี่ยนชื่อหน้าล็อกอิน

1. **แก้บั๊ก LINE login** (`src/app/auth/line/complete/page.tsx` บรรทัด 38) — cookie `line_session_pending` ถูก Next.js URL-encode อัตโนมัติ แต่โค้ด `JSON.parse(raw)` โดยไม่ decode → error `Unexpected token '%' ... is not valid JSON` → แก้เป็น `JSON.parse(decodeURIComponent(raw))`
2. **เปลี่ยนชื่อหน้าล็อกอิน** (`src/app/login/page.tsx` บรรทัด 66) — `login-title` จาก "คนกลาง" → "กลางฮับ"
3. **ตั้งค่านอกโค้ดที่แก้ไปพร้อมกัน (บันทึกไว้อ้างอิง)**:
   - Vercel: `NEXT_PUBLIC_APP_URL` เปลี่ยนจาก `https://khonklang.vercel.app` (deployment ตายแล้ว) → `https://www.glanghub.com` + redeploy
   - LINE Developers Console (channel 2010302438): ลงทะเบียน Callback URL `https://www.glanghub.com/api/auth/line/callback` และ `https://glanghub.com/api/auth/line/callback`

### ไฟล์ที่แก้ไข (2026-07-13)
- `src/app/auth/line/complete/page.tsx`
- `src/app/login/page.tsx`

---

## 2026-07-03 (ต่อ 16)

### ลดขนาด hero title + ปุ่ม "เริ่ม Deal" + หน้า /deal-all

1. **ลดขนาด `.hero-title`** (`src/app/globals.css`) — `clamp(33px, 6.2vw, 58px)` → `clamp(26px, 4.8vw, 44px)`
2. **เพิ่มปุ่ม "เริ่ม Deal"** (`src/app/page.tsx`) — ใต้ hero title ลิงก์ไป `/deal-all`
3. **สร้างหน้า `/deal-all`** (`src/app/deal-all/page.tsx`) — grid 2×2 ขนาด 250×250 ต่อช่อง:
   - `/Deal/trade-m.webp` → `/service/trade` (ซื้อขายผ่านกลาง)
   - `/Deal/drive-m.webp` → `/service/meetup` (นัดรับผ่านกลาง)
   - `/Deal/partner.webp` → `/service/consign` (ฝากขายผ่านกลาง)
   - `/Deal/on-site.webp` → `/service/onsite` (ออนไซต์)

### ไฟล์ที่แก้ไข (2026-07-03 ต่อ 16)
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/app/deal-all/page.tsx` (ไฟล์ใหม่)

---

## 2026-07-02 (ต่อ 15)

### แก้ dark mode contrast — homepage 3 จุด

1. **ปุ่ม "ตรวจสอบเลย"** (`src/app/page.tsx` บรรทัด 168) — เปลี่ยน `color: 'var(--ink)'` → `color: '#10224d'` (hardcode dark blue) เพราะ dark mode `var(--ink)` = `#f4f7ff` (ขาว) บนพื้นขาว (`background:#fff`) มองไม่เห็น
2. **`.ef-node-lb`** (`src/app/globals.css`) — เปลี่ยน `background: color-mix(in srgb, #fff 78%, transparent)` → `background: var(--surface)` ให้ label ผู้ซื้อ/คนกลาง/ผู้ขาย ปรับสีตาม theme
3. **`.ef-float`** (`src/app/globals.css`) — เปลี่ยน `background: color-mix(in srgb, #fff 96%, transparent)` → `background: var(--surface)` ให้ป้าย "เข้ารหัสปลอดภัย" / "ยืนยันตัวตน KYC" ปรับสีตาม theme

### ไฟล์ที่แก้ไข (2026-07-02 ต่อ 15)
- `src/app/page.tsx`
- `src/app/globals.css`

---

## 2026-07-02 (ต่อ 14)

### แก้ chip.is-active มองไม่เห็นใน dark mode

- `.chip.is-active` เปลี่ยน `background: var(--ink)` → `var(--accent)` (สีฟ้า) และ `border-color` เช่นเดียวกัน
- dark mode: `var(--ink)` = `#f4f7ff` (ขาว) + `color:#fff` = ขาวบนขาว → มองไม่เห็น
- แก้แล้ว: ใช้ accent (ฟ้า) เป็น active state ทำงานถูกต้องทั้ง light และ dark mode

### ไฟล์ที่แก้ไข (2026-07-02 ต่อ 14)
- `src/app/globals.css`

---

## 2026-07-02 (ต่อ 13)

### ฟีเจอร์และแก้บัก 6 รายการ

1. **Admin observer mode** — admin เข้าดูดีลได้ read-only (แชท + หลักฐาน) โดยไม่ต้องเป็นคู่สัญญา
2. **ปุ่มกลับไปแชทจากหน้าหลักฐาน** — ต้องทั้ง 2 ฝ่ายกด "ขอกลับไปหน้าแชทใหม่" ก่อน จึงจะ reset evidence_done
3. **แชท iOS scroll** — เปลี่ยน scrollIntoView behavior จาก 'smooth' → 'auto' + เพิ่ม `-webkit-overflow-scrolling: touch` และ `overscroll-behavior: contain` ให้ chat feed
4. **แชท: เลือกหลายรูปพร้อมกัน + อัพโหลดวิดีโอ** — file inputs ในแชทเพิ่ม `multiple`, `accept="image/*,video/*,.pdf"`, handler loop หลายไฟล์, ขยาย limit จาก 10MB → 50MB ต่อไฟล์
5. **หลักฐาน: ไม่จำกัดจำนวน + รองรับวิดีโอ** — evidence upload inputs เพิ่ม `multiple` และ handle หลายไฟล์พร้อมกัน (meetup, seller, buyer)
6. **แก้ layout หลุดเฟรม portrait mobile** — เพิ่ม `overflow-x: hidden` ให้ `.dr-root`

### ไฟล์ที่แก้ไข (2026-07-02 ต่อ 13)
- `src/app/deal/[id]/page.tsx`
- `src/app/api/deals/[id]/route.ts`
- `src/app/globals.css`

---

## 2026-07-02 (ต่อ 12)

### แก้ browser warning — เพิ่ม id/name/htmlFor ให้ form inputs ครบ

- `ConsentModal.tsx` → checkbox: `id="consent-check"` `name="consentCheck"`
- `register/seller/page.tsx` → step 1: fullNameId, idNumber; step 3 (bank): bankAcct, bankName, bankOwner
- `register/middleman/page.tsx` → step 1: fullNameId, idNumber; step 3 (bank): bankAcct, bankName, bankOwner

### ไฟล์ที่แก้ไข (2026-07-02 ต่อ 12)
- `src/components/ConsentModal.tsx`
- `src/app/register/seller/page.tsx`
- `src/app/register/middleman/page.tsx`

---

## 2026-07-02 (ต่อ 11)

### ปรับ UI ConsentModal — ขนาดตัวอักษร + สีปุ่ม

- ตัวอักษรทั่ว modal: 13px → 15px, line-height เพิ่มขึ้นเพื่ออ่านง่าย
- ปุ่ม "ไม่ยอมรับ / กลับ" → สีแดง (border + text #dc2626)
- ปุ่ม "ยอมรับและดำเนินการต่อ" → เขียว (#16a34a) เมื่อติ๊กแล้ว, เทาเมื่อยังไม่ติ๊ก

### ไฟล์ที่แก้ไข (2026-07-02 ต่อ 11)
- `src/components/ConsentModal.tsx`

---

## 2026-07-02 (ต่อ 10)

### เพิ่ม PDPA Consent Modal + re-apply หลัง git restore

- สร้าง `ConsentModal.tsx` — modal บัง fullscreen ก่อนเริ่มฟอร์ม แสดงนโยบาย PDPA ครบ 4 หัวข้อ
- ต้องติ๊ก checkbox ก่อนถึงจะกด "ยอมรับและดำเนินการต่อ" ได้
- กด "ไม่ยอมรับ / กลับ" → redirect กลับ `/register`
- เชื่อมกับ seller และ middleman pages

### ไฟล์ที่แก้ไข (2026-07-02 ต่อ 10)
- `src/components/ConsentModal.tsx` (ใหม่)
- `src/app/register/seller/page.tsx`
- `src/app/register/middleman/page.tsx`

---

## 2026-07-02 (ต่อ 9)

### เปลี่ยน Flow การสมัครสมาชิก — ไม่บังคับกรอกโปรไฟล์ทันที

**เดิม:** `AuthGate` บังคับทุกหน้า (ยกเว้น `/profile`) ให้กรอกโปรไฟล์ครบก่อน

**ใหม่:** ไม่บังคับทันทีหลังสมัคร — แต่ถ้าจะเข้า "หน้าบริการ" ใดๆ จะถูก redirect ไป `/profile?returnTo=<หน้าเดิม>` เพื่อกรอกให้ครบก่อน แล้วระบบพากลับหน้าเดิมโดยอัตโนมัติ

**หน้าบริการที่บังคับโปรไฟล์:** `/deal`, `/register/seller`, `/register/middleman`, `/service`, `/dashboard`, `/onsite`, `/orders`, `/messages`, `/payment`, `/cart`, `/wanted`, `/admin`

**หน้าที่ browse ได้ฟรีโดยไม่ต้องมีโปรไฟล์:** `/`, `/marketplace`, `/check-scam`, `/faq`, `/how-it-works`, `/fees`, `/terms`, `/privacy`, `/contact` ฯลฯ

### ไฟล์ที่แก้ไข (2026-07-02 ต่อ 9)
- `src/components/AuthGate.tsx` — เปลี่ยนจาก `isProfileExemptPath` เป็น `isProfileRequiredPath`, เพิ่ม `?returnTo=` param ใน redirect
- `src/app/profile/page.tsx` — import `useSearchParams`, redirect ไป `returnTo` หลัง save สำเร็จ
- `src/components/HomeButton.tsx` — ลบ `profileComplete` check (ผู้ใช้ navigate ได้อิสระแล้ว)

---

## 2026-07-01 (ต่อ 8)

### เพิ่มปุ่มเปิด/ปิดโซนตลาด (Marketplace) ในหน้า Admin Service Controls

**งานที่ทำ**:
1. `src/lib/serviceControls.ts` — เพิ่ม `'marketplace'` เข้า `ServiceControlKey` union, `SERVICE_CONTROL_DEFAULTS`, และ `SERVICE_CONTROL_CATALOG` (group "บริการเสริม")
2. `src/app/marketplace/page.tsx` — import `useServiceControls` + `ServiceDisabledNotice`, เรียก hook, เพิ่ม early return เมื่อ marketplace ถูกปิด

**ผลลัพธ์**: Admin สามารถเปิด/ปิดโซนตลาดได้จากหน้า Service Controls — เมื่อปิด ผู้ใช้จะเห็นหน้า ServiceDisabledNotice แทนที่หน้ารายการสินค้า

### ไฟล์ที่แก้ไข (2026-07-01 ต่อ 8)
- `src/lib/serviceControls.ts`
- `src/app/marketplace/page.tsx`

---

## 2026-07-01 (ต่อ 7)

### เพิ่ม OG Tag (Open Graph / Twitter Card) สำหรับ Link Preview

- `metadataBase`: `https://glanghub.com`
- `openGraph`: type=website, locale=th_TH, รูป `/og-tag.webp` (1200×630)
- `twitter`: card=summary_large_image, รูปเดียวกัน
- รองรับทุกแพลตฟอร์ม: Facebook, LINE, Twitter/X, Discord, Telegram ฯลฯ

### ไฟล์ที่แก้ไข (2026-07-01 ต่อ 7)
- `src/app/layout.tsx`

---

## 2026-07-01 (ต่อ 6)

### แก้โปรโมชันฟรีค่าสมัคร — ซ่อน QR/บัญชีธนาคารเมื่อค่าสมัครเป็น ฿0

**สาเหตุ**: เดิม condition `{membershipFee > 0}` ครอบเฉพาะส่วน slip upload — QR code และ bank transfer ยังแสดงอยู่แม้ค่าสมัครจะเป็น ฿0 → ผู้ใช้เห็น QR+บัญชี ทั้งที่ไม่ต้องจ่าย

**แก้ไข** (ทั้ง seller และ middleman pages):
1. ราคาในกล่อง fee: ถ้า `membershipFee === 0` แสดง "ฟรี!" สีเขียวแทน ฿0
2. QR section: เพิ่ม `membershipFee > 0 &&` ครอบ → ซ่อนเมื่อฟรี
3. Bank transfer section: เพิ่ม `membershipFee > 0 &&` ครอบ → ซ่อนเมื่อฟรี
4. "ฟรีค่าสมัคร" message: เปลี่ยนจาก `<p>` plain text → card สีเขียวโดดเด่น "🎉 ฟรีค่าสมัคร! ไม่ต้องโอนเงินหรือแนบสลิป"

**หมายเหตุ**: ระบบโปรโมชันทำงานถูกต้องอยู่แล้ว (`isPromoActive` + `effectiveRegFee`) — ปัญหาอยู่ที่ฝั่ง UI ที่ยังแสดงส่วนชำระเงินแม้ค่าสมัครจะเป็น 0

### ไฟล์ที่แก้ไข (2026-07-01 ต่อ 6)
- `src/app/register/seller/page.tsx`
- `src/app/register/middleman/page.tsx`

---

## 2026-07-01 (ต่อ 5)

### แก้บัค: เข้าดีลที่จบแล้วถูก redirect ออกทันที

**สาเหตุ**: `ReviewPanel.tsx` บรรทัด 180 — `if (already) onReviewed?.()` เรียก callback ตอนโหลดหน้า ถ้ารีวิวแล้ว แต่ `onReviewed` ใน `renderWizardStep8()` (simple wizard) ยังมี `router.push('/')` หลงเหลืออยู่ → ทุกครั้งที่เปิดหน้าดีลที่จบแล้ว → auto-redirect กลับหน้าหลักทันที

**แก้ไข**: ลบ `router.push('/')` ออกจาก `onReviewed` callback ใน `renderWizardStep8()` (บรรทัด 2778) → เหลือเพียง `setCompletionReviewed(true); setCompletionSending(false);` (เหมือนกับ regular wizard และ meetup wizard ที่แก้ไปแล้ว)

### ไฟล์ที่แก้ไข (2026-07-01 ต่อ 5)
- `src/app/deal/[id]/page.tsx`

---

## 2026-07-01 (ต่อ 4)

### แก้ 500 error บน /api/upload-deal (Unauthorized)

**สาเหตุ**: `verifyUser` throw `HttpError('Unauthorized', 401)` แต่ `catch` block ใน route คืน 500 เสมอ + `uploadFile`/`uploadMeetupSlip` ใช้ `getAuthHeaders()` แบบไม่ force-fresh

**แก้ไข**:
1. `upload-deal/route.ts` — `catch` block ตรวจสอบ `err.status` (HttpError) แล้วคืน status นั้นแทน 500
2. `page.tsx` → `uploadFile` — เปลี่ยนเป็น `getAuthHeaders(true)` + เช็ค `!headers.Authorization` + จัดการ 401 แยก (ล้าง cache + แจ้งเข้าระบบใหม่)
3. `page.tsx` → `uploadMeetupSlip` — แก้เหมือนกัน

### ไฟล์ที่แก้ไข (2026-07-01 ต่อ 4)
- `src/app/api/upload-deal/route.ts`
- `src/app/deal/[id]/page.tsx`

---

## 2026-07-01 (ต่อ 3)

### ป้องกันฝ่ายเดียวเปลี่ยน step + บังคับหลักฐาน + completion meetup

1. **แก้ getRegularStep()** — `reviewStarted` เปลี่ยนจาก `||` → `&&` ต้องครบทุกฝ่ายกด chat_done ถึงจะข้าม step คุย
2. **step 7 meetup (เจอกัน)** — เพิ่มส่วน upload หลักฐาน type='meet', ปุ่ม "เจอกันแล้ว" disabled จนกว่าจะอัปโหลดอย่างน้อย 1 ชิ้น, เพิ่ม ref `meetupMeetEvidInputRef`
3. **step 8 meetup (รอคืนเงิน)** — เพิ่ม gallery สลิปประกัน + หลักฐานเจอกัน + completion review system (🔒→💾→🏠)
4. **step 9 meetup (จบ)** — เพิ่ม gallery สลิปทั้งหมด (ประกัน+คืนเงิน) + หลักฐาน + completion review system เหมือนกัน

### ไฟล์ที่แก้ไข (2026-07-01 ต่อ 3)
- `src/app/deal/[id]/page.tsx`

---

## 2026-07-01 (ต่อ 2)

### ซ่อนปุ่ม "เก็บหลักฐาน" จากผู้ส่งรูปเอง
- บรรทัด 2184 (simple wizard): เพิ่ม `!isMe` → `{isMedia && !isMe && <span ...>{pinBtn(m, true)}</span>}`
- บรรทัด 4324 (regular wizard): เพิ่ม `!isMe` → `{!isMe && <span ...>{pinBtn(m)}</span>}`
- ผลลัพธ์: ปุ่ม "📌 เก็บหลักฐาน" แสดงเฉพาะฝ่ายที่รับรูป ไม่แสดงให้คนส่งเอง

### แก้ปุ่ม "บันทึกหลักฐาน-จบดีล" ไม่เด้งหน้าหลักทันที
- `onReviewed` callback (ทั้ง 2 จุด): ลบ `router.push('/')` ออก → set `completionReviewed(true)` เท่านั้น
- ผลลัพธ์: หลังกด บันทึกหลักฐาน-จบดีล → ปุ่มเปลี่ยนเป็น "🏠 เสร็จสิ้น-กลับหน้าหลัก" → กดปุ่มนั้นถึงจะเด้งไปหน้าหลัก

### ไฟล์ที่แก้ไข (2026-07-01 ต่อ 2)
- `src/app/deal/[id]/page.tsx`

---


## 2026-07-01 (ต่อ)

### แก้บัค: กด "📌 เก็บหลักฐาน" แล้ว step ขึ้นทันที (ทั้งผู้ซื้อและขายแสดง ✅ ยืนยันแล้ว โดยไม่ได้กด)
- **สาเหตุ**: `hasProgressPing()` อ่าน system message จาก DB ที่ persist ถาวร — ถ้าเคยทดสอบผ่านขั้น "คุยกันจบแล้ว" ไปแล้ว ข้อความของทั้ง 2 ฝ่ายยังคงอยู่ใน DB เมื่อ `fetchMsgs` รีเฟรช → `hasProgressPing` return true ทั้ง 2 ฝ่าย → `getSimpleStep()` คืน step 3 → wizard ขึ้นทันที
- **แก้ไข**: เพิ่ม `chat_done_seller/buyer/middleman` boolean ใน `deal_price_state` (migration `0012_chat_done_flags.sql`)
  - `progress_ping` action ใน `route.ts` → set `priceUpdates = { chat_done_<role>: true }` แทนแค่ systemMsg
  - `getSimpleStep()` และ `getRegularStep()` → ใช้ `!!pd.chat_done_*` แทน `hasProgressPing()`
  - `renderWizardStepChat()` → เพิ่ม `pd` variable, ใช้ `!!pd.chat_done_*` แทน `hasProgressPing()`
  - `hasProgressPing()` function ยังคงไว้แต่ไม่ถูก call อีกต่อไป

### ไฟล์ที่แก้ไข (2026-07-01 ต่อ)
- `supabase/migrations/0012_chat_done_flags.sql` (ใหม่)
- `supabase/schema.sql`
- `src/app/api/deals/[id]/route.ts`
- `src/app/deal/[id]/page.tsx`

---


## 2026-06-29 → 2026-06-30

### หน้าสร้างดีลนัดรับ (`/service/meetup`)
- ออกแบบหน้าสร้างดีล step=2 ใหม่ให้ใช้รูปแบบเดียวกับ `/deal/create`
- เพิ่ม `useEffect` sync step จาก `useSearchParams` แก้บัค Next.js same-route navigation ไม่ re-mount
- เปลี่ยน EzDrive card จาก `<Link href="/service/meetup?step=2">` → `<div onClick={() => setStep(2)}>` ให้กดรูปภาพแล้วแสดง form ทันทีโดยไม่เปลี่ยน URL

### ดีล Wizard — ขั้นตอนที่ 2/14 (regular deal)
- คนกลางสามารถกำหนดค่าบริการคนกลาง (`proposed_mm_fee`) และค่าตรวจสอบสินค้า (`proposed_inspection_fee`) เอง
- ผู้ซื้อ/ผู้ขายมี Pop-up แสดงราคาที่คนกลางเสนอ พร้อมปุ่มยืนยัน
- เพิ่ม action `propose_mm_fees` และ `accept_mm_fees` ใน `/api/deals/[id]/route.ts`
- เพิ่ม field ใน `DealPriceState`: `proposed_mm_fee`, `proposed_inspection_fee`, `mm_fee_accepted_seller`, `mm_fee_accepted_buyer`

### โลโก้กลางฮับ (`DealFlowBrand`)
- มีอยู่แล้วใน `renderMeetupWizard()` (line 3760 ของ `deal/[id]/page.tsx`) และ `renderSimpleWizard()` ครบทุก step แล้ว

### ไฟล์ที่แก้ไข
- `src/app/service/meetup/page.tsx`
- `src/app/deal/[id]/page.tsx`
- `src/app/api/deals/[id]/route.ts`

---

## 2026-06-30 (ต่อ 4)

### ดาวที่ยังไม่ได้เลือก — ข้างในใช้สีขาว
- `.rv-star` (unselected): `background: #fff`, SVG ใช้ `fill: none; stroke: currentColor; stroke-width: 1.5px`
- `.rv-star.on` (selected): `background: linear-gradient(...)`, SVG ใช้ `fill: currentColor; stroke: none`
- แก้ไขใน `src/app/globals.css`

### หน้าเสร็จสมบูรณ์ — แสดงหลักฐานและรีวิวทุกฝ่าย
- `renderWizardStep8()` เพิ่ม card "📁 หลักฐานทั้งหมดในดีล" แสดงทุกประเภท (packing/receive/inspection/chat)
- `ReviewPanel` ดึง `?all=true` เพื่อรวบรวมรีวิวจากทุกฝ่าย และแสดงผ่าน `AllReviewsSummary`
- `AllReviewsSummary` — card แสดงดาวและ tags ของแต่ละ reviewer จัดกลุ่มตาม role
- API `GET /api/reviews?dealId=...&all=true` — ส่งคืนรีวิวทั้งหมดในดีล

### ไฟล์ที่แก้ไข
- `src/app/globals.css`
- `src/app/deal/[id]/page.tsx`
- `src/components/ReviewPanel.tsx`
- `src/app/api/reviews/route.ts`

---

## 2026-07-01

### ค่าบริการหารครึ่ง — แสดงรายละเอียดจำนวนเงินต่อคน
- `renderPricePanel()`: เพิ่ม `fpNameWithAmount()` helper คำนวณ `Math.round(total/2)` และแสดง "หารครึ่ง (คนละ ฿X)" แทน "หารครึ่ง" เฉยๆ
- `renderWizardStepPrice()`: กล่อง "ราคาปัจจุบัน" แสดง "ค่าบริการรวม ฿X · หารครึ่ง (คนละ ฿Y)"

### ปุ่มเสร็จสิ้น + รีวิวบังคับในหน้าจบดีล
- เพิ่ม `completionReviewed`, `completionAllRated`, `completionSubmitTrigger`, `completionSending` states ใน DealRoom
- `ReviewPanel`: redesign เป็น "headless submit" — ลบปุ่ม "ส่งรีวิว" ออก, เพิ่ม props `onRatedChange`, `externalSubmitTrigger`, `onSubmitError`
- `externalSubmitTrigger`: พ่อ (page.tsx) increment → ReviewPanel submit เอง ผ่าน submitRef pattern (แก้ stale closure)
- `onRatedChange(bool)`: ReviewPanel แจ้งพ่อทุกครั้งที่ allRated เปลี่ยน → พ่อ enable/disable ปุ่ม
- Fix "รีวิวไม่แสดงทันที": `headers.Authorization` ยังไม่พร้อม → `setReviewed(false)` ทันที; ขณะโหลดแสดง "⏳ กำลังโหลด..."
- ปุ่มใน completion pages มี 3 state: `🔒 บันทึกหลักฐาน-จบดีล` (disabled) → `💾 บันทึกหลักฐาน-จบดีล` (กดได้เมื่อดาวครบ → ส่งรีวิว+ไปหน้าหลัก) → `🏠 เสร็จสิ้น-กลับหน้าหลัก` (รีวิวแล้ว)
- ลบปุ่ม "คัดลอกลิงก์แชร์" ออกจาก guest join panel

### ไฟล์ที่แก้ไข (2026-07-01)
- `src/app/deal/[id]/page.tsx`
- `src/components/ReviewPanel.tsx`

---

## 2026-06-30 (ต่อ 5)

### หน้าจบดีล — แสดงสลิปทุกใบ + หลักฐานแชท/วิดีโอคอล
- `renderWizardStep8()` และ `renderRStep14()`: เปลี่ยนจากแสดงสลิปใบเดียว → รวบรวมสลิปทุกใบ (buyer/seller/payout/refund) แสดงเป็น grid
- เพิ่ม `chat` และ `call` evidence type ใน filter (ครอบคลุมหลักฐานแชทและวิดีโอคอล)
- `renderRStep14()` เพิ่ม evidence gallery ครบทุกประเภทเหมือน simple wizard

### หน้าแอดมิน — เพิ่ม evidence ทุกประเภท
- `parcelEvidenceOf()` ใน admin/deals: เพิ่ม `inspection`, `chat`, `call` ใน filter + labelMap
- เปลี่ยนหัวข้อจาก "หลักฐานพัสดุจากคู่ดีล" → "หลักฐานทั้งหมดในดีล"

### ไฟล์ที่แก้ไข
- `src/app/deal/[id]/page.tsx`
- `src/app/admin/deals/page.tsx`
getSimpleStep()` คืน step 2 ผิดพลาด → `step3PendingRef = 2` → กด "เข้าใจแล้ว" → `setWzViewStep(2)` → ค้างที่ step 2 ถาวร popup ตอนนี้ trigger เฉพาะจาก `goToSimpleStep()` step 1→2
3. **reload กลับ step 2**: เพิ่ม `msgsLoaded` state — ถ้า msgs ยังไม่โหลดและอยู่ใน payment_pending ที่ยังไม่มี evidence → แสดง "กำลังโหลด..." แทนที่จะ flash ไป step 2 ก่อน

---

## 2026-06-30 (ต่อ 3)

### step 8 รับสินค้า — แสดงหลักฐานแพ็คสินค้าจากผู้ขาย
- เพิ่ม card "📦 หลักฐานแพ็คสินค้าจากผู้ขาย" ใน `renderWizardStep6()` ฝั่งผู้ซื้อ
- แสดง 3 slot (`evidence.filter(e => e.type === 'packing')`) ก่อน tracking card และ section วิดีโอแกะกล่อง
- ถ้าผู้ขายยังไม่ได้ upload เลย → card ไม่แสดง (conditional render)
- slot ที่ upload แล้วแสดงรูป/วิดีโอ ส่วน slot ที่ว่างแสดงตัวเลข ghost

### ไฟล์ที่แก้ไข
- `src/app/deal/[id]/page.tsx`
