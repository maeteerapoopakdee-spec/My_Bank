// ชั้นข้อมูล: อ่าน/เขียน Firestore ของผู้ใช้ที่ล็อกอิน แล้วเก็บสำเนาไว้ใน state
// โครงสร้าง:  users/{uid}/tx/{id}        = {date, type, amount, note, ts}
import { db } from './firebase.js';
import { collection, doc, onSnapshot, writeBatch, updateDoc, deleteDoc }
  from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

export const state = {tx: [], ready: false};
let uid = null, unsubs = [], errorHandler = console.error;
const listeners = new Set();

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
  // เวอร์ชันก่อนหน้าเคยมีช่อง "รายได้ประจำเดือน" แยกต่างหาก → แปลงเป็นรายการรายรับปกติของวันที่ 1 (ทำครั้งเดียว ยอดไม่เปลี่ยน)
  const u = uid;
  unsubs.push(onSnapshot(collection(db, 'users', u, 'months'), snap => {
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.forEach(d => {
        const income = Number(d.data().income) || 0;
        if (income > 0) batch.set(doc(db, 'users', u, 'tx', `salary-${d.id}`), {date: `${d.id}-01`, type: 'in', amount: income, note: 'รายได้ประจำเดือน'});
        batch.delete(d.ref);
      });
      batch.commit().catch(e => errorHandler(e));
    }
    gotMonths = true; check();
  }, e => errorHandler(e)));
}

export function stopSync() {
  unsubs.forEach(u => u()); unsubs = []; uid = null;
  state.tx = []; state.ready = false;
}

// เพิ่มหลายรายการในครั้งเดียว: [{date, type:'in'|'out', amount, note}]
export function addTx(list) {
  const batch = writeBatch(db), base = Date.now();
  list.forEach((t, i) => batch.set(doc(txCol()), {...t, ts: base + i}));
  return batch.commit();
}
export const updateTx = (id, patch) => updateDoc(doc(db, 'users', uid, 'tx', id), patch);
export const deleteTx = id => deleteDoc(doc(db, 'users', uid, 'tx', id));

// นำเข้าจากไฟล์ .json (เพิ่มเข้าไปในข้อมูลเดิม)
export async function importData(d) {
  const ops = [];
  Object.entries(d.months || {}).forEach(([ym, v]) => {      // ไฟล์สำรองเก่า: รายได้ประจำเดือน → รายรับปกติ
    if (Number(v.income) > 0) ops.push([doc(db, 'users', uid, 'tx', `salary-${ym}`), {date: `${ym}-01`, type: 'in', amount: Number(v.income), note: 'รายได้ประจำเดือน'}]);
  });
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
