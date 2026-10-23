// schemas/studentSchema.js
// Conditional validation (สัปดาห์ที่ 12): ใช้ field `major` ที่มีอยู่จริงในตาราง students
// ถ้า major ขึ้นต้นด้วย "International" ต้องแนบ passportNumber มาด้วยเสมอ
// หมายเหตุ: passportNumber ใช้ตรวจสอบข้อมูลที่ส่งเข้ามาเท่านั้น ไม่มีคอลัมน์นี้ในตาราง students
const { z } = require("zod");

const createStudentSchema = z
  .object({
    name: z.string().min(2).max(100),
    major: z.string().min(1).max(100),
    email: z.email(),
    passportNumber: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // ป้องกันกรณี major ไม่ใช่ string (type error จะถูกรายงานโดย schema ด้านบนอยู่แล้ว)
    if (typeof data.major !== "string") return;

    const isInternational = data.major.startsWith("International");
    const hasPassport =
      typeof data.passportNumber === "string" &&
      data.passportNumber.trim() !== "";

    if (isInternational && !hasPassport) {
      ctx.addIssue({
        code: "custom",
        message: "ต้องระบุ passportNumber สำหรับสาขานานาชาติ",
        path: ["passportNumber"],
      });
    }
  });

module.exports = { createStudentSchema };
