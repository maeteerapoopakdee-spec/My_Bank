// ตัวควบคุมหน้าเว็บ: วาดหน้าจอ, รับการกดปุ่ม, เชื่อมกับ auth/store
import { START, PAGE } from './config.js';
import { $, pad, ymOf, esc, fmt, todayStr, addMonth, daysIn, monthTh, dateTh, dateShort, stamp, TH_M, toast } from './utils.js';
import { compute as calc, byTime } from './calc.js';
import { configured } from './firebase.js';
import { watchAuth, login, logout } from './auth.js';
import { state as db, onChange, onSyncError, startSync, stopSync, addTx, updateTx, deleteTx, setMonthIncome, importData } from './store.js';
import { exportCsv, exportJson, readBackup } from './export.js';

const compute = ym => calc(db, ym);
function syncError(err) { console.error(err); toast('ซิงก์กับคลาวด์ไม่สำเร็จ: ' + (err.code || err.message)); }
onSyncError(syncError);

/* ---------- state ---------- */
const t0 = todayStr();
let view = ymOf(t0) < START ? START : ymOf(t0);
let selDate = ymOf(t0) === view ? t0 : view + '-01';
let editingId = null;
let page = 1;
let mode = 'list';
try { if (localStorage.getItem('moneybook.mode') === 'table') mode = 'table'; } catch (e) {}

/* ---------- month / date sync ---------- */
function onMonthChange() {
  selDate = ymOf(t0) === view ? t0 : view + '-01';
  $('#monthLabel').textContent = monthTh(view);
  $('#prev').disabled = view <= START;
  $('#monthIncome').value = (db.months[view] || {}).income || '';
  const dt = $('#date');
  dt.min = view + '-01'; dt.max = `${view}-${pad(daysIn(view))}`; dt.value = selDate;
  $('#dateTh').textContent = dateTh(selDate);
  editingId = null; page = 1;
  render();
}

/* ---------- expense rows ---------- */
function addRow(focus) {
  const d = document.createElement('div');
  d.className = 'exrow';
  d.innerHTML = '<input class="amt" type="number" inputmode="decimal" min="0" step="0.01" placeholder="จำนวนเงิน" aria-label="จำนวนเงิน">' +
    '<input class="note" type="text" placeholder="รายละเอียด เช่น ข้าวเช้า" aria-label="รายละเอียด">' +
    '<button type="button" class="x" aria-label="ลบแถวนี้">×</button>';
  $('#exRows').appendChild(d);
  if (focus) d.querySelector('.amt').focus();
}
function resetForm() {
  $('#inAmt').value = ''; $('#inNote').value = '';
  $('#exRows').innerHTML = ''; addRow(false);
}
$('#exRows').addEventListener('click', e => {
  if (!e.target.classList.contains('x')) return;
  const rows = document.querySelectorAll('.exrow');
  if (rows.length === 1) { rows[0].querySelectorAll('input').forEach(i => i.value = ''); }
  else e.target.closest('.exrow').remove();
});
$('#exRows').addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.classList.contains('note')) return;
  e.preventDefault();
  const row = e.target.closest('.exrow');
  if (row.nextElementSibling) row.nextElementSibling.querySelector('.amt').focus();
  else if (row.querySelector('.amt').value) addRow(true);
});
$('#addRow').onclick = () => addRow(true);

/* ---------- save a day ---------- */
$('#save').onclick = () => {
  const date = $('#date').value;
  if (!date || ymOf(date) !== view) { toast('เลือกวันที่ในเดือนนี้'); return; }
  const list = [];
  const inc = parseFloat($('#inAmt').value);
  if (inc > 0) list.push({date, type: 'in', amount: inc, note: $('#inNote').value.trim()});
  document.querySelectorAll('.exrow').forEach(r => {
    const a = parseFloat(r.querySelector('.amt').value);
    if (a > 0) list.push({date, type: 'out', amount: a, note: r.querySelector('.note').value.trim()});
  });
  if (!list.length) { toast('ยังไม่ได้กรอกจำนวนเงิน'); return; }
  page = 1; resetForm();
  addTx(list).catch(syncError);
  toast(`บันทึก ${list.length} รายการแล้ว`);
};

