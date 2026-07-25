-- เพิ่ม column สำหรับเก็บการเลือกผู้จ่ายค่ากลางของแต่ละฝ่าย (ขั้น 1: ยอมรับเงื่อนไข)
-- ใช้ใน flow ใหม่ที่ให้แต่ละฝ่ายเลือกผู้จ่ายแยกกันแล้วเทียบว่าตรงกันหรือไม่
ALTER TABLE deal_price_state
  ADD COLUMN IF NOT EXISTS fee_payer_selection_buyer TEXT,
  ADD COLUMN IF NOT EXISTS fee_payer_selection_seller TEXT;
