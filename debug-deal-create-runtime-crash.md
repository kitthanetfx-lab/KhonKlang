# Debug Session: deal-create-runtime-crash

Status: OPEN

## Symptom
- หลังสร้างดีลแล้ว redirect มาที่หน้า `deal/[id]`
- หน้าแตกเป็น "This page couldn't load"
- Console ขึ้น `Minified React error #310`

## Hypotheses
- H1: มีการเรียก hook แบบ conditional ทำให้จำนวน hook เปลี่ยนเมื่อดีลใหม่มีข้อมูลบางชุด
- H2: ดีลที่เพิ่งสร้างมี field บางตัวเป็น `null/undefined` แล้ว render path หนึ่งของ `deal/[id]` รับไม่ไหว
- H3: มี effect/state update loop หลังโหลด deal ใหม่ ทำให้ runtime พัง
- H4: production bundle ของหน้า `deal/[id]` ไม่ตรงกับโค้ดล่าสุดหรือมี hydration divergence

## Plan
- อ่าน flow ของ `deal/[id]` และเส้นทางหลัง create deal
- วาง instrumentation ที่จุดก่อน/หลัง fetch deal และก่อน render ก้อนที่เสี่ยง
- เก็บหลักฐาน runtime แล้วค่อย fix เฉพาะจุด

## Evidence
- Pending

## Conclusion
- Pending