$('#date').addEventListener('change', e => {
  if (!e.target.value || ymOf(e.target.value) !== view) { e.target.value = selDate; return; }
  selDate = e.target.value; $('#dateTh').textContent = dateTh(selDate); render();
});
$('#monthIncome').addEventListener('input', e => {
  setMonthIncome(view, Math.max(0, parseFloat(e.target.value) || 0));
});
$('#prev').onclick = () => { if (view > START) { view = addMonth(view, -1); onMonthChange(); } };
$('#next').onclick = () => { view = addMonth(view, 1); onMonthChange(); };

/* ---------- render ---------- */
function render() {
  const c = compute(view);
  const bal = $('#balance');
  bal.textContent = fmt(c.close) + ' ฿';
  bal.classList.toggle('neg', c.close < 0);
  $('#heroCap').textContent = 'เงินคงเหลือเดือน' + TH_M[+view.slice(5)-1];
  $('#balanceSub').textContent = c.close < 0 ? 'ใช้เกินรายรับ — ติดลบ' : 'ของ ' + monthTh(view) + ' (เริ่มนับใหม่จาก 0)';
  $('#stSal').textContent = fmt(c.sal);
  $('#stIn').textContent = fmt(c.inc);
  $('#stOut').textContent = fmt(c.exp);
  renderMonths();
  renderBars(c);
  renderStatement(c);
}

