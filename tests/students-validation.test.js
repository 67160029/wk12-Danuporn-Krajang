// จุดตรวจสอบที่ 2: POST /api/v1/students validate ถูกต้อง (Zod + conditional validation)
jest.mock("dotenv", () => ({ config: jest.fn() }));
jest.mock("../db", () => ({ query: jest.fn(), getConnection: jest.fn() }));
jest.mock("../cache", () => ({
  redisClient: { del: jest.fn().mockResolvedValue(1) },
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

beforeEach(() => {
  pool.query.mockReset();
  pool.query.mockResolvedValue([{ insertId: 1 }]);
});

describe("POST /api/v1/students (wk12 validation)", () => {
  test("International ไม่มี passportNumber -> 400 และ details ชี้ passportNumber", async () => {
    const res = await request(app).post("/api/v1/students").send({
      name: "John Smith",
      email: "john@example.com",
      major: "International Business",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual([
      {
        field: "passportNumber",
        message: "ต้องระบุ passportNumber สำหรับสาขานานาชาติ",
      },
    ]);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("International ที่มี passportNumber -> 201 และไม่ส่ง passportNumber ไป INSERT", async () => {
    const res = await request(app).post("/api/v1/students").send({
      name: "John Smith",
      email: "john@example.com",
      major: "International Business",
      passportNumber: "AA1234567",
    });

    expect(res.status).toBe(201);
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain("INSERT INTO students (name, major, email)");
    expect(params).toEqual(["John Smith", "International Business", "john@example.com"]);
    expect(res.body.data).not.toHaveProperty("passportNumber");
  });

  test("สาขาปกติไม่ต้องมี passportNumber -> 201", async () => {
    const res = await request(app).post("/api/v1/students").send({
      name: "นิสิต ทดสอบ",
      major: "วิทยาการคอมพิวเตอร์",
      email: "test@example.com",
    });
    expect(res.status).toBe(201);
  });

  test("ขาด field -> 400 VALIDATION_ERROR", async () => {
    const res = await request(app)
      .post("/api/v1/students")
      .send({ name: "ไม่มี major และ email" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(["major", "email"]));
  });

  test("email รูปแบบผิด -> 400 details ชี้ email", async () => {
    const res = await request(app).post("/api/v1/students").send({
      name: "นิสิต ทดสอบ",
      major: "วิทยาการคอมพิวเตอร์",
      email: "not-an-email",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain("email");
  });

  test("Type confusion (name เป็นตัวเลข, email เป็น boolean) -> 400", async () => {
    const res = await request(app)
      .post("/api/v1/students")
      .send({ name: 123, major: "x", email: true });
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("SQL injection ใน name ถูกส่งเป็น parameter ไม่ถูกต่อเข้า SQL", async () => {
    const payload = "'; DROP TABLE students; --";
    const res = await request(app).post("/api/v1/students").send({
      name: payload,
      major: "x",
      email: "inj@example.com",
    });
    expect(res.status).toBe(201);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).not.toContain("DROP TABLE");
    expect(params[0]).toBe(payload);
  });

  test("email ซ้ำ (ER_DUP_ENTRY) -> 409 ยังทำงานเหมือนเดิม", async () => {
    pool.query.mockRejectedValueOnce({ code: "ER_DUP_ENTRY" });
    const res = await request(app).post("/api/v1/students").send({
      name: "นิสิต ซ้ำ",
      major: "x",
      email: "dup@example.com",
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_EMAIL");
  });
});
