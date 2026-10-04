// ล็อกอิน / ออกจากระบบด้วย Google
import { auth } from './firebase.js';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut }
  from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

export const watchAuth = cb => onAuthStateChanged(auth, cb);
export const logout = () => signOut(auth);
export function login() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({prompt: 'select_account'});   // ให้เลือกบัญชีทุกครั้ง (ใช้เครื่องเดียวกันหลายคนได้)
  return signInWithPopup(auth, provider);
}
