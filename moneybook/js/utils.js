// ฟังก์ชันช่วยทั่วไป: วันที่ภาษาไทย, จัดรูปแบบเงิน, toast
export const TH_M = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
export const TH_MS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
export const TH_D = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];

export const $ = s => document.querySelector(s);
export const pad = n => String(n).padStart(2, '0');
export const ymOf = d => d.slice(0, 7);
export const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmt = n => (Math.round(n * 100) / 100).toLocaleString('th-TH', {minimumFractionDigits: 0, maximumFractionDigits: 2});

export function todayStr() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
export function addMonth(ym, n) {
  let [y, m] = ym.split('-').map(Number);
  m += n; y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1;
  return `${y}-${pad(m)}`;
}
export function daysIn(ym) { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); }
export function monthTh(ym) { const [y, m] = ym.split('-').map(Number); return `${TH_M[m-1]} ${y + 543}`; }
export function dateTh(d) {
  const [y, m, day] = d.split('-').map(Number);
  return `วัน${TH_D[new Date(y, m-1, day).getDay()]}ที่ ${day} ${TH_M[m-1]} ${y + 543}`;
}
export function stamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getDate()} ${TH_MS[d.getMonth()]} ${String(d.getFullYear() + 543).slice(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function dateShort(d) {
  const [y, m, day] = d.split('-').map(Number);
  return `${TH_D[new Date(y, m-1, day).getDay()]} ${day} ${TH_M[m-1]}`;
}

let tt;
export function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 2200);
}
