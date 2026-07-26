-- เพิ่ม 'other' เข้า enum evidence_type
-- flow ใหม่: อัปหลักฐานในขั้น payment_pending ไม่ต้องเลือกประเภท → default 'other'
-- ถ้าไม่เพิ่ม จะ insert ล้มเหลว (constraint violation) → ภาพที่อัปโหลดหายเงียบๆ
alter type evidence_type add value if not exists 'other';
