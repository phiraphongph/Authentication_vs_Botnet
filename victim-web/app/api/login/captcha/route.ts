import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

    // --- CAPTCHA Verification Logic (Mock for Load Testing) ---
    // 1. จำลองเวลาที่เซิร์ฟเวอร์ต้องวิ่งไปถาม Google/Cloudflare (หน่วงเวลา 150ms ให้สมจริง)
    await new Promise((resolve) => setTimeout(resolve, 150));

    // 2. จำลองการประมวลผล (กิน CPU เล็กน้อย เสมือนการ Parse JSON จาก 3rd-party API)
    JSON.parse(
      JSON.stringify({
        mockData: "simulating external api response parsing...",
      }),
    );

    // 3. ตรวจสอบ Token
    // (ใน attack.py ถ้าต้องการจำลองบอทที่ผ่าน CAPTCHA ได้ ให้ส่งค่า "valid-token-from-bot" มา)
    if (captchaToken === "valid-token-from-bot") {
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
