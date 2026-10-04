// ส่งออก CSV (เปิดใน Excel) และสำรอง/นำเข้า JSON
import { START } from './config.js';
import { ymOf, addMonth, monthTh, todayStr, toast } from './utils.js';
import { compute, byTime } from './calc.js';

/* ---------- export CSV (เปิดใน Excel) ---------- */
export const r2 = n => Math.round(n * 100) / 100;
export function csvCell(v) {
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = "'" + s;       // กันสูตรใน Excel
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export function exportCsv(db) {
  let last = START;
  db.tx.forEach(t => { if (ymOf(t.date) > last) last = ymOf(t.date); });
  Object.keys(db.months).forEach(m => { if (m > last && db.months[m].income > 0) last = m; });
  const rows = [];
  for (let m = START; m <= last; m = addMonth(m, 1)) {
    const c = compute(db, m);
    const list = db.tx.filter(t => ymOf(t.date) === m)
      .sort(byTime);
    if (!list.length && !c.sal) continue;
    rows.push([monthTh(m)]);
    rows.push(['วันที่', 'เงินเข้า', 'เงินออก', 'รายละเอียด', 'คงเหลือ']);
    let bal = 0;
    if (c.sal > 0) { bal += c.sal; rows.push([m + '-01', r2(c.sal), '', 'รายได้ประจำเดือน', r2(bal)]); }
    list.forEach(t => {
      if (t.type === 'in') { bal += t.amount; rows.push([t.date, r2(t.amount), '', t.note || 'รายรับ', r2(bal)]); }
      else { bal -= t.amount; rows.push([t.date, '', r2(t.amount), t.note || 'ไม่ระบุรายละเอียด', r2(bal)]); }
    });
    rows.push(['รวม ' + monthTh(m), r2(c.sal + c.inc), r2(c.exp), 'เงินคงเหลือเดือนนี้', r2(c.close)]);
    rows.push([]);
  }
  if (!rows.length) { toast('ยังไม่มีข้อมูลให้ส่งออก'); return; }
  const csv = '\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');   // BOM ให้ Excel อ่านภาษาไทยถูก
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
  a.download = `รายรับรายจ่าย-${todayStr()}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('ส่งออกไฟล์ .csv แล้ว');
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function exportJson(db) {
  const data = {months: db.months, tx: db.tx.map(({id, ...t}) => t)};
  download(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}), `moneybook-backup-${todayStr()}.json`);
}

export function readBackup(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d || !Array.isArray(d.tx)) throw new Error('bad file');
        resolve(d);
      } catch (e) { reject(e); }
    };
    r.onerror = reject;
    r.readAsText(file);
  });
}
