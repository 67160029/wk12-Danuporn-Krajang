// จุดตรวจสอบที่ 2/แบบฝึกหัดข้อ 5: rate limiter แยกโควตา
// ไฟล์นี้ตั้ง NODE_ENV=production ก่อน require app เพื่อใช้โควตาจริง (login = 5 ครั้ง)
// Jest แยก module registry ต่อไฟล์ จึงไม่กระทบไฟล์ test อื่นที่ใช้โควตาสูงของโหมด test
process.env.NODE_ENV = "production";
delete process.env.AUTH_RATE_LIMIT_MAX;

jest.mock("dotenv", () => ({ config: jest.fn() }));
jest.mock("../db", () => ({ query: jest.fn(), getConnection: jest.fn() }));
jest.mock("../cache", () => ({
  redisClient: { del: jest.fn() },
  connectRedis: jest.fn(),
}));
jest.mock("../auth-helpers", () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
  generateToken: jest.fn(),
}));

const request = require("supertest");
const pool = require("../db");
const app = require("../app");

describe("authLimiter: 5 ครั้ง / 15 นาที", () => {
  test("login ครั้งที่ 1-5 ผ่านโควตา (401) ครั้งที่ 6 ได้ 429 พร้อม header RateLimit", async () => {
    pool.query.mockResolvedValue([[]]); // ไม่พบผู้ใช้ -> 401

    for (let i = 1; i <= 5; i++) {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "attacker@example.com", password: `wrong-${i}` });
      expect(res.status).toBe(401);
    }

    const blocked = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "attacker@example.com", password: "wrong-6" });

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("TOO_MANY_REQUESTS");

    const rateLimit = blocked.headers["ratelimit"];
    expect(rateLimit).toContain("limit=5");
    expect(rateLimit).toContain("remaining=0");
    expect(rateLimit).toContain("reset=");
    expect(blocked.headers["ratelimit-policy"]).toBeDefined();
  });

  test("โควตาแยกกัน: login ถูกบล็อกแล้ว endpoint อื่นยังใช้งานได้ (generalLimiter)", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.headers["ratelimit"]).toContain("limit=100");
  });
});
