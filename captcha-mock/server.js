const http = require("http");

const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
    return;
  }

  // CAPTCHA Verification endpoint
  if (req.url === "/verify" && req.method === "POST") {
    // จำลอง processing time แบบสมจริง (variable latency 80-150ms)
    // สะท้อนพฤติกรรมจริงของ reCAPTCHA/Turnstile API
    const delay = 80 + Math.random() * 70;

    const body = [];
    req.on("data", (chunk) => body.push(chunk));
    req.on("end", () => {
      setTimeout(() => {
        try {
          const data = JSON.parse(Buffer.concat(body).toString() || "{}");
          const isValid = data.token === "valid-token-from-bot";

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              success: isValid,
              score: isValid ? 0.9 : 0.1,
              action: "login",
              challenge_ts: new Date().toISOString(),
            })
          );
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "Invalid request" }));
        }
      }, delay);
    });
    return;
  }

  // Fallback
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`[CAPTCHA-MOCK] Server listening on port ${PORT}`);
});
