# วิธีการทดลอง (Experimental Methodology)

## 1. ภาพรวมการทดลอง

งานวิจัยนี้ทดสอบประสิทธิภาพการป้องกัน Botnet ของระบบ Authentication 4 แบบ (5 scenarios) โดยจำลองการโจมตีแบบ Distributed Botnet ภายใต้สภาพแวดล้อม Docker Container ที่ควบคุมตัวแปรอย่างเข้มงวด

### สถาปัตยกรรมระบบ

```
┌──────────────────────────────────────────────────────────────┐
│  Docker Compose Environment                                  │
│                                                              │
│  ┌──────────┐     HTTP POST     ┌──────────┐    SQL Query   │
│  │ Attacker │ ────────────────→ │   Web    │ ─────────────→ │
│  │   Bot    │  (IP Spoofed)     │  Server  │                │
│  │ ×5 nodes │ ←────────────────│ (Next.js)│ ←───────────── │
│  └──────────┘   401/403/429     └──────────┘                │
│                                      │                       │
│                                      │  HTTP POST            │
│                                      ↓                       │
│                              ┌──────────────┐               │
│                              │ CAPTCHA Mock  │               │
│                              │   Server      │               │
│                              │  (Node.js)    │               │
│                              └──────────────┘               │
│                                      │                       │
│                                      ↓                       │
│                              ┌──────────────┐               │
│                              │  PostgreSQL   │               │
│                              │   Database    │               │
│                              └──────────────┘               │
└──────────────────────────────────────────────────────────────┘
```

| Component     | Technology                    | รายละเอียด                                              |
| ------------- | ----------------------------- | ------------------------------------------------------- |
| Web Server    | Next.js (Node.js)             | Victim server ที่มี 4 Login endpoints                   |
| Database      | PostgreSQL 14 Alpine          | เก็บข้อมูล User และ Attack Logs                         |
| CAPTCHA Mock  | Node.js (HTTP Server)         | จำลอง 3rd-party CAPTCHA API (variable latency 80-150ms) |
| Attacker Bot  | Python (requests + threading) | จำลอง Distributed Botnet                                |
| Orchestration | Docker Compose + Bash Script  | ควบคุมลำดับการทดลอง                                     |

---

## 2. ตัวแปรที่ควบคุม (Controlled Variables)

| ตัวแปร                | ค่า                                               | เหตุผล                          |
| --------------------- | ------------------------------------------------- | ------------------------------- |
| จำนวน Bot Containers  | 5                                                 | จำลอง 5 nodes ของ Botnet        |
| Threads ต่อ Container | 10                                                | รวม 50 threads ยิงพร้อมกัน      |
| ระยะเวลาโจมตี         | 60 วินาที                                         | เวลาพอสำหรับเก็บข้อมูลเชิงสถิติ |
| จำนวนรอบทดลอง         | 3 รอบ                                             | คำนวณ mean ± std dev            |
| IP Spoofing Mode      | `pool` (50 IPs) หรือ `random` (ตามแต่ละ scenario) | จำลอง Botnet 2 ระดับ            |
| Warm-up Filter        | ตัด 5 วินาทีแรกออก                                | กำจัด cold-start bias           |
| Username              | `admin` (คงที่)                                   | ทดสอบ brute-force password      |
| Password              | สุ่มใหม่ทุก request                               | จำลอง credential stuffing       |

### การแยกสภาพแวดล้อม (Isolation)

ทุก scenario ใช้ Docker Container ที่สร้างใหม่ทั้งหมด (`docker compose down -v` ระหว่างแต่ละ test) เพื่อ:

- ล้าง Database → ไม่มี residual data จาก test ก่อนหน้า
- ล้าง Memory → Node.js เริ่ม fresh ไม่มี JIT compilation cache
- ล้าง Network → ไม่มี connection pool reuse

---

## 3. Attacker Bot (attack.py)

### วิธีการโจมตี

Bot แต่ละตัวทำงานดังนี้:

```
1. อ่าน TARGET_ENDPOINT และ SPOOF_MODE จาก Environment Variable
2. Pre-generate IP Pool (ขนาด IP_POOL_SIZE) ตอนเริ่มต้น
3. รอ 5 วินาที ให้ Web Server พร้อม
4. สร้าง ThreadPoolExecutor (10 threads)
5. แต่ละ thread วน loop:
   a. สร้าง random password (16 ตัวอักษร)
   b. เลือก IP ตาม SPOOF_MODE:
      - "pool"   → สุ่มจาก pre-generated IP Pool
      - "random" → สร้าง IP ใหม่ทุก request
      - "fixed"  → ใช้ IP จริงของ Container
   c. ส่ง POST request → http://web:3000/api/login/{endpoint}
   d. timeout = 1 วินาที
6. เมื่อครบ DURATION → ส่ง stop_event ให้ทุก thread หยุด
```

