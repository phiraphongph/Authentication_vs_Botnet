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
  let isMfaValid = false;
  let message = "";

  try {
    const body = await request.json();
    // รับค่า mfaCode มาแทน captchaToken
    const { username, password, mfaCode } = body;

    ip = request.headers.get("x-forwarded-for") || "unknown";
    const securityMode = process.env.SECURITY_MODE || "MFA";

    // --- MFA Verification Logic (Mock for Load Testing) ---
    // 1. จำลองเวลาที่เซิร์ฟเวอร์ต้องใช้คำนวณ Hash ของ TOTP (MFA จะใช้เวลาน้อยกว่าการวิ่งไปถาม API ของ Captcha)
    // สมมติว่าใช้เวลาประมาณ 50ms
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 2. จำลองการประมวลผล CPU (MFA มีการทำ Cryptographic Hashing)
    // จำลองการใช้ CPU ให้ใกล้เคียงกับการคำนวณ HMAC-SHA1
    for (let i = 0; i < 10000; i++) {
      Math.random() * Math.random();
    }

    // 3. ตรวจสอบ MFA Code
    // (ใน attack.py ถ้าต้องการให้บอทผ่าน MFA ได้ ให้ส่งค่า "123456" มา)
    if (mfaCode === "123456") {
      isMfaValid = true;
    } else {
      isMfaValid = false;
      status = 403;
      message = "Invalid MFA Code";
    }

    // --- Login Logic (ทำงานเฉพาะเมื่อ MFA ผ่าน) ---
    if (isMfaValid) {
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
        mode: !isMfaValid ? "BLOCKED_BY_MFA" : securityMode,
      },
    });

    // --- Return Response ---
    if (!isMfaValid) {
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
    // สังเกตว่าเปลี่ยน Tag เป็น MFA-Login เพื่อให้แยกข้อมูลในกราฟได้
    console.log(
      `[LOG],${timestamp},MFA-Login,${ip},${status},${duration},${cpuTimeMs.toFixed(2)},${memoryUsageMB}`,
    );
  }
}
