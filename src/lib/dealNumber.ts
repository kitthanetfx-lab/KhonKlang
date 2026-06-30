// เลขดีล — สร้างจาก document id ของดีล (ไม่ต้องเพิ่ม attribute ใหม่ในฐานข้อมูล)
// ใช้ฟังก์ชันเดียวกันทั้งหน้าดีล หน้าแอดมิน และหน้าการเงิน เพื่อให้เลขตรงกันเสมอ
export function dealCode(id: string): string {
  if (!id) return '-';
  return `KKL-${id.slice(-8).toUpperCase()}`;
}