### IP Spoofing Modes

| Mode     | พฤติกรรม                        | จำลอง                             |
| -------- | ------------------------------- | --------------------------------- |
| `pool`   | สุ่มจาก Pool 50 IPs ที่สร้างไว้ | Cheap Botnet / Datacenter Proxies |
| `random` | สร้าง IP ใหม่ทุก request        | Advanced Residential Proxy Botnet |
| `fixed`  | ใช้ IP จริงของ Container        | การโจมตีจาก IP เดียว              |

**IP Pool (50 IPs × 5 Containers = 250 IPs):**

- แต่ละ Container สร้าง Pool 50 IPs ตอน startup
- ที่ 1,000 req/sec รวม 60 วินาที → 60,000 requests กระจายใน 250 IPs
- เฉลี่ย 240 requests/IP/นาที → เกินกว่า Rate Limit threshold (5 req/IP/min) → Rate Limiter ทำงานได้

---

## 4. Authentication Methods (5 Scenarios)

### 4.1 Basic Login (`/api/login/basic`)

**ไม่มีการป้องกัน** — ใช้เป็น Baseline สำหรับเปรียบเทียบ

```
Request → Parse JSON → Query Database (username) → เช็ค Password → Response
```

| ขั้นตอน        | รายละเอียด                           |
| -------------- | ------------------------------------ |
| Input          | `{ username, password }`             |
| การตรวจสอบ     | Query `users` table → เทียบ password |
| Response       | 200 (สำเร็จ) หรือ 401 (ล้มเหลว)      |
| Overhead เพิ่ม | ไม่มี                                |

---

### 4.2 Rate-Limited Login — IP Pool (`/api/login/rate-limit`)

**จำกัดจำนวน request ต่อ IP** — ใช้ In-Memory Map เก็บจำนวน request ต่อ IP

**Scenario A: IP Pool (Cheap Botnet)**

Bot ใช้ `SPOOF_MODE=pool` → สุ่มจาก IP Pool จำกัด 50 IPs ต่อ Container

```
Request → Parse JSON → ตรวจ Rate Limit Map → [ผ่าน] → Query DB → Response
                                             → [ไม่ผ่าน] → 429 Too Many Requests
```

| ขั้นตอน       | รายละเอียด                                  |
| ------------- | ------------------------------------------- |
| Input         | `{ username, password }`                    |
| Rate Limit    | สูงสุด 5 requests / IP / 60 วินาที          |
| Storage       | `Map<IP, { count, resetTime }>` (in-memory) |
| ถ้าเกิน limit | Return 429 ทันที (ไม่ query DB)             |

**ผลที่คาดหวัง:** เนื่องจาก IP ซ้ำบ่อย Rate Limiter บล็อก IP ที่ยิงเกิน threshold ได้ → มี 429 status code ในผลลัพธ์

---

### 4.3 Rate-Limited Login — Random IP (`/api/login/rate-limit`)

**Scenario B: Random IP (Advanced Botnet)**

Bot ใช้ `SPOOF_MODE=random` → สุ่ม IP ใหม่ทุก request (เหมือน Residential Proxy Botnet)

| ขั้นตอน      | รายละเอียด                                          |
| ------------ | --------------------------------------------------- |
| Endpoint     | ใช้ endpoint เดียวกับ Scenario A                    |
| Bot IP Mode  | สุ่ม IP ใหม่ทุก request → ทุก request มาจาก IP ใหม่ |
| ผลที่คาดหวัง | Rate Limiter ไม่สามารถ block ได้ → Block Rate ≈ 0%  |
| วัตถุประสงค์ | แสดงขีดจำกัดของ IP-based Rate Limiting              |

**การเปรียบเทียบ Scenario A vs B:** ช่วยให้เห็นว่าประสิทธิภาพ Rate Limit แปรผกผันกับความซับซ้อนของฝั่งโจมตี

---

### 4.4 CAPTCHA Login (`/api/login/captcha`)

**จำลอง Google reCAPTCHA / Cloudflare Turnstile** — Web Server ยิง HTTP Request ไปที่ Mock CAPTCHA API จริง

```
Request → Parse JSON → HTTP POST ไป captcha-mock:4000/verify → ตรวจ CAPTCHA Token
                     → [ผ่าน] → Query DB → Response
                     → [ไม่ผ่าน] → 403 Forbidden
```

