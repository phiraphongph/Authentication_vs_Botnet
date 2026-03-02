import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CAPTCHA_VERIFY_URL =
  process.env.CAPTCHA_VERIFY_URL || "http://captcha-mock:4000/verify";

export async function POST(request: Request) {
  // [1] เริ่มจับเวลาทั้ง Real Time และ CPU Time
  const startTime = Date.now();
  const startCpu = process.cpuUsage();

  let status = 200;
  let ip = "unknown";

  let isLoginSuccess = false;
  let isCaptchaValid = false;
  let message = "";

  try {
    const body = await request.json();
    const { username, password, captchaToken } = body;

    ip = request.headers.get("x-forwarded-for") || "unknown";
    const securityMode = process.env.SECURITY_MODE || "NONE";

    // --- CAPTCHA Verification Logic (Real HTTP Call to Mock Server) ---
    // ยิง HTTP Request ไปที่ Mock CAPTCHA API จริง (ไม่ใช่ setTimeout)
    // ปิด Keep-Alive เพื่อให้แต่ละ request ต้อง TCP Handshake ใหม่ (สมจริงเหมือน 3rd-party API)
    const verifyResponse = await fetch(CAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Connection: "close",
      },
      cache: "no-store",
      body: JSON.stringify({ token: captchaToken }),
    });
    const verifyResult = await verifyResponse.json();

    // ตรวจสอบผลจาก API
    if (verifyResult.success === true) {
      isCaptchaValid = true;
    } else {
      isCaptchaValid = false;
      status = 403;
      message = "Invalid CAPTCHA";
    }

    // --- Login Logic (ทำงานเฉพาะเมื่อ CAPTCHA ผ่าน) ---
    if (isCaptchaValid) {
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
        mode: !isCaptchaValid ? "BLOCKED_BY_CAPTCHA" : securityMode,
      },
    });

    // --- Return Response ---
    if (!isCaptchaValid) {
      return NextResponse.json(
        { success: false, message: message },
        { status: 403 },
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
    // --- ส่วนการวัดผล Performance ---

    // 1. Duration (Wall-clock time): เวลารวมทั้งหมดที่รอ
    const duration = Date.now() - startTime;

    // 2. CPU Time: เวลาที่ Server ประมวลผลจริงๆ
    const cpuUsed = process.cpuUsage(startCpu);
    const cpuTimeMs = (cpuUsed.user + cpuUsed.system) / 1000;

    // 3. Memory Usage
    const memoryUsageMB = (
      process.memoryUsage().heapUsed /
      1024 /
      1024
    ).toFixed(2);

    const timestamp = new Date().toISOString();

    // ปริ้นต์ Log ในรูปแบบ CSV เพื่อให้ plot_graphs.py ดึงไปใช้ต่อ
    console.log(
      `[LOG],${timestamp},Captcha-Login,${ip},${status},${duration},${cpuTimeMs.toFixed(2)},${memoryUsageMB}`,
    );
  }
}
