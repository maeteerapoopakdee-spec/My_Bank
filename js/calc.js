// คำนวณยอดของแต่ละเดือน (ไม่ยกยอดข้ามเดือน)
import { ymOf } from './utils.js';

// เรียงรายการ: วันที่ → เวลาที่บันทึก → id
export const byTime = (a, b) =>
  a.date < b.date ? -1 : a.date > b.date ? 1 :
  ((a.ts || 0) - (b.ts || 0)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function compute(db, ym) {
  let inc = 0, exp = 0;
  db.tx.forEach(t => {
    if (ymOf(t.date) !== ym) return;
    if (t.type === 'in') inc += t.amount; else exp += t.amount;
  });
  return {inc, exp, close: inc - exp};
}