| ขั้นตอน       | รายละเอียด                                                         |
| ------------- | ------------------------------------------------------------------ |
| Input         | `{ username, password, captchaToken }`                             |
| Step 1        | `fetch(CAPTCHA_VERIFY_URL)` — ยิง HTTP POST ไปที่ Mock Server จริง |
| Mock Server   | Variable latency 80-150ms (สมจริงเหมือน 3rd-party API)             |
| Connection    | ปิด Keep-Alive (`Connection: close`) → TCP Handshake ทุก request   |
| Step 2        | ตรวจ `verifyResult.success` จาก API response                       |
| ถ้า token ผิด | Return 403 (bot ส่ง random token → ไม่ผ่านเสมอ)                    |
| Overhead      | **Real HTTP I/O** (network round-trip + TCP handshake)             |

**ทำไมลด throughput:** ทุก request ต้องยิง HTTP ออกไปจริงพร้อม TCP handshake → เห็นพฤติกรรม Connection Pool ที่สมจริง ไม่ใช่ fixed latency

---

### 4.5 MFA Login (`/api/login/mfa`)

**TOTP (Time-based One-Time Password)** — ใช้ `otplib` ทำ HMAC-SHA1 ในการ generate + verify TOTP จริง

```
Request → Parse JSON → authenticator.generate(secret)
                     → authenticator.check(mfaCode, secret)
                     → [ผ่าน] → Query DB → Response
                     → [ไม่ผ่าน] → 403 Forbidden
```

| ขั้นตอน      | รายละเอียด                                                          |
| ------------ | ------------------------------------------------------------------- |
| Input        | `{ username, password, mfaCode }`                                   |
| Step 1       | `authenticator.generate(MFA_SECRET)` — HMAC-SHA1 hashing จริง       |
| Step 2       | `authenticator.check(mfaCode, MFA_SECRET)` — Verify TOTP token จริง |
| ถ้า code ผิด | Return 403 (bot ส่ง random code → ไม่ผ่านเสมอ)                      |
| Overhead     | **Real HMAC-SHA1 CPU cost** (ไม่มี synthetic setTimeout/loop)       |

**ข้อจำกัดของการทดลอง (Limitation):** ใช้ `MFA_SECRET` ตัวเดียว hardcoded สำหรับทุก request เพื่อวัด CPU cost ของกระบวนการเข้ารหัส HMAC-SHA1 โดยเฉพาะ ในโลกจริงจะต้องมี I/O cost เพิ่มเติมจากการดึง secret key ของแต่ละ user จาก Database

---

## 5. Mock CAPTCHA Server (captcha-mock)

Server จำลองที่ทำหน้าที่เป็น 3rd-party CAPTCHA API:

| รายละเอียด      | ค่า                                                            |
| --------------- | -------------------------------------------------------------- |
| Technology      | Node.js HTTP Server (ไม่ใช้ framework)                         |
| Port            | 4000                                                           |
| Latency         | Variable 80-150ms (สุ่มต่อ request)                            |
| Endpoint        | `POST /verify` — รับ `{ token }` → ตอบ `{ success, score }`    |
| Health Check    | `GET /health` → ใช้โดย Docker healthcheck                      |
| Response Format | เลียนแบบ reCAPTCHA: `{ success, score, action, challenge_ts }` |

---

## 6. ระบบเก็บข้อมูล (Metrics Collection)

ทุก endpoint ใช้ `finally` block เก็บข้อมูลเหมือนกัน:

```typescript
finally {
  const duration = Date.now() - startTime;              // Wall-clock time (ms)
  const cpuTimeMs = process.cpuUsage(startCpu) / 1000;  // CPU time จริง (ms)
  const memoryMB = process.memoryUsage().heapUsed / MB;  // Memory usage (MB)

  console.log(`[LOG],${timestamp},${scenario},${ip},${status},${duration},${cpuTimeMs},${memoryMB}`);
}
```

| Metric    | วิธีวัด                          | หน่วย    | ความหมาย                                          |
| --------- | -------------------------------- | -------- | ------------------------------------------------- |
| Timestamp | `new Date().toISOString()`       | ISO 8601 | เวลาที่ request ถูกประมวลผลเสร็จ                  |
| Scenario  | Hardcoded ต่อ endpoint           | String   | ชื่อ authentication method                        |
| IP        | `X-Forwarded-For` header         | IPv4     | IP ของ attacker (อาจถูก spoof)                    |
| Status    | HTTP status code                 | Number   | 200/401/403/429                                   |
| Duration  | `Date.now() - startTime`         | ms       | เวลาทั้งหมดที่ client ต้องรอ (รวม I/O wait)       |
| CPU Time  | `process.cpuUsage()`             | ms       | เวลาที่ CPU ประมวลผลจริง (ไม่รวมรอ DB/setTimeout) |
| Memory    | `process.memoryUsage().heapUsed` | MB       | Heap memory ขณะนั้น                               |