function renderMonths() {
  let last = ymOf(t0) < START ? START : ymOf(t0);
  if (view > last) last = view;
  db.tx.forEach(t => { if (ymOf(t.date) > last) last = ymOf(t.date); });
  const box = $('#months'), prevScroll = box.scrollLeft;
  let html = '', m = START;
  while (m <= last) {
    const c = compute(m);
    html += `<button class="mcard${m === view ? ' sel' : ''}" data-ym="${m}" aria-label="${monthTh(m)} คงเหลือ ${fmt(c.close)} บาท">` +
      `<div class="mn">${monthTh(m)}</div>` +
      `<div class="mb num${c.close < 0 ? ' neg' : ''}">${fmt(c.close)}</div>` +
      `<div class="ml"><span>รับ</span><b class="i num">${fmt(c.sal + c.inc)}</b></div>` +
      `<div class="ml"><span>จ่าย</span><b class="o num">${fmt(c.exp)}</b></div></button>`;
    m = addMonth(m, 1);
  }
  box.innerHTML = html;
  box.scrollLeft = prevScroll;
  const sc = box.querySelector('.mcard.sel');
  if (sc) {
    if (sc.offsetLeft < box.scrollLeft) box.scrollLeft = sc.offsetLeft - box.offsetLeft;
    else if (sc.offsetLeft + sc.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollLeft = sc.offsetLeft + sc.offsetWidth - box.offsetLeft - box.clientWidth + 8;
  }
}
$('#months').addEventListener('click', e => {
  const b = e.target.closest('.mcard'); if (!b || b.dataset.ym === view) return;
  view = b.dataset.ym; onMonthChange();
});

function renderBars(c) {
  const n = daysIn(view), perDay = new Array(n).fill(0);
  db.tx.forEach(t => { if (t.type === 'out' && ymOf(t.date) === view) perDay[+t.date.slice(8) - 1] += t.amount; });
  const max = Math.max(...perDay, 1);
  $('#bars').innerHTML = perDay.map((v, i) => {
    const d = i + 1, date = `${view}-${pad(d)}`;
    return `<button class="bar${date === selDate ? ' sel' : ''}${v ? '' : ' empty'}" data-date="${date}" ` +
      `style="height:${Math.max(2, v / max * 100)}%" title="${d} ${TH_M[+view.slice(5)-1]}: ${fmt(v)} บาท" aria-label="วันที่ ${d} จ่าย ${fmt(v)} บาท"></button>`;
  }).join('');
  $('#axis').innerHTML = perDay.map((_, i) => `<span>${(i + 1) % 5 === 1 || i + 1 === n ? i + 1 : ''}</span>`).join('');
  // เฉลี่ยต่อวัน เฉพาะวันที่ผ่านมาแล้ว
  let elapsed = n;
  if (ymOf(t0) === view) elapsed = +t0.slice(8);
  else if (view > ymOf(t0)) elapsed = 0;
  $('#avg').textContent = elapsed ? `จ่ายเฉลี่ย ${fmt(c.exp / elapsed)} บาท/วัน (${elapsed} วัน)` : 'ยังไม่ถึงเดือนนี้';
}
$('#bars').addEventListener('click', e => {
  const b = e.target.closest('.bar'); if (!b) return;
  selDate = b.dataset.date; $('#date').value = selDate; $('#dateTh').textContent = dateTh(selDate); render();
});

function buildItems(c) {
  const list = db.tx.filter(t => ymOf(t.date) === view)
    .sort(byTime);
  const items = []; let bal = 0;
  if (c.sal > 0) { bal += c.sal; items.push({sal: true, date: view + '-01', type: 'in', amount: c.sal, note: 'รายได้ประจำเดือน', bal}); }
  list.forEach(t => { bal += t.type === 'in' ? t.amount : -t.amount; items.push(Object.assign({}, t, {bal})); });
  return items;                                   // เรียงจากเก่า → ใหม่
}

function renderStatement(c) {
  document.querySelectorAll('#viewSeg button').forEach(b => b.classList.toggle('on', b.dataset.view === mode));
  const all = buildItems(c);
  if (!all.length) {
    $('#statement').innerHTML = '<div class="empty-state">ยังไม่มีรายการในเดือนนี้<br>กรอกรายรับ/รายจ่ายด้านบนแล้วกดบันทึกได้เลย</div>';
    $('#pager').innerHTML = ''; return;
  }
  const desc = all.slice().reverse();               // ล่าสุดอยู่บน
  const pages = Math.max(1, Math.ceil(desc.length / PAGE));
  if (page > pages) page = pages;
  const slice = desc.slice((page - 1) * PAGE, page * PAGE);
  $('#statement').innerHTML = mode === 'table' ? tableHtml(slice, c) : listHtml(slice, all);
  renderPager(pages, desc.length);
}

function listHtml(slice, all) {
  const agg = {};
  all.forEach(it => {
    const g = agg[it.date] = agg[it.date] || {out: 0, inn: 0, bal: 0};
    if (!it.sal) { if (it.type === 'in') g.inn += it.amount; else g.out += it.amount; }
    g.bal = it.bal;
  });
  const groups = [];
  slice.forEach(it => {
    const last = groups[groups.length - 1];
    if (last && last.d === it.date) last.rows.push(it); else groups.push({d: it.date, rows: [it]});
  });
  return groups.map(g => {
    const a = agg[g.d], meta = [];
    if (a.out) meta.push(`จ่าย ${fmt(a.out)}`);
    if (a.inn) meta.push(`รับ ${fmt(a.inn)}`);
    return `<div class="day"><div class="dayhead"><b>${dateShort(g.d)}</b>` +
      `<small class="num">${meta.join(' · ')}${meta.length ? ' · ' : ''}คงเหลือสิ้นวัน ${fmt(a.bal)}</small></div>` +
      g.rows.map(rowHtml).join('') + '</div>';
  }).join('');
}

function editHtml(t) {
  return `<div class="txedit" data-id="${t.id}">` +
    `<input type="number" inputmode="decimal" step="0.01" min="0" class="e-amt" value="${t.amount}" aria-label="จำนวนเงิน">` +
    `<input type="text" class="e-note" value="${esc(t.note)}" placeholder="รายละเอียด" aria-label="รายละเอียด">` +
    `<div class="b"><button class="btn small line" data-act="cancel">ยกเลิก</button><button class="btn small primary" style="width:auto;margin:0" data-act="update">บันทึก</button></div></div>`;
}

function rowHtml(t) {
  if (t.sal) return `<div class="tx sal"><div class="note">รายได้ประจำเดือน</div><div class="amt in num">+${fmt(t.amount)}</div><div></div></div>`;
  if (t.id === editingId) return editHtml(t);
  const sign = t.type === 'in' ? '+' : '−';
  const note = t.note ? esc(t.note) : (t.type === 'in' ? 'รายรับ' : 'ไม่ระบุรายละเอียด');
  const st = t.ts ? `<span class="stamp">บันทึกเมื่อ ${stamp(t.ts)}</span>` : '';
  return `<div class="tx" data-id="${t.id}"><div class="note${t.note ? '' : ' none'}">${note}${st}</div>` +
    `<div class="amt ${t.type} num">${sign}${fmt(t.amount)}</div>` +
    `<div class="acts"><button data-act="edit" aria-label="แก้ไข">แก้ไข</button><button data-act="del" aria-label="ลบ">ลบ</button></div></div>`;
}

function tableHtml(slice, c) {
  const rows = slice.map(t => {
    if (!t.sal && t.id === editingId) return `<tr><td class="editcell" colspan="7">${editHtml(t)}</td></tr>`;
    const note = t.sal ? 'รายได้ประจำเดือน' : (t.note || (t.type === 'in' ? 'รายรับ' : 'ไม่ระบุรายละเอียด'));
    const acts = t.sal ? '' : `<div class="acts" data-id="${t.id}"><button data-act="edit">แก้ไข</button><button data-act="del">ลบ</button></div>`;
    return `<tr><td class="num">${t.date}</td>` +
      `<td class="r in num">${t.type === 'in' ? fmt(t.amount) : ''}</td>` +
      `<td class="r out num">${t.type === 'out' ? fmt(t.amount) : ''}</td>` +
      `<td class="note${t.note || t.sal ? '' : ' none'}">${esc(note)}</td>` +
      `<td class="r num">${fmt(t.bal)}</td><td class="ts num">${stamp(t.ts)}</td><td>${acts}</td></tr>`;
  }).join('');
  return '<div class="tablewrap"><table class="grid"><thead><tr><th>วันที่</th><th class="r">เงินเข้า</th><th class="r">เงินออก</th>' +
    '<th>รายละเอียด</th><th class="r">คงเหลือ</th><th>บันทึกเมื่อ</th><th></th></tr></thead>' +
    `<tbody>${rows}</tbody><tfoot><tr><td>รวมเดือนนี้</td><td class="r num">${fmt(c.sal + c.inc)}</td><td class="r num">${fmt(c.exp)}</td>` +
    `<td>เงินคงเหลือเดือนนี้</td><td class="r num">${fmt(c.close)}</td><td></td><td></td></tr></tfoot></table></div>`;
}

function renderPager(pages, total) {
  const el = $('#pager');
  if (pages <= 1) { el.innerHTML = `<span class="pinfo">${total} รายการ</span>`; return; }
  const set = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4, 5].forEach(n => set.add(n));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3, pages - 4].forEach(n => set.add(n));
  const nums = [...set].filter(n => n >= 1 && n <= pages).sort((x, y) => x - y);
  let html = `<button data-page="${page - 1}" aria-label="หน้าก่อนหน้า"${page === 1 ? ' disabled' : ''}>‹</button>`, prev = 0;
  nums.forEach(n => {
    if (n - prev > 1) html += '<span class="gap">…</span>';
    html += `<button data-page="${n}"${n === page ? ' class="on" aria-current="page"' : ''}>${n}</button>`;
    prev = n;
  });
  html += `<button data-page="${page + 1}" aria-label="หน้าถัดไป"${page === pages ? ' disabled' : ''}>›</button>`;
  html += `<span class="pinfo">หน้า ${page} จาก ${pages} · ทั้งหมด ${total} รายการ (หน้าละ ${PAGE})</span>`;
  el.innerHTML = html;
}
$('#pager').addEventListener('click', e => {
  const b = e.target.closest('[data-page]'); if (!b || b.disabled) return;
  page = +b.dataset.page; editingId = null; render();
});
$('#viewSeg').addEventListener('click', e => {
  const b = e.target.closest('[data-view]'); if (!b) return;
  mode = b.dataset.view; editingId = null;
  try { localStorage.setItem('moneybook.mode', mode); } catch (err) {}
  render();
});

