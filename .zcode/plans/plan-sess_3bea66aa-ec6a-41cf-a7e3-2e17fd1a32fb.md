# แผนแก้ "เลือกผู้จ่ายค่ากลางเด้งสลับไปมา"

## Root Cause ของปัญหา
- `fetchDeal()` (บรรทัด 644) เขียนทับ `priceState` ทั้งก้อนทุกครั้งที่ poll (4-15 วิ) และทุกครั้งที่ `doAction` re-fetch
- UI highlight ปุ่ม (`mySelection`) อ่านจาก `pd` (= `priceState` จาก server) → ที่ผู้ใช้เพิ่งกดหายไปทันที เพราะ server state เขียนทับ local state
- ไม่มี local state แยกต่างหากสำหรับ "ฝั่งตัวเองเลือกอะไร" → poll มาทุกครั้ง highlight กระโดด → ดูเหมือน "เด้ง"

## UX ใหม่ (ตามที่ยืนยัน)
1. **ค่าเริ่มต้น = ผู้ซื้อจ่าย** ทั้งสองฝ่าย (เปลี่ยนจาก "null = ยังไม่เลือก")
2. **คลิกเปลี่ยนตัวเลือก** (เช่น ผู้ซื้อ → ผู้ขาย) → มี **popup ยืนยัน** → พอยืนยัน → เปลี่ยนฝั่งตัวเอง + ส่ง API
3. **แยก local vs server** — ฝั่งตัวเองเลือกอะไร รู้จาก local state ไม่โดน poll เขียนทับ
4. **ปุ่มยอมรับเงื่อนไข**: unlock เมื่อฝั่งตัวเอง + ฝั่งอีกฝ่าย (จาก server) ตรงกัน

---

## การแก้

### A. Frontend — `src/app/deal/[id]/page.tsx`

#### A1. เพิ่ม local state สำหรับฝั่งตัวเอง (ไม่ใช่ derive จาก pd อีกต่อไป)
```ts
// state ใหม่ — เก็บการเลือกของ "ฉัน" แยกจาก server (กัน poll เขียนทับ)
// default = 'buyer' ตามที่ user ต้องการ
const [myFeePayer, setMyFeePayer] = useState<'buyer' | 'seller' | 'split'>('buyer');
```
- ใช้ `useEffect` sync ครั้งแรกจาก server (ถ้า server มีค่าฝั่งตัวเองอยู่แล้ว) — แต่ครั้งต่อไปไม่ sync อีก (กันเด้ง):
```ts
useEffect(() => {
  // sync ฝั่งตัวเองจาก server เฉพาะตอน initial load (เพื่อกู้ค่าที่เคยเลือก)
  if (priceState && !feePayerInitialized.current) {
    const serverMine = myRole === 'buyer' ? priceState.fee_payer_selection_buyer : priceState.fee_payer_selection_seller;
    if (serverMine) setMyFeePayer(serverMine);
    feePayerInitialized.current = true;
  }
}, [priceState, myRole]);
```

#### A2. ปรับ `renderWizardStep1()` (บรรทัด 2434-2568) — ใช้ local state + popup ยืนยัน

**แทนที่ `mySelection` derivation + `setMySelection`** (บรรทัด 2447-2457):
- `mySelection` ← `myFeePayer` (local) แทน `pd.fee_payer_selection_*`
- `setMySelection` → เปิด popup ยืนยันก่อน (เก็บ `pendingFeePayer`) → พอ confirm ค่อย setMyFeePayer + doAction

**ฝั่งอีกฝ่าย** (server-synced, โดน poll ได้):
```ts
const otherSelection = myRole === 'buyer' ? pd.fee_payer_selection_seller : pd.fee_payer_selection_buyer;
// ใช้สำหรับแสดงสถานะฝั่งอีกฝ่าย และเทียบ canAcceptTerms
```

**ปุ่มเลือก** (บรรทัด 2506-2529):
- onClick → เปิด popup ถ้าเปลี่ยนจากค่าปัจจุบัน: `setPendingFeePayer(option)`
- highlight จาก `myFeePayer` (local) — ไม่เด้ง

