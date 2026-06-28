[OPEN] Debug Session: page-freeze-access

- Symptom: หน้าเว็บค้างทั้งหน้าและ browser แจ้งว่า page not responding หลัง rollout TH/EN + theme + runtime translate
- Current user-visible hint: พบหน้าค้างพร้อมข้อความลักษณะ `Checking access...` มาก่อน และตอนล่าสุด tab ไม่ตอบสนอง
- Guardrail: ห้ามแก้ business logic ก่อนเก็บ runtime evidence

## Hypotheses

1. `GlobalAutoTranslate` ทำงานซ้ำบน DOM เดิมจาก `MutationObserver` แล้วค้าง main thread
2. `AuthGate` มี redirect/check loop ระหว่าง public route กับ auth state
3. การ patch `alert/confirm/prompt` ไปชนกับ flow หน้าเว็บแล้วบล็อก UI
4. Global widget บางตัว render วนร่วมกับ locale/theme state แล้วทำให้หน้า freeze

## Plan

1. Start debug server
2. Add instrumentation only to `AuthGate`, `GlobalAutoTranslate`, and top-level global widgets
3. Ask user to reproduce once and collect logs
4. Analyze evidence before any fix