$('#statement').addEventListener('click', e => {
  const btn = e.target.closest('[data-act]'); if (!btn) return;
  const host = btn.closest('[data-id]'); const id = host ? host.dataset.id : null;
  const act = btn.dataset.act;
  if (act === 'edit') { editingId = id; render(); }
  else if (act === 'cancel') { editingId = null; render(); }
  else if (act === 'del') {
    if (confirm('ลบรายการนี้?')) { deleteTx(id).catch(syncError); toast('ลบแล้ว'); }
  } else if (act === 'update') {
    const a = parseFloat(host.querySelector('.e-amt').value);
    if (!(a > 0)) { toast('จำนวนเงินต้องมากกว่า 0'); return; }
    const note = host.querySelector('.e-note').value.trim();
    editingId = null; updateTx(id, {amount: a, note}).catch(syncError); render(); toast('แก้ไขแล้ว');
  }
});

/* ---------- export / import ---------- */
$('#exportCsv').onclick = () => {
  if (!db.tx.length && !Object.keys(db.months).length) { toast('ยังไม่มีข้อมูลให้ส่งออก'); return; }
  exportCsv(db); toast('ส่งออกไฟล์ .csv แล้ว');
};
$('#export').onclick = () => exportJson(db);
$('#importBtn').onclick = () => $('#importFile').click();
$('#importFile').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const d = await readBackup(f);
    if (!confirm(`เพิ่ม ${d.tx.length} รายการจากไฟล์นี้เข้าบัญชี ${user.email} ?`)) return;
    await importData(d); toast('นำเข้าข้อมูลแล้ว');
  } catch (err) { console.error(err); toast('นำเข้าไม่สำเร็จ: ไฟล์ไม่ถูกต้อง'); }
});

