// services/enrichment-service.js
const { fetchWithRetry } = require("./external-api");

// options (ไม่บังคับ) ใช้เฉพาะตอนทดสอบ failure scenario โดยไม่ต้องแก้โค้ดชั่วคราว
// เช่น scripts/failure-scenarios.js เรียกแบบ getStudentEnrichment(1, { url, timeoutMs })
// การเรียกใช้งานปกติ getStudentEnrichment(id) ใช้ค่าเริ่มต้นตามโจทย์ทุกประการ
async function getStudentEnrichment(studentId, options = {}) {
  const {
    url = `https://jsonplaceholder.typicode.com/todos/${studentId}`,
    timeoutMs = 3000,
    maxRetries = 2,
  } = options;

  try {
    const data = await fetchWithRetry(url, timeoutMs, maxRetries);
    return {
      source: "external",
      available: true,
      note: data.title,
    };
  } catch (error) {
    console.error(
      `[enrichment-service] external API unavailable after retries: ${error.message}`,
    );
    return {
      source: "fallback",
      available: false,
      note: "ไม่สามารถดึงข้อมูลเสริมจากบริการภายนอกได้ในขณะนี้ กรุณาลองใหม่ภายหลัง",
    };
  }
}

module.exports = { getStudentEnrichment };
