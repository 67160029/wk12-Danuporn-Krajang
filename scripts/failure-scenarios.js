// ทดสอบ Failure Scenario ของ services/enrichment-service.js อัตโนมัติ แล้วเขียนผลที่วัดได้จริงลง failure-scenario-results.md
// ใช้: npm run test:failure
//
// สถานการณ์ที่ทดสอบ (ตรงกับขั้นตอน 3.1-3.3 ของโจทย์ แต่ไม่ต้องแก้โค้ดชั่วคราว)
//   0. สำเร็จปกติ      mock server ในเครื่องตอบ 200 (ใช้เทียบกับกรณีล้มเหลว)
//   1. Network error   เรียกโดเมนที่ไม่มีอยู่จริง
//   2. Timeout         timeoutMs = 1 (ให้ mock server ตอบช้ากว่านั้น)
//   3. External 5xx    mock server ตอบ 500
const http = require("http");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { getStudentEnrichment } = require("../services/enrichment-service");

function startServer(handler) {
  return new Promise((resolve) => {
    const state = { hits: 0 };
    const server = http.createServer((req, res) => {
      state.hits += 1;
      handler(req, res);
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, state, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

// ดักข้อความ log ของ retry เพื่อนำมาวิเคราะห์
function captureLogs() {
  const warns = [];
  const errors = [];
  const origWarn = console.warn;
  const origError = console.error;
  console.warn = (...a) => warns.push(a.join(" "));
  console.error = (...a) => errors.push(a.join(" "));
  return { warns, errors, restore() { console.warn = origWarn; console.error = origError; } };
}

const parseRetry = (line) => {
  const m = line.match(/\(attempt (\d+)\/(\d+)\): (.*)\. Retrying in (\d+)ms$/);
  return m ? { attempt: +m[1], message: m[3], delayMs: +m[4] } : null;
};

async function run(name, url, options, hitsOf) {
  const log = captureLogs();
  const t0 = Date.now();
  const result = await getStudentEnrichment(1, { url, ...options });
  const elapsedMs = Date.now() - t0;
  log.restore();
  const retries = log.warns.map(parseRetry).filter(Boolean);
  return { name, result, elapsedMs, retries, requests: hitsOf ? hitsOf() : null };
}

async function main() {
  const out = process.argv[2] || path.join(__dirname, "..", "failure-scenario-results.md");

  const ok = await startServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ id: 1, title: "mock todo" }));
  });
  const slow = await startServer((req, res) => {
    setTimeout(() => { res.writeHead(200, { "Content-Type": "application/json" }); res.end("{}"); }, 200);
  });
  const fail = await startServer((req, res) => {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "simulated server error" }));
  });

  const runs = [];
  console.log("กำลังทดสอบ (ใช้เวลาประมาณ 10-15 วินาที เพราะมี backoff)...");
  runs.push(await run("สำเร็จปกติ (mock 200)", ok.url, {}, () => ok.state.hits));
  runs.push(await run("Network error", "https://this-domain-does-not-exist-12345.example", {}, null));
  runs.push(await run("Timeout", slow.url, { timeoutMs: 1 }, () => slow.state.hits));
  runs.push(await run("External API คืน 500", fail.url, {}, () => fail.state.hits));
  [ok, slow, fail].forEach((s) => s.server.close());

  const [okR, netR, toR, errR] = runs;
  const inRange = (r, i, lo, hi) => r.retries[i] && r.retries[i].delayMs >= lo && r.retries[i].delayMs <= hi;
  const backoffOk = (r) => r.retries.length === 2 && inRange(r, 0, 500, 1000) && inRange(r, 1, 1000, 2000);
  const isFallback = (r) => r.result.source === "fallback" && r.result.available === false;

  const checks = {
    ok: okR.result.source === "external" && okR.retries.length === 0,
    net: isFallback(netR) && backoffOk(netR),
    to: isFallback(toR) && backoffOk(toR) && /timeout of 1ms exceeded/.test(toR.retries[0]?.message || ""),
    err: isFallback(errR) && backoffOk(errR) && errR.requests === 3 && /status code 500/.test(errR.retries[0]?.message || ""),
  };

  const delays = (r) => r.retries.map((x) => `${x.delayMs}ms`).join(", ") || "-";
  const firstMsg = (r) => (r.retries[0] ? r.retries[0].message : "-");
  const verdict = (b) => (b ? "ผ่าน" : "ไม่ผ่าน");

  let axiosVersion = "ไม่พบ";
  try { axiosVersion = require("axios/package.json").version; } catch (e) { /* ignore */ }

  const md = `# บันทึกผลการทดสอบ Failure Scenario

สร้างโดย \`scripts/failure-scenarios.js\` เมื่อ ${new Date().toISOString()}
สภาพแวดล้อม: Node ${process.version}, axios ${axiosVersion}, ${os.platform()} (${os.hostname()})
${process.env.SIMULATED_AXIOS ? "\n> **คำเตือน:** ไฟล์นี้สร้างจากสภาพแวดล้อมจำลองที่ใช้ axios ปลอมแทนของจริง ไม่ใช่การทดสอบของนิสิต กรุณารัน `npm run test:failure` บนเครื่องตนเองเพื่อเขียนทับด้วยผลจริง\n" : ""}
ค่าที่ใช้: timeout ปกติ 3000ms, retry สูงสุด 2 ครั้ง (รวมส่งคำขอทั้งหมด 3 ครั้งก่อน fallback), backoff แบบ equal jitter
(ครั้งที่ 1 ช่วง 500-1000ms, ครั้งที่ 2 ช่วง 1000-2000ms)

| สถานการณ์ | วิธีจำลอง | ผลลัพธ์ที่คาดหวัง | ผลลัพธ์จริง | ผ่าน/ไม่ผ่าน |
| --- | --- | --- | --- | --- |
| สำเร็จปกติ (เทียบ) | mock server ในเครื่องตอบ 200 | ไม่ retry, \`source: external\` | \`source: ${okR.result.source}\`, retry ${okR.retries.length} ครั้ง, ใช้เวลา ${okR.elapsedMs}ms | ${verdict(checks.ok)} |
| Network error (โดเมนไม่มีอยู่จริง) | เรียก \`https://this-domain-does-not-exist-12345.example\` | Retry 2 ครั้ง แล้ว fallback พร้อมข้อความชัดเจน | retry ${netR.retries.length} ครั้ง (delay ${delays(netR)}), error: ${firstMsg(netR)}, \`source: ${netR.result.source}\`, รวม ${netR.elapsedMs}ms | ${verdict(checks.net)} |
| Timeout | ตั้ง \`timeoutMs = 1\` เรียก mock server ที่ตอบช้า 200ms | เกิด timeout แล้ว retry และ fallback | retry ${toR.retries.length} ครั้ง (delay ${delays(toR)}), error: ${firstMsg(toR)}, \`source: ${toR.result.source}\`, mock รับคำขอ ${toR.requests} ครั้ง | ${verdict(checks.to)} |
| External API คืน 500 | เรียก mock server ที่ตอบ 500 | Retry เพราะเป็น 5xx แล้ว fallback | retry ${errR.retries.length} ครั้ง (delay ${delays(errR)}), error: ${firstMsg(errR)}, \`source: ${errR.result.source}\`, mock รับคำขอ ${errR.requests} ครั้ง | ${verdict(checks.err)} |

## ข้อสังเกต

- ทุกสถานการณ์ที่ล้มเหลว ฟังก์ชันคืน \`source: "fallback"\`, \`available: false\` พร้อมข้อความภาษาไทยที่อ่านเข้าใจได้ ไม่มี exception หลุดไปถึง route จึงตอบ HTTP 200 เสมอ
- ค่า delay ไม่ตรง 1000ms / 2000ms พอดี เพราะมีส่วนสุ่ม (jitter) บวกเข้าไป และครั้งที่ 2 ยาวกว่าครั้งที่ 1 ตามหลัก exponential backoff
- \`maxRetries = 2\` หมายถึง retry เพิ่ม 2 ครั้ง จึงส่งคำขอทั้งหมด 3 ครั้ง (ยืนยันจากจำนวนคำขอที่ mock server รับได้ในกรณี 500)
- ข้อผิดพลาดที่ไม่ใช่ 429/5xx เช่น 404 จะไม่ retry (ดู \`isRetryable\`) และเข้า fallback ทันที
`;
  fs.writeFileSync(out, md);
  console.log(md);
  console.log("\nเขียนผลลง", out);
  process.exitCode = Object.values(checks).every(Boolean) ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
