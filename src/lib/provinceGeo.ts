/**
 * พิกัดศูนย์กลางโดยประมาณของ 77 จังหวัด (ตัวเมือง/ศาลากลาง)
 * ใช้ประเมินระยะทางสำหรับบริการ "รับประกันเดินทาง" — ความคลาดเคลื่อน ±10-20 กม. ยอมรับได้
 */
export interface ProvincePoint { name: string; lat: number; lng: number }

export const PROVINCE_GEO: ProvincePoint[] = [
  { name: 'กรุงเทพมหานคร', lat: 13.7563, lng: 100.5018 },
  { name: 'กระบี่', lat: 8.0863, lng: 98.9063 },
  { name: 'กาญจนบุรี', lat: 14.0228, lng: 99.5328 },
  { name: 'กาฬสินธุ์', lat: 16.4314, lng: 103.5059 },
  { name: 'กำแพงเพชร', lat: 16.4828, lng: 99.5227 },
  { name: 'ขอนแก่น', lat: 16.4419, lng: 102.8360 },
  { name: 'จันทบุรี', lat: 12.6113, lng: 102.1035 },
  { name: 'ฉะเชิงเทรา', lat: 13.6904, lng: 101.0780 },
  { name: 'ชลบุรี', lat: 13.3611, lng: 100.9847 },
  { name: 'ชัยนาท', lat: 15.1855, lng: 100.1251 },
  { name: 'ชัยภูมิ', lat: 15.8068, lng: 102.0317 },
  { name: 'ชุมพร', lat: 10.4930, lng: 99.1800 },
  { name: 'เชียงราย', lat: 19.9105, lng: 99.8406 },
  { name: 'เชียงใหม่', lat: 18.7883, lng: 98.9853 },
  { name: 'ตรัง', lat: 7.5563, lng: 99.6114 },
  { name: 'ตราด', lat: 12.2428, lng: 102.5175 },
  { name: 'ตาก', lat: 16.8840, lng: 99.1259 },
  { name: 'นครนายก', lat: 14.2069, lng: 101.2130 },
  { name: 'นครปฐม', lat: 13.8196, lng: 100.0645 },
  { name: 'นครพนม', lat: 17.3920, lng: 104.7696 },
  { name: 'นครราชสีมา', lat: 14.9799, lng: 102.0977 },
  { name: 'นครศรีธรรมราช', lat: 8.4304, lng: 99.9633 },
  { name: 'นครสวรรค์', lat: 15.7030, lng: 100.1371 },
  { name: 'นนทบุรี', lat: 13.8622, lng: 100.5144 },
  { name: 'นราธิวาส', lat: 6.4254, lng: 101.8253 },
  { name: 'น่าน', lat: 18.7756, lng: 100.7730 },
  { name: 'บึงกาฬ', lat: 18.3609, lng: 103.6466 },
  { name: 'บุรีรัมย์', lat: 14.9930, lng: 103.1029 },
  { name: 'ปทุมธานี', lat: 14.0208, lng: 100.5250 },
  { name: 'ประจวบคีรีขันธ์', lat: 11.8126, lng: 99.7957 },
  { name: 'ปราจีนบุรี', lat: 14.0509, lng: 101.3660 },
  { name: 'ปัตตานี', lat: 6.8692, lng: 101.2550 },
  { name: 'พระนครศรีอยุธยา', lat: 14.3692, lng: 100.5877 },
  { name: 'พะเยา', lat: 19.1665, lng: 99.9003 },
  { name: 'พังงา', lat: 8.4510, lng: 98.5150 },
  { name: 'พัทลุง', lat: 7.6167, lng: 100.0743 },
  { name: 'พิจิตร', lat: 16.4429, lng: 100.3487 },
  { name: 'พิษณุโลก', lat: 16.8211, lng: 100.2659 },
  { name: 'เพชรบุรี', lat: 13.1119, lng: 99.9399 },
  { name: 'เพชรบูรณ์', lat: 16.4190, lng: 101.1591 },
  { name: 'แพร่', lat: 18.1445, lng: 100.1405 },
  { name: 'ภูเก็ต', lat: 7.8804, lng: 98.3923 },
  { name: 'มหาสารคาม', lat: 16.1851, lng: 103.3027 },
  { name: 'มุกดาหาร', lat: 16.5453, lng: 104.7235 },
  { name: 'แม่ฮ่องสอน', lat: 19.3020, lng: 97.9654 },
  { name: 'ยโสธร', lat: 15.7921, lng: 104.1452 },
  { name: 'ยะลา', lat: 6.5410, lng: 101.2800 },
  { name: 'ร้อยเอ็ด', lat: 16.0538, lng: 103.6520 },
  { name: 'ระนอง', lat: 9.9529, lng: 98.6085 },
  { name: 'ระยอง', lat: 12.6814, lng: 101.2789 },
  { name: 'ราชบุรี', lat: 13.5283, lng: 99.8134 },
  { name: 'ลพบุรี', lat: 14.7995, lng: 100.6534 },
  { name: 'ลำปาง', lat: 18.2888, lng: 99.4908 },
  { name: 'ลำพูน', lat: 18.5744, lng: 99.0087 },
  { name: 'เลย', lat: 17.4860, lng: 101.7223 },
  { name: 'ศรีสะเกษ', lat: 15.1186, lng: 104.3220 },
  { name: 'สกลนคร', lat: 17.1545, lng: 104.1348 },
  { name: 'สงขลา', lat: 7.1898, lng: 100.5954 },
  { name: 'สตูล', lat: 6.6238, lng: 100.0674 },
  { name: 'สมุทรปราการ', lat: 13.5991, lng: 100.5998 },
  { name: 'สมุทรสงคราม', lat: 13.4098, lng: 100.0023 },
  { name: 'สมุทรสาคร', lat: 13.5475, lng: 100.2740 },
  { name: 'สระแก้ว', lat: 13.8240, lng: 102.0645 },
  { name: 'สระบุรี', lat: 14.5289, lng: 100.9108 },
  { name: 'สิงห์บุรี', lat: 14.8907, lng: 100.3968 },
  { name: 'สุโขทัย', lat: 17.0078, lng: 99.8237 },
  { name: 'สุพรรณบุรี', lat: 14.4745, lng: 100.1227 },
  { name: 'สุราษฎร์ธานี', lat: 9.1382, lng: 99.3217 },
  { name: 'สุรินทร์', lat: 14.8818, lng: 103.4936 },
  { name: 'หนองคาย', lat: 17.8783, lng: 102.7413 },
  { name: 'หนองบัวลำภู', lat: 17.2218, lng: 102.4260 },
  { name: 'อ่างทอง', lat: 14.5896, lng: 100.4549 },
  { name: 'อำนาจเจริญ', lat: 15.8656, lng: 104.6258 },
  { name: 'อุดรธานี', lat: 17.4138, lng: 102.7872 },
  { name: 'อุตรดิตถ์', lat: 17.6200, lng: 100.0993 },
  { name: 'อุทัยธานี', lat: 15.3835, lng: 100.0245 },
  { name: 'อุบลราชธานี', lat: 15.2287, lng: 104.8564 },
];

