// middlewares/rateLimiter.js
// Rate limiter แยกโควตาตามความเสี่ยงของ endpoint (สัปดาห์ที่ 12)
const rateLimit = require("express-rate-limit");

const isTest = process.env.NODE_ENV === "test";

// โควตาของ /api/v1/auth/login: 5 ครั้ง / 15 นาที (ต่อ IP)
// - NODE_ENV=test จะเพิ่มเป็น 1000 เพื่อไม่ให้ชุดทดสอบอัตโนมัติถูกบล็อก
// - ตั้ง AUTH_RATE_LIMIT_MAX ใน .env เพื่อเพิ่มโควตาชั่วคราวตอนรัน Newman ซ้ำ ๆ
//   (อย่าตั้งค่านี้ตอนทดสอบ Brute-force ใน Postman ส่วนที่ 3)
const authMax =
  Number(process.env.AUTH_RATE_LIMIT_MAX) || (isTest ? 1000 : 5);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: authMax,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "พยายามเข้าสู่ระบบเกินจำนวนที่กำหนด กรุณาลองใหม่ภายหลัง",
    },
  },
});

// โควตาทั่วไปของทุก endpoint: 100 ครั้ง / นาที (ต่อ IP)
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTest ? 100000 : 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "ส่งคำขอถี่เกินไป กรุณาลองใหม่ภายหลัง",
    },
  },
});

module.exports = { authLimiter, generalLimiter };
