import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  // 1. เริ่มจับเวลาทั้ง Real Time (Duration) และ CPU Time
  const startTime = Date.now();
  const startCpu = process.cpuUsage();

  let status = 200;
  // ย้ายตัวแปร ip ออกมาข้างนอก try เพื่อให้ finally มองเห็น
  let ip = "unknown";
  let isSuccess = false;
  let message = "Login Failed";

  try {
    const body = await request.json();
    const { username, password } = body;

    ip = request.headers.get("x-forwarded-for") || "unknown";
    const securityMode = process.env.SECURITY_MODE || "NONE"; // Mode ปกติคือ NONE

    // ค้นหา User ใน Database
    const user = await prisma.user.findUnique({
      where: { username: username },
    });

    status = 401; // Default status ถ้า login ไม่ผ่าน

    if (user && user.password === password) {
      isSuccess = true;
      message = "Login Success!";
      status = 200;
    }

    // บันทึกลง DB (สำหรับวัด Attack Success Rate)
    await prisma.attackLog.create({
      data: {
        ip: ip,
        success: isSuccess,
        mode: securityMode,
        timestamp: new Date(), // เพิ่ม timestamp เพื่อความชัวร์
      },
    });

    return NextResponse.json(
      { success: isSuccess, message: message },
      { status: status },
    );
  } catch (error) {
    console.error("Error processing login:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  } finally {
    // --- ส่วนวัดผล (Measurement) ---

    // 1. คำนวณเวลา Wall-clock (Latency ที่ User รู้สึก)
    const duration = Date.now() - startTime;

    // 2. คำนวณเวลา CPU (เวลาที่ Server ประมวลผลจริงๆ ไม่รวมเวลารอ DB)
    // หน่วยเป็น microseconds -> หาร 1000 เป็น ms
    const cpuUsed = process.cpuUsage(startCpu);
    const cpuTimeMs = (cpuUsed.user + cpuUsed.system) / 1000;

    // 3. คำนวณ Memory (RAM ที่ใช้ขณะนั้น)
    const memoryUsageMB = (
      process.memoryUsage().heapUsed /
      1024 /
      1024
    ).toFixed(2);

    const timestamp = new Date().toISOString();

    // Log ใน Format เดียวกับตัว Rate Limit เพื่อให้เอาไปทำกราฟเทียบกันได้
    // Format: [LOG], Time, Scenario, IP, Status, Duration(ms), CPU_Time(ms), Mem(MB)
    console.log(
      `[LOG],${timestamp},Basic-Login,${ip},${status},${duration},${cpuTimeMs.toFixed(2)},${memoryUsageMB}`,
    );
  }
}
