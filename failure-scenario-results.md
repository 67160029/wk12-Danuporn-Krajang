# บันทึกผลการทดสอบ Failure Scenario

สร้างโดย `scripts/failure-scenarios.js` เมื่อ 2026-10-23T08:31:54.776Z
สภาพแวดล้อม: Node v24.21.0, axios 1.20.0, win32 (DESKTOP-M05RE6S)

ค่าที่ใช้: timeout ปกติ 3000ms, retry สูงสุด 2 ครั้ง (รวมส่งคำขอทั้งหมด 3 ครั้งก่อน fallback), backoff แบบ equal jitter
(ครั้งที่ 1 ช่วง 500-1000ms, ครั้งที่ 2 ช่วง 1000-2000ms)

| สถานการณ์ | วิธีจำลอง | ผลลัพธ์ที่คาดหวัง | ผลลัพธ์จริง | ผ่าน/ไม่ผ่าน |
| --- | --- | --- | --- | --- |
| สำเร็จปกติ (เทียบ) | mock server ในเครื่องตอบ 200 | ไม่ retry, `source: external` | `source: external`, retry 0 ครั้ง, ใช้เวลา 13ms | ผ่าน |
| Network error (โดเมนไม่มีอยู่จริง) | เรียก `https://this-domain-does-not-exist-12345.example` | Retry 2 ครั้ง แล้ว fallback พร้อมข้อความชัดเจน | retry 2 ครั้ง (delay 748ms, 1069ms), error: getaddrinfo ENOTFOUND this-domain-does-not-exist-12345.example, `source: fallback`, รวม 1850ms | ผ่าน |
| Timeout | ตั้ง `timeoutMs = 1` เรียก mock server ที่ตอบช้า 200ms | เกิด timeout แล้ว retry และ fallback | retry 2 ครั้ง (delay 916ms, 1143ms), error: timeout of 1ms exceeded, `source: fallback`, mock รับคำขอ 1 ครั้ง | ผ่าน |
| External API คืน 500 | เรียก mock server ที่ตอบ 500 | Retry เพราะเป็น 5xx แล้ว fallback | retry 2 ครั้ง (delay 934ms, 1822ms), error: Request failed with status code 500, `source: fallback`, mock รับคำขอ 3 ครั้ง | ผ่าน |

## ข้อสังเกต

- ทุกสถานการณ์ที่ล้มเหลว ฟังก์ชันคืน `source: "fallback"`, `available: false` พร้อมข้อความภาษาไทยที่อ่านเข้าใจได้ ไม่มี exception หลุดไปถึง route จึงตอบ HTTP 200 เสมอ
- ค่า delay ไม่ตรง 1000ms / 2000ms พอดี เพราะมีส่วนสุ่ม (jitter) บวกเข้าไป และครั้งที่ 2 ยาวกว่าครั้งที่ 1 ตามหลัก exponential backoff
- `maxRetries = 2` หมายถึง retry เพิ่ม 2 ครั้ง จึงส่งคำขอทั้งหมด 3 ครั้ง (ยืนยันจากจำนวนคำขอที่ mock server รับได้ในกรณี 500)
- ข้อผิดพลาดที่ไม่ใช่ 429/5xx เช่น 404 จะไม่ retry (ดู `isRetryable`) และเข้า fallback ทันที