export const PROVINCE_NAMES = PROVINCE_GEO.map(p => p.name);

const byName = new Map(PROVINCE_GEO.map(p => [p.name, p]));

/** ระยะทางเส้นตรงระหว่างจุด (Haversine) คูณ 1.3 ชดเชยเส้นทางถนนจริง */
export function distanceKm(aName: string, bName: string): number {
  const a = byName.get(aName), b = byName.get(bName);
  if (!a || !b) return 0;
  if (aName === bName) return 15; // ภายในจังหวัดเดียวกัน เหมาเฉลี่ย
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const straight = 2 * R * Math.asin(Math.sqrt(h));
  return Math.round(straight * 1.3);
}

/** จังหวัดที่ใกล้จุดกึ่งกลางระหว่างสองจังหวัดที่สุด — ใช้แนะนำจุดนัดพบแบบ "คนละครึ่งทาง" */
export function midpointProvince(aName: string, bName: string): string {
  const a = byName.get(aName), b = byName.get(bName);
  if (!a || !b) return aName || bName || '';
  const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
  let best = a.name, bestD = Infinity;
  for (const p of PROVINCE_GEO) {
    const d = (p.lat - mid.lat) ** 2 + (p.lng - mid.lng) ** 2;
    if (d < bestD) { bestD = d; best = p.name; }
  }
  return best;
}

/** อัตราค่าเดินทางต่อกิโลเมตร (ไป-กลับ) และตัวช่วยคำนวณเงินประกัน */
export const RATE_PER_KM = 5;       // บาท/กม.
export const MIN_DEPOSIT = 100;     // ประกันขั้นต่ำต่อฝ่าย

/** เงินประกันของหนึ่งฝ่าย = ระยะทางถึงจุดนัดพบ × 2 (ไป-กลับ) × อัตรา ปัดขึ้นเป็นหลัก 50 */
export function depositFor(fromProvince: string, meetProvince: string): { km: number; roundTripKm: number; deposit: number } {
  const km = distanceKm(fromProvince, meetProvince);
  const roundTripKm = km * 2;
  const raw = roundTripKm * RATE_PER_KM;
  const deposit = Math.max(MIN_DEPOSIT, Math.ceil(raw / 50) * 50);
  return { km, roundTripKm, deposit };
}

/**
 * เงินประกันที่ "เท่ากันทั้งสองฝ่าย" = (ระยะผู้ซื้อ + ระยะผู้ขาย) × 2 (ไป-กลับ) × อัตรา
 * เหตุผล: ไม่ว่าฝ่ายใดผิดนัด อีกฝ่ายได้รับชดเชยครอบคลุมค่าเดินทางทั้งสองเส้นทาง
 * รวมถึงค่าเสียโอกาสของฝ่ายที่ระยะใกล้กว่า — จึงต้องวางเท่ากันทั้งคู่
 */
export function sharedGuaranteeDeposit(buyerKm: number, sellerKm: number): number {
  const totalRoundTripKm = (buyerKm + sellerKm) * 2;
  const raw = totalRoundTripKm * RATE_PER_KM;
  return Math.max(MIN_DEPOSIT, Math.ceil(raw / 50) * 50);
}