/* ---------- login / sync ---------- */
let user = null, started = false;
function showScreen(name) {
  $('#loading').hidden = name !== 'loading';
  $('#login').hidden = name !== 'login';
  $('#app').hidden = name !== 'app';
}
function syncInputs() {
  const mi = $('#monthIncome');
  if (document.activeElement !== mi) mi.value = (db.months[view] || {}).income || '';
}
onChange(() => {
  if (!user || !db.ready) return;
  if (!started) { started = true; showScreen('app'); resetForm(); onMonthChange(); return; }
  syncInputs(); render();
});

const LOGIN_ERRORS = {
  'auth/unauthorized-domain': 'โดเมนนี้ยังไม่ได้เพิ่มใน Firebase → Authentication → Settings → Authorized domains',
  'auth/popup-blocked': 'เบราว์เซอร์บล็อกหน้าต่างล็อกอิน กรุณาอนุญาต pop-up แล้วลองใหม่',
  'auth/operation-not-allowed': 'ยังไม่ได้เปิด Google ใน Firebase → Authentication → Sign-in method',
};
$('#loginBtn').onclick = async () => {
  $('#loginMsg').textContent = '';
  try { await login(); }
  catch (e) {
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
    $('#loginMsg').textContent = LOGIN_ERRORS[e.code] || ('เข้าสู่ระบบไม่สำเร็จ: ' + (e.code || e.message));
  }
};
$('#logout').onclick = () => logout();

if (!configured) {
  showScreen('login'); $('#loginBtn').disabled = true; $('#setupMsg').hidden = false;
} else {
  watchAuth(u => {
    user = u; started = false;
    if (!u) { stopSync(); $('#account').hidden = true; showScreen('login'); return; }
    $('#uName').textContent = u.displayName || '';
    $('#uEmail').textContent = u.email || '';
    const av = $('#avatar');
    if (u.photoURL) { av.src = u.photoURL; av.hidden = false; } else av.hidden = true;
    $('#account').hidden = false;
    showScreen('loading'); startSync(u.uid);
  });
}
