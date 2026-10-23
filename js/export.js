// ส่งออก Excel (.xlsx สีตามวัน) / CSV และสำรอง-นำเข้า JSON
import { START } from './config.js';
import { ymOf, addMonth, monthTh, todayStr, pad } from './utils.js';
import { compute, byTime } from './calc.js';

const r2 = n => Math.round(n * 100) / 100;
const HEAD = ['วันที่', 'เวลา', 'เงินเข้า', 'เงินออก', 'รายละเอียด', 'คงเหลือ', 'ค่าใช้จ่ายรวมของวัน'];

// สีประจำวัน (อาทิตย์ → เสาร์): bg = สีพื้น, fg = สีตัวอักษร (พื้นเข้มใช้ขาว พื้นอ่อนใช้เข้ม)
const DAY_COLORS = [
  {name: 'อาทิตย์',  bg: 'D32F2F', fg: 'FFFFFF'},   // แดง
  {name: 'จันทร์',   bg: 'FFF176', fg: '212121'},   // เหลือง
  {name: 'อังคาร',   bg: 'F8BBD0', fg: '212121'},   // ชมพู
  {name: 'พุธ',     bg: '2E7D32', fg: 'FFFFFF'},   // เขียว
  {name: 'พฤหัสบดี', bg: 'FFB74D', fg: '212121'},   // ส้ม
  {name: 'ศุกร์',    bg: '4FC3F7', fg: '212121'},   // ฟ้า
  {name: 'เสาร์',    bg: '7B1FA2', fg: 'FFFFFF'},   // ม่วง
];

// เวลาที่กดบันทึก แบบ 24 ชั่วโมง HH:MM:SS
const timeOf = ts => {
  if (!ts) return '';
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// จัดข้อมูลเป็นบล็อกรายเดือน ใช้ร่วมกันทั้ง CSV และ xlsx
function buildBlocks(db) {
  let last = START;
  db.tx.forEach(t => { if (ymOf(t.date) > last) last = ymOf(t.date); });
  const blocks = [];
  for (let m = START; m <= last; m = addMonth(m, 1)) {
    const list = db.tx.filter(t => ymOf(t.date) === m).sort(byTime);
    if (!list.length) continue;
    const c = compute(db, m);
    let bal = 0;
    const rows = list.map(t => {
      bal += t.type === 'in' ? t.amount : -t.amount;
      return {
        date: t.date, time: timeOf(t.ts),
        inn: t.type === 'in' ? r2(t.amount) : '', out: t.type === 'out' ? r2(t.amount) : '',
        note: t.note || (t.type === 'in' ? 'รายรับ' : 'ไม่ระบุรายละเอียด'), bal: r2(bal),
      };
    });
    // รวมรายจ่ายของแต่ละวัน แล้วใส่ที่แถวสุดท้ายของวันนั้น (คอลัมน์ G)
    const daySum = {};
    rows.forEach(r => { daySum[r.date] = r2((daySum[r.date] || 0) + (r.out || 0)); });
    rows.forEach((r, i) => { r.dayTotal = (i === rows.length - 1 || rows[i + 1].date !== r.date) ? daySum[r.date] : ''; });
    blocks.push({title: monthTh(m), rows, total: ['รวม ' + monthTh(m), '', r2(c.inc), r2(c.exp), 'เงินคงเหลือเดือนนี้', r2(c.close), '']});
  }
  return blocks;
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- CSV (ไม่มีสี) ---------- */
function csvCell(v) {
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = "'" + s;       // กันสูตรใน Excel
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export function exportCsv(db) {
  const rows = [];
  buildBlocks(db).forEach(b => {
    rows.push([b.title], HEAD);
    b.rows.forEach(r => rows.push([r.date, r.time, r.inn, r.out, r.note, r.bal, r.dayTotal]));
    rows.push(b.total, []);
  });
  const csv = '\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');   // BOM ให้ Excel อ่านภาษาไทยถูก
  download(new Blob([csv], {type: 'text/csv;charset=utf-8'}), `รายรับรายจ่าย-${todayStr()}.csv`);
}

/* ---------- Excel (.xlsx สีตามวัน) ---------- */
async function loadExcelJS() {
  if (window.ExcelJS) return window.ExcelJS;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('โหลดตัวสร้างไฟล์ Excel ไม่ได้ (ต้องต่อเน็ต)'));
    document.head.appendChild(s);
  });
  return window.ExcelJS;
}

export async function exportXlsx(db) {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('รายรับรายจ่าย');
  ws.columns = [14, 11, 13, 13, 36, 13, 20].map(width => ({width}));
  const line = {style: 'thin', color: {argb: 'FFBDBDBD'}};
  const paintCell = (cell, bg, fg, bold) => {
    cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FF' + bg}};
    cell.font = {color: {argb: 'FF' + fg}, bold: !!bold};
    cell.border = {top: line, left: line, bottom: line, right: line};
  };
  const paint = (row, bg, fg, bold) => row.eachCell({includeEmpty: true}, cell => paintCell(cell, bg, fg, bold));

  // แถบบอกสีของแต่ละวันไว้บนสุด
  const legend = ws.addRow(DAY_COLORS.map(d => d.name));
  legend.eachCell(cell => { const d = DAY_COLORS[cell.col - 1]; paintCell(cell, d.bg, d.fg, true); cell.alignment = {horizontal: 'center'}; });
  ws.addRow([]);

  buildBlocks(db).forEach(b => {
    ws.addRow([b.title]).font = {bold: true, size: 14};
    paint(ws.addRow(HEAD), 'D9D9D9', '212121', true);
    b.rows.forEach(r => {
      const [y, m, d] = r.date.split('-').map(Number);
      const row = ws.addRow([new Date(Date.UTC(y, m - 1, d)), r.time, r.inn || null, r.out || null, r.note, r.bal, r.dayTotal === '' ? null : r.dayTotal]);
      const dc = DAY_COLORS[new Date(y, m - 1, d).getDay()];
      paint(row, dc.bg, dc.fg, false);
      row.getCell(1).numFmt = 'dd/mm/yyyy';
      [3, 4, 6, 7].forEach(i => { row.getCell(i).numFmt = '#,##0.00'; });
      [1, 2].forEach(i => { row.getCell(i).alignment = {horizontal: 'center'}; });
    });
    const t = ws.addRow(b.total.map(v => v === '' ? null : v));
    paint(t, 'F2F2F2', '212121', true);
    [3, 4, 6].forEach(i => { t.getCell(i).numFmt = '#,##0.00'; });
    ws.addRow([]);
  });

  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), `รายรับรายจ่าย-${todayStr()}.xlsx`);
}

/* ---------- สำรอง / นำเข้า JSON ---------- */
export function exportJson(db) {
  const data = {tx: db.tx.map(({id, ...t}) => t)};
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