---

## 7. ขั้นตอนการรันทดลอง (run_experiment.sh)

```
สำหรับแต่ละ Repetition (1 ถึง 3):
  สำหรับแต่ละ Scenario (Basic, Rate-Limit-Pool, Rate-Limit-RandomIP, CAPTCHA, MFA):
    1. docker compose down -v                    → ทำลาย container + DB + network ทั้งหมด
    2. docker compose up -d web db captcha-mock   → สร้าง Web + DB + CAPTCHA Mock ใหม่
    3. sleep 10                                  → รอ initialization
    4. docker compose up -d --scale {bot}=5      → ปล่อย bot 5 nodes
    5. sleep 60                                  → รอจนครบเวลาทดลอง
    6. docker compose stop                       → หยุด container
    7. docker compose logs web | grep "[LOG]"    → ดึงข้อมูลจาก stdout
    8. sed → relabel (สำหรับ RandomIP) + append Run number → เขียนลง CSV
```

### ผลลัพธ์ที่ได้

ไฟล์ `attack_data.csv` มีรูปแบบ:

```csv
Timestamp,Scenario,IP,Status,Duration_ms,CPU_ms,Memory_MB,Run
2026-03-01T14:00:01.123Z,Basic-Login,192.168.1.1,401,11.4,14.7,161.0,1
2026-03-01T14:00:01.234Z,Rate-Limit-Login,10.42.3.88,429,2.1,0.5,160.6,2
2026-03-01T14:00:01.345Z,Rate-Limit-RandomIP,55.12.88.200,401,9.7,12.5,160.6,1
...
```

---

## 8. การวิเคราะห์ข้อมูล (plot_graphs.py)

### Pre-processing

1. กรอง warm-up 5 วินาทีแรกของแต่ละ scenario/run ออก
2. คำนวณ `Elapsed_s` สัมพัทธ์ภายในแต่ละ scenario (ไม่ใช่ absolute timestamp)
3. Group by `(Scenario, Run)` เพื่อคำนวณ per-run aggregates

### Metrics หลักที่วิเคราะห์

| Metric                       | สูตร                           | ความหมาย                                         |
| ---------------------------- | ------------------------------ | ------------------------------------------------ |
| **Throughput**               | จำนวน requests / 60 วินาที     | ปริมาณงานที่ server ต้องรับ                      |
| **Throughput Reduction**     | `(1 - method/baseline) × 100%` | ประสิทธิภาพการลด throughput เทียบกับ Basic Login |
| **Avg Response Time**        | `mean(Duration_ms)` per run    | เวลาเฉลี่ยที่ client รอ                          |
| **Avg CPU/Request**          | `mean(CPU_ms)` per run         | CPU cost ต่อ request                             |
| **Block Rate**               | `count(429) / total × 100%`    | อัตราการบล็อก (เฉพาะ Rate Limit scenarios)       |
| **Statistical Significance** | `mean ± std dev` across runs   | ความน่าเชื่อถือของผลลัพธ์                        |

### กราฟที่สร้าง (8 กราฟ)

| #   | ชื่อกราฟ                  | จุดประสงค์                                                        |
| --- | ------------------------- | ----------------------------------------------------------------- |
| 1   | Status Code Distribution  | แสดงสัดส่วน status code ของแต่ละ method                           |
| 2   | Response Time Over Time   | แสดง response time ตลอดระยะเวลาทดลอง                              |
| 3   | Resource Usage (Box Plot) | เปรียบเทียบ CPU/Memory distribution                               |
| 4   | Memory Trend              | แนวโน้ม memory usage ตลอดเวลา                                     |
| 5   | Throughput Reduction      | **กราฟหลัก** — throughput, % reduction, CPU cost พร้อม error bars |
| 6   | Summary Dashboard         | ตารางสรุป + กราฟรวมทั้ง 4 มิติ                                    |
| 7   | Research Conclusion       | Throughput timeline + defense effectiveness                       |
| 8   | Per-Run Consistency       | ความสม่ำเสมอระหว่างแต่ละรอบทดลอง                                  |
