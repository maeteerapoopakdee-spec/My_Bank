// เริ่มต้น Firebase (Auth + Firestore) — โหลดจาก CDN ไม่ต้องติดตั้งอะไร
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager }
  from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

export const configured = !!firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('YOUR_');
export let auth = null, db = null;

if (configured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  // เก็บแคชในเครื่อง: ใช้ออฟไลน์ได้ แล้วซิงก์ขึ้นคลาวด์เมื่อกลับมาออนไลน์
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()}),
  });
}
