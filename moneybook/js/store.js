// ชั้นข้อมูล: อ่าน/เขียน Firestore ของผู้ใช้ที่ล็อกอิน แล้วเก็บสำเนาไว้ใน state
// โครงสร้าง:  users/{uid}/tx/{id}        = {date, type, amount, note, ts}
//            users/{uid}/months/{YYYY-MM} = {income}
import { db } from './firebase.js';
import { collection, doc, onSnapshot, writeBatch, setDoc, updateDoc, deleteDoc }
  from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

export const state = {months: {}, tx: [], ready: false};
let uid = null, unsubs = [], errorHandler = console.error;
const listeners = new Set(), timers = {};

export const onChange = fn => listeners.add(fn);
export const onSyncError = fn => { errorHandler = fn; };
const emit = () => listeners.forEach(fn => fn());
const txCol = () => collection(db, 'users', uid, 'tx');

export function startSync(userId) {
  stopSync(); uid = userId;
  let gotTx = false, gotMonths = false;
  const check = () => { if (gotTx && gotMonths) state.ready = true; emit(); };
  unsubs.push(onSnapshot(txCol(), snap => {
    state.tx = snap.docs.map(d => ({id: d.id, ...d.data()})); gotTx = true; check();
  }, e => errorHandler(e)));
  unsubs.push(onSnapshot(collection(db, 'users', uid, 'months'), snap => {
    state.months = {}; snap.forEach(d => { state.months[d.id] = d.data(); }); gotMonths = true; check();
  }, e => errorHandler(e)));
}

export function stopSync() {
  unsubs.forEach(u => u()); unsubs = []; uid = null;
  state.tx = []; state.months = {}; state.ready = false;
}

// เพิ่มหลายรายการในครั้งเดียว: [{date, type:'in'|'out', amount, note}]
export function addTx(list) {
  const batch = writeBatch(db), base = Date.now();
  list.forEach((t, i) => batch.set(doc(txCol()), {...t, ts: base + i}));
  return batch.commit();
}
export const updateTx = (id, patch) => updateDoc(doc(db, 'users', uid, 'tx', id), patch);
export const deleteTx = id => deleteDoc(doc(db, 'users', uid, 'tx', id));

// รายได้ประจำเดือน: อัปเดตหน้าจอทันที แล้วค่อยเขียนขึ้นคลาวด์หลังหยุดพิมพ์
export function setMonthIncome(ym, income) {
  state.months[ym] = {...state.months[ym], income}; emit();
  clearTimeout(timers[ym]);
  const u = uid;
  timers[ym] = setTimeout(() =>
    setDoc(doc(db, 'users', u, 'months', ym), {income}, {merge: true}).catch(e => errorHandler(e)), 600);
}

// นำเข้าจากไฟล์ .json (เพิ่มเข้าไปในข้อมูลเดิม)
export async function importData(d) {
  const ops = [];
  Object.entries(d.months || {}).forEach(([ym, v]) =>
    ops.push([doc(db, 'users', uid, 'months', ym), {income: Number(v.income) || 0}]));
  const tag = Date.now().toString(36);
  (d.tx || []).filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t.date) && Number(t.amount) > 0).forEach((t, i) => {
    const data = {date: t.date, type: t.type === 'in' ? 'in' : 'out', amount: Number(t.amount), note: t.note || ''};
    if (t.ts) data.ts = t.ts;
    ops.push([doc(db, 'users', uid, 'tx', `imp-${tag}-${String(i).padStart(5, '0')}`), data]);
  });
  for (let i = 0; i < ops.length; i += 400) {            // Firestore จำกัด 500 รายการต่อ batch
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach(([ref, data]) => batch.set(ref, data));
    await batch.commit();
  }
}
