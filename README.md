# คนกลาง (Khonklang) — Next.js

แพลตฟอร์มซื้อขายปลอดภัยผ่านคนกลาง (Escrow) — เวอร์ชันที่ปรับ **ดีไซน์ใหม่ทั้งหมด** (light fintech)
โดย **คงตรรกะเดิมทุกอย่างไว้** (Appwrite, LINE/Google/Facebook login, KYC upload, API routes, thai-address)

## โครงสร้าง
- **เปลี่ยนใหม่:** ดีไซน์ UI ทุกหน้า + `src/app/globals.css` (design system ใหม่)
- **คงเดิม:** `src/app/api/**` (backend ทั้งหมด), `src/lib/**`, ตรรกะ fetch/auth/upload ในทุกหน้า

## เริ่มใช้งาน
```bash
npm install
cp .env.local.example .env.local   # แล้วกรอกค่า Appwrite / LINE จริง
npm run dev
```
เปิด http://localhost:3000

## คอมโพเนนต์ดีไซน์ใหม่ที่เพิ่ม
- `src/components/Site.tsx` — Nav, Footer, Logo, hooks (reveal/tilt/countup)
- `src/components/Icon.tsx` — ชุดไอคอน geometric (แทน lucide ในหน้าหลัก)
- `src/components/EscrowStage.tsx` — แอนิเมชัน Escrow หน้าแรก
- `src/components/ServiceSlider.tsx` — สไลด์บริการหน้าแรก

> หน้า KYC register (seller/middleman) และ `/admin/*` ยังใช้ Tailwind + lucide เดิม
> เพื่อคงความถูกต้องของฟอร์มหลายขั้นตอนและตาราง admin ไว้ครบถ้วน
