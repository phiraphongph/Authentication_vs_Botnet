import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { authenticator } from "otplib";

const prisma = new PrismaClient();

// Hardcoded TOTP secret สำหรับการวิจัย
// (ข้อจำกัด: ในระบบจริงต้องดึง secret ของแต่ละ user จาก DB ซึ่งจะเพิ่ม I/O Time อีกเล็กน้อย)
const MFA_SECRET = "JBSWY3DPEHPK3PXP";

export async function POST(request: Request) {
  // [1] เริ่มจับเวลาทั้ง Real Time และ CPU Time สำหรับงานวิจัย
  const startTime = Date.now();
  const startCpu = process.cpuUsage();

  let status = 200;
  let ip = "unknown";

  let isLoginSuccess = false;
  let isMfaValid = false;
  let message = "";

  try {
    const body = await request.json();
    const { username, password, mfaCode } = body;

    ip = request.headers.get("x-forwarded-for") || "unknown";
    const securityMode = process.env.SECURITY_MODE || "MFA";

    // --- MFA Verification Logic (Real TOTP via otplib) ---
    // เซิร์ฟเวอร์ทำหน้าที่ Verify อย่างเดียว (ลบ authenticator.generate ออกแล้ว)
    // การคำนวณ HMAC-SHA1 ตรงนี้คือ CPU Overhead ที่แท้จริงของระบบ MFA
    isMfaValid = authenticator.check(mfaCode, MFA_SECRET);

    if (!isMfaValid) {
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
    // บันทึก Log ลง DB เสมอ เพื่อให้เกิด Database I/O Cost เท่าเทียมกับ Scenario อื่น (Fair Comparison)
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
    // --- ส่วนการวัดผล Performance (Research Metrics) ---

    // 1. Duration (Wall-clock time): เวลารวมทั้งหมดที่รอ (รวม CPU และ I/O)
    const duration = Date.now() - startTime;

    // 2. CPU Time: เวลาที่ Server ประมวลผลจริงๆ (เพียวๆ จากกระบวนการเข้ารหัสและเช็คเงื่อนไข)
    const cpuUsed = process.cpuUsage(startCpu);
    const cpuTimeMs = (cpuUsed.user + cpuUsed.system) / 1000;

    // 3. Memory Usage
    const memoryUsageMB = (
      process.memoryUsage().heapUsed /
      1024 /
      1024
    ).toFixed(2);

    const timestamp = new Date().toISOString();

    // ปริ้นต์ Log ในรูปแบบ CSV เพื่อให้สคริปต์ plot_graphs.py ดึงไปใช้ต่อ
    console.log(
      `[LOG],${timestamp},MFA-Login,${ip},${status},${duration},${cpuTimeMs.toFixed(2)},${memoryUsageMB}`,
    );
  }
}