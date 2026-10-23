// mock-fail-server.js (สคริปต์ชั่วคราวสำหรับทดสอบด้วยมือตามขั้นตอน 3.3 ไม่ใช่ส่วนหนึ่งของแอป ไม่ต้องส่ง)
const http = require("http");

http
  .createServer((req, res) => {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "simulated server error" }));
  })
  .listen(4000, () => console.log("Mock failing server on port 4000"));
