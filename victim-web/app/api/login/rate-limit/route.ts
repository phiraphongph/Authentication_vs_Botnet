import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// In-Memory Storage
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const LIMIT_TIME = 60 * 1000;
const MAX_REQUESTS = 5;

// --- [ADD THIS] Garbage Collection ---
// ทำความสะอาด Map ทุกๆ 1 นาที ลบ IP ที่พ้นโทษแบน/หมดเวลาแล้วออกไป เพื่อป้องกัน Memory Leak
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, LIMIT_TIME);

export async function POST(request: Request) {
  // [เพิ่ม] 1. เริ่มจับเวลาทั้ง Real Time และ CPU Time
  const startTime = Date.now();
  const startCpu = process.cpuUsage();

  let status = 200;
  let ip = "unknown";

  // ตัวแปรใหม่สำหรับเช็คสถานะ
  let isBlocked = false;
  let isLoginSuccess = false;
  let message = "";

  try {
    const body = await request.json();
    const { username, password } = body;

    ip = request.headers.get("x-forwarded-for") || "unknown";
    const securityMode = process.env.SECURITY_MODE || "NONE";

    // --- Rate Limit Logic ---
    const now = Date.now();
    const rateData = rateLimitMap.get(ip);

    if (!rateData || now > rateData.resetTime) {
      rateLimitMap.set(ip, { count: 1, resetTime: now + LIMIT_TIME });
    } else {
      rateData.count++;
      if (rateData.count > MAX_REQUESTS) {
        // ไม่ return ทันที แต่เปลี่ยนสถานะตัวแปรแทน
        isBlocked = true;
        status = 429;
        message = "Too many requests wait 1 minute";
      }
    }

    // --- Login Logic (ทำงานเฉพาะถ้าไม่โดนบล็อก) ---
    if (!isBlocked) {
      const user = await prisma.user.findUnique({
        where: { username: username },
      });

      if (user && user.password === password) {
        isLoginSuccess = true;
        message = "Login Success!";
        status = 200;
      } else {
        isLoginSuccess = false;
        message = "Login Failed";
        status = 401;
      }
    }

    // --- Database Logging ---
    await prisma.attackLog.create({
      data: {
        ip: ip,
        success: isLoginSuccess,
        mode: isBlocked ? "BLOCKED_BY_RATELIMIT" : securityMode,
      },
    });

    // --- Return Response ---
    if (isBlocked) {
      return NextResponse.json(
        { success: false, message: message },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { success: isLoginSuccess, message: message },
      { status: status },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.warn(`[WARN] Malformed JSON from ${ip}`);
      status = 400;
      return NextResponse.json({ error: "Bad Request" }, { status: 400 });
    }
    console.error("Error processing login:", error);
    status = 500;
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  } finally {
    // [เพิ่ม] ส่วนการวัดผล Performance

    // 1. Duration (Wall-clock time): เวลารวมทั้งหมดที่ user ต้องรอ
    const duration = Date.now() - startTime;

    // 2. CPU Time: เวลาที่ Server ประมวลผลจริงๆ (ไม่รวมเวลารอ DB ตอบกลับ)
    const cpuUsed = process.cpuUsage(startCpu);
    // user = เวลาใน JS Code, system = เวลาใน OS Kernel
    const cpuTimeMs = (cpuUsed.user + cpuUsed.system) / 1000;

    // 3. Memory
    const memoryUsageMB = (
      process.memoryUsage().heapUsed /
      1024 /
      1024
    ).toFixed(2);

    const timestamp = new Date().toISOString();

    // [แก้ไข] Format Log ให้มี CPU Time
    console.log(
      `[LOG],${timestamp},Rate-Limit-Login,${ip},${status},${duration},${cpuTimeMs.toFixed(2)},${memoryUsageMB}`,
    );
  }
}
