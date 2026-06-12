# 🔒 Khonklang — บันทึกความปลอดภัยและสิ่งที่ต้องตั้งค่าใน Appwrite Console

เอกสารนี้สรุปช่องโหว่ที่ตรวจพบจากการ audit และวิธีแก้ ทั้งส่วนที่แก้ในโค้ดแล้ว
และส่วนที่ **ต้องเข้าไปตั้งค่าใน Appwrite Console เอง** (แก้ในโค้ดไม่ได้)

---

## ✅ แก้ในโค้ดแล้ว

| รหัส | ช่องโหว่ | การแก้ |
|---|---|---|
| S1 | ห้องแชทดีลรั่ว — ใครก็อ่าน/โพสต์แชทดีลอื่นได้ถ้ารู้ dealId | `/api/messages` GET+POST ตรวจ `assertDealParty()` ก่อนทุกครั้ง — เฉพาะ buyer/seller/middleman ของดีลนั้น |
| S2 | ไม่มี security headers | `next.config.ts` เพิ่ม X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS |

---

## 🔴 ต้องแก้ใน Appwrite Console (สำคัญที่สุด — ข้อมูลบัตรประชาชนรั่วได้จริง)

### S3 — Bucket `kyc_docs` อ่านได้ทุกคนที่ล็อกอิน
ปัจจุบัน permission = `Role.users()` (read) → **สมาชิกคนใดก็เปิดดูบัตรประชาชน/สมุดบัญชีของคนอื่นได้** ถ้ารู้ fileId

**วิธีแก้:**
1. Appwrite Console → Storage → bucket `kyc_docs` → Settings → Permissions
2. ลบ `Read: Users` ออก
3. เปลี่ยนเป็น **document/file-level permission**: ตอนอัปโหลดไฟล์ ให้กำหนด read เฉพาะเจ้าของ + ทีม admin
   - แก้ `src/app/api/upload-kyc/route.ts` ตอน `createFile` ให้ส่ง permission:
     ```ts
     [Permission.read(Role.user(ownerUserId)), Permission.read(Role.team('admin'))]
     ```
   - ต้องส่ง userId ของผู้อัปโหลดเข้ามาใน route (ดึงจาก JWT)
4. สร้าง Team ชื่อ `admin` ใน Appwrite แล้วเพิ่มแอดมินเข้าทีม

### S4 — Collection `seller_applications` / `middleman_applications` อ่านได้ทุกคน
ปัจจุบัน `Permission.read(Role.users())` → **ข้อมูล KYC ใบสมัครทั้งหมดรั่ว**

**วิธีแก้:**
1. Console → Databases → `khonklang_db` → collection `seller_applications` → Settings → Permissions
2. ลบ `Read: Users`
3. เปิด **Document Security** (toggle ใน Settings) = ON
4. ตอนสร้างเอกสารใบสมัคร (ใน `/api/register/seller`) กำหนด permission ต่อ document:
   ```ts
   [Permission.read(Role.user(userId)), Permission.read(Role.team('admin')),
    Permission.update(Role.team('admin'))]
   ```
5. ทำเหมือนกันกับ `middleman_applications`

API admin ที่ผมเขียนใช้ `APPWRITE_API_KEY` (server key) อยู่แล้ว — bypass permission ได้ จึงไม่กระทบหน้า admin

### S5 — Bucket `report_files` / `deal_files` เปิดสาธารณะ (`Role.any()`)
สลิปโอนเงิน + หลักฐานรายงานคนโกง **เปิดดูได้โดยไม่ต้องล็อกอิน** ถ้ารู้ URL

**ทางเลือก (ตัดสินใจตามนโยบาย):**
- **แนะนำ:** เปลี่ยน read เป็น `Role.users()` (ต้องล็อกอินก่อนดู) — แก้ใน `upload-deal/route.ts` + `upload-report/route.ts` ตอน createBucket/createFile
- หน้าเช็คคนโกง (ScamDbSearch) จะต้องล็อกอินก่อนดูรูปหลักฐาน — เพิ่ม guard
- ข้อดี: หลักฐานส่วนตัวไม่หลุดสาธารณะ / ข้อเสีย: คนไม่ล็อกอินดูหลักฐานคนโกงไม่ได้

---

## 🟡 ควรทำเพิ่ม (ลำดับถัดไป)

- **Rate limiting** API ที่สร้างข้อมูล (`/api/scam-reports`, `/api/dm`, `/api/wanted`) — กันสแปม/abuse
  ใช้ Appwrite Function + Redis หรือ middleware นับ request ต่อ IP/user
- **Virus scan** ไฟล์อัปโหลด (สลิป/เอกสาร) ก่อนเผยแพร่
- **Audit log** การกระทำของแอดมิน (ใครอนุมัติ/ลบอะไรเมื่อไหร่)

---

## ⚖️ กฎหมายที่ยังต้องดำเนินการนอกโค้ด

| เรื่อง | สิ่งที่ต้องทำ |
|---|---|
| ใบอนุญาตตัวกลางชำระเงิน | บริษัทถือเงินลูกค้า (escrow) อาจเข้าข่ายต้องขอใบอนุญาตจาก ธปท. — **ปรึกษาทนาย** |
| เงื่อนไขการใช้งาน/ความรับผิด | หน้า `/terms` มีโครงแล้ว แต่ควรให้ทนายตรวจ |
| ฐานข้อมูลคนโกง | มีระบบรายงาน+คัดกรองแล้ว แต่ควรมีนโยบายโต้แย้ง/ลบที่ชัดเจน กันฟ้องหมิ่นประมาท |
| PDPA | ✅ consent ตอนสมัคร + cookie banner + ปุ่มขอลบข้อมูล + นโยบายเก็บข้อมูล ทำในโค้ดแล้ว — ควรจดทะเบียน DPO ถ้าเข้าเกณฑ์ |

---

## 🔑 Environment variables ที่ต้องตั้งบน Vercel

```
NEXT_PUBLIC_PROMPTPAY_ID        = เบอร์/เลขผู้เสียภาษีพร้อมเพย์บริษัท
NEXT_PUBLIC_COMPANY_BANK        = ธนาคารกสิกรไทย (KBANK)
NEXT_PUBLIC_COMPANY_BANK_ACCT   = เลขบัญชีบริษัท
NEXT_PUBLIC_COMPANY_BANK_HOLDER = บริษัท คนกลาง จำกัด
```
ถ้าไม่ตั้ง จะใช้ค่า placeholder (0000000000) ในกล่องชำระเงิน
