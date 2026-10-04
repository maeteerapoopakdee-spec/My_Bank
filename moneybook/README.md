# สมุดรายรับรายจ่าย

เว็บบันทึกรายรับ–รายจ่ายรายวัน ล็อกอินด้วย Google ข้อมูลเก็บบนคลาวด์ (Firebase) แยกตามบัญชี
ใครล็อกอินด้วยเมลไหนก็เห็นเฉพาะข้อมูลของเมลนั้น เปิดจากมือถือ/คอมก็เห็นเหมือนกัน

ไม่ต้องใช้ Node, npm หรือ build ใดๆ — เป็นไฟล์ HTML/CSS/JS ล้วน ขึ้น GitHub Pages ได้ตรงๆ

## โครงสร้างไฟล์

```
.
├─ index.html              โครงหน้าเว็บ (HTML)
├─ css/
│  └─ style.css            ตกแต่งทั้งหมด
├─ js/
│  ├─ app.js               ควบคุมหน้าจอ: วาด UI, รับการกดปุ่ม
│  ├─ auth.js              ล็อกอิน/ออกจากระบบด้วย Google
│  ├─ store.js             อ่าน/เขียนข้อมูลบน Firestore
│  ├─ calc.js              คำนวณยอดแต่ละเดือน
│  ├─ export.js            ส่งออก CSV / สำรอง-นำเข้า JSON
│  ├─ utils.js             ฟังก์ชันช่วย (วันที่ไทย, จัดรูปแบบเงิน, toast)
│  ├─ config.js            เดือนเริ่มต้น, จำนวนรายการต่อหน้า
│  ├─ firebase.js          เริ่มต้น Firebase
│  └─ firebase-config.js   ★ ค่าตั้งค่าโปรเจกต์ Firebase (ต้องใส่เอง)
├─ firestore.rules         กฎความปลอดภัยของฐานข้อมูล (วางใน Firebase Console)
└─ README.md
```

## ตั้งค่า Firebase (ทำครั้งเดียว ประมาณ 10 นาที ฟรี)

1. เข้า <https://console.firebase.google.com> ล็อกอินด้วย Google → **Create a project** (ตั้งชื่ออะไรก็ได้ ปิด Analytics ได้)
2. **Authentication** → Get started → แท็บ **Sign-in method** → เปิด **Google** → ใส่อีเมลซัพพอร์ต → Save
3. **Firestore Database** → Create database → เลือกโหมด **Production** → Location เลือก `asia-southeast1` (สิงคโปร์ ใกล้ไทย)
4. แท็บ **Rules** ของ Firestore → ลบของเดิม แล้ววางเนื้อหาจากไฟล์ `firestore.rules` → **Publish**
5. ไอคอนเฟือง → **Project settings** → เลื่อนลงที่ Your apps → กดไอคอน **`</>`** (Web) → ตั้งชื่อแอป → Register
   จะได้ค่า `firebaseConfig` ให้คัดลอกมาใส่ใน `js/firebase-config.js`
6. **Authentication → Settings → Authorized domains** → Add domain → ใส่ `ชื่อuser.github.io`
   (`localhost` มีให้อยู่แล้ว)

> ค่าใน `firebase-config.js` ไม่ใช่ความลับ ใส่ลง GitHub ได้ ความปลอดภัยอยู่ที่ `firestore.rules`
> ซึ่งบังคับว่าแต่ละคนอ่าน/เขียนได้เฉพาะข้อมูลของ uid ตัวเอง

## ขึ้น GitHub Pages

1. สร้าง repo ใหม่ แล้วอัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ (ให้ `index.html` อยู่ที่ root)
2. Settings → Pages → Source: **Deploy from a branch** → branch `main` / `(root)` → Save
3. รอสักครู่ จะได้ลิงก์ `https://ชื่อuser.github.io/ชื่อrepo/` ส่งให้แฟนใช้ได้เลย แค่ล็อกอินด้วย Google ของตัวเอง
   (ถ้าเปิดไม่ขึ้น/ล็อกอินไม่ได้ ให้เช็กข้อ 6 ด้านบนว่าเพิ่มโดเมนแล้ว)

## ทดสอบในเครื่อง

เปิดไฟล์ `index.html` ตรงๆ ไม่ได้ (ES modules ต้องเปิดผ่านเซิร์ฟเวอร์) ให้รันอย่างใดอย่างหนึ่งในโฟลเดอร์นี้:

```bash
python -m http.server 8000      # แล้วเปิด http://localhost:8000
# หรือ
npx serve
```

## โครงสร้างข้อมูลบน Firestore

```
users/{uid}/tx/{id}           = { date: "2026-10-04", type: "in" | "out", amount: 90, note: "ข้าวเย็น", ts: <เวลาที่กดบันทึก> }
users/{uid}/months/{YYYY-MM}  = { income: 12000 }
```

- เดือนเริ่มต้นแก้ที่ `START` ใน `js/config.js`
- ส่งออก Excel: ปุ่ม "ส่งออกเป็น Excel (.csv)" ท้ายหน้า
- ย้ายข้อมูลจากเวอร์ชันไฟล์เดียวเดิม: กด "สำรอง (.json)" ในเวอร์ชันเก่า แล้วล็อกอินเวอร์ชันนี้ กด "นำเข้าจาก .json"
- ใช้ออฟไลน์ได้ชั่วคราว เมื่อกลับมาออนไลน์จะซิงก์ขึ้นคลาวด์เอง