**canAcceptTerms** (บรรทัด 2468):
```ts
const canAcceptTerms = !!myFeePayer && !!otherSelection && myFeePayer === otherSelection;
```

#### A3. เพิ่ม JSX สำหรับ popup ยืนยัน
```tsx
{pendingFeePayer && (
  <div className="dr-confirm-overlay">  // ใช้ CSS class ที่มีอยู่แล้ว
    <div className="dr-confirm-dialog">
      <div>ยืนยันเปลี่ยนผู้จ่ายค่าบริการเป็น "{getSelectionLabel(pendingFeePayer)}"?</div>
      <div className="dr-confirm-actions">
        <button onClick={() => setPendingFeePayer(null)}>ยกเลิก</button>
        <AsyncButton onClick={async () => {
          setMyFeePayer(pendingFeePayer);
          await doAction('select_fee_payer', { feePayer: pendingFeePayer });
          setPendingFeePayer(null);
        }}>ยืนยัน</AsyncButton>
      </div>
    </div>
  </div>
)}
```

**State ใหม่**:
```ts
const [pendingFeePayer, setPendingFeePayer] = useState<'buyer'|'seller'|'split' | null>(null);
const feePayerInitialized = useRef(false);
```

### B. Backend — `src/app/api/deals/[id]/route.ts`

**ไม่ต้องเปลี่ยนโครงสร้าง** — `select_fee_payer` (บรรทัด 115-135) + `accept_terms` (บรรทัด 173-200) ยังเทียบ `fee_payer_selection_buyer === fee_payer_selection_seller` เหมือนเดิม

เพียงแต่ logic ฝั่ง client จะเปลี่ยน — ฝั่งตัวเองไม่เคยเขียนทับโดย poll แล้ว ทำให้ server state ของแต่ละฝ่ายนิ่ง ไม่มี feedback loop

### C. (optional ไม่บังคับ) ค่าเริ่มต้นฝั่ง server
ถ้าต้องการให้ default = 'buyer' ทั้งคู่ทันทีตอนสร้างดีล ให้เพิ่มใน backend ตอนสร้าง deal → แต่ไม่บังคับ เพราะ client จะมี default เป็น 'buyer' อยู่แล้ว

---

## ไฟล์ที่แก้
1. **`src/app/deal/[id]/page.tsx`** — เพิ่ม `myFeePayer`/`pendingFeePayer`/`feePayerInitialized` state + useEffect initial sync + ปรับ `renderWizardStep1()` ใช้ local state + เพิ่ม popup JSX

(Backend ไม่ต้องแก้)

## ลำดับการทำ
1. เพิ่ม state ใหม่ + useEffect sync ครั้งแรก
2. ปรับ `renderWizardStep1()`: ใช้ `myFeePayer` แทน derive จาก pd, เปลี่ยน onClick → เปิด popup, คำนวณ canAcceptTerms ใหม่
3. เพิ่ม popup JSX (ใช้ CSS class ที่มีอยู่ — ขอเช็คก่อนทำว่ามี `.dr-confirm-overlay` หรือใช้อันอื่น)
4. type-check + lint

## ข้อควรระวัง
- `useEffect` sync ใช้ `feePayerInitialized.current` เป็น gate — sync ครั้งเดียวตอน initial load กัน feedback loop
- ถ้าผู้ใช้ refresh หน้า → local state กลับเป็น 'buyer' → useEffect sync จาก server ภายใน ~1 วิ (หลัง fetchDeal ครั้งแรก) → ใช้ค่าล่าสุดที่เคยเลือก
- popup ยืนยันเกิดเฉพาะตอน "เปลี่ยน" ค่า (ไม่ใช่คลิกซ้ำค่าเดิม) — ถ้าคลิกค่าเดิมที่เลือกอยู่ ไม่ต้อง popup
- `doAction` re-fetch จะยังคงทำงาน → server state update ฝั่งอีกฝ่าย → แต่ฝั่งตัวเองไม่โดนทับเพราะใช้ local state