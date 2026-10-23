// สร้าง (หรืออัปเดต) ผู้ใช้ role admin สำหรับโฟลเดอร์ "Cleanup (admin)" ใน Postman Collection
// ใช้: npm run seed:admin
// กำหนดค่าเองได้ด้วย ADMIN_EMAIL / ADMIN_PASSWORD (ค่าเริ่มต้นตรงกับ environment.json)
require("dotenv").config();

const pool = require("../db");
const { hashPassword } = require("../auth-helpers");

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@example.com";
  const password = process.env.ADMIN_PASSWORD || "Admin@1234";

  const passwordHash = await hashPassword(password);

  await pool.query(
    `INSERT INTO users (email, password_hash, role)
     VALUES (?, ?, 'admin')
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'admin'`,
    [email, passwordHash],
  );

  console.log(`พร้อมใช้งานบัญชี admin: ${email}`);
}

main()
  .catch((err) => {
    console.error("สร้างบัญชี admin ไม่สำเร็จ:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
