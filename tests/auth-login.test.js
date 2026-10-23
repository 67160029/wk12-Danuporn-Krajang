// ทดสอบเดิม: login ยังทำงานปกติหลังเพิ่ม rate limiter (NODE_ENV=test จึงใช้โควตาสูง)
jest.mock("dotenv", () => ({ config: jest.fn() }));
jest.mock("../db", () => ({ query: jest.fn(), getConnection: jest.fn() }));
jest.mock("../cache", () => ({
  redisClient: { del: jest.fn() },
  connectRedis: jest.fn(),
}));
jest.mock("../auth-helpers", () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
  generateToken: jest.fn(() => "fake-jwt-token"),
}));

const request = require("supertest");
const pool = require("../db");
const { verifyPassword } = require("../auth-helpers");
const app = require("../app");

const user = { id: 1, email: "a@example.com", password_hash: "h", role: "student" };

beforeEach(() => {
  pool.query.mockReset();
  verifyPassword.mockReset();
});

describe("POST /api/v1/auth/login", () => {
  test("ไม่ส่ง email/password -> 400", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("ไม่พบผู้ใช้ -> 401", async () => {
    pool.query.mockResolvedValue([[]]);
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "x@example.com", password: "pw" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  test("รหัสผ่านผิด -> 401", async () => {
    pool.query.mockResolvedValue([[user]]);
    verifyPassword.mockResolvedValue(false);
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "wrong" });
    expect(res.status).toBe(401);
  });

  test("รหัสผ่านถูก -> 200 และได้ token", async () => {
    pool.query.mockResolvedValue([[user]]);
    verifyPassword.mockResolvedValue(true);
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "right" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBe("fake-jwt-token");
  });

  test("GET / ยังตอบ 200", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
  });

  test("route ที่ไม่มี -> 404", async () => {
    const res = await request(app).get("/api/v1/nope");
    expect(res.status).toBe(404);
  });
});
