import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// --- ส่วนที่เพิ่ม: ตัวแปรสำหรับเก็บประวัติใน Memory ---
// เก็บข้อมูลเป็น { "ip_address": { count: จำนวนครั้ง, resetTime: เวลาที่จะรีเซ็ต } }
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const LIMIT_TIME = 60 * 1000; // 1 นาที
const MAX_REQUESTS = 5; // อนุญาต 5 ครั้งต่อนาที

export async function POST(request: Request) {
  const startTime = Date.now(); // เริ่มจับเวลา
  let status = 200;
  let ip = "unknown";

  try {
    // รับข้อมูลที่บอตส่งมา
    const body = await request.json();
    const { username, password } = body;

    // Get IP
    ip = request.headers.get("x-forwarded-for") || "unknown";
    const securityMode = process.env.SECURITY_MODE || "NONE";

    // --- ส่วนที่เพิ่ม: Rate Limit Logic ---
    const now = Date.now();
    const rateData = rateLimitMap.get(ip);

    if (!rateData || now > rateData.resetTime) {
      // ถ้ายังไม่มีข้อมูล IP นี้ หรือเลยเวลา 1 นาทีไปแล้ว ให้เริ่มนับใหม่
      rateLimitMap.set(ip, { count: 1, resetTime: now + LIMIT_TIME });
    } else {
      // ถ้ายังอยู่ในช่วง 1 นาที ให้เพิ่มจำนวนครั้ง
      rateData.count++;
      if (rateData.count > MAX_REQUESTS) {
        status = 429;
        console.log(`[RATE LIMIT] IP: ${ip} | Blocked`);

        return NextResponse.json(
          { success: false, message: "Too many requests wait 1 minute" },
          { status: 429 },
        );
      }
    }

    // // แสดงข้อมูลที่รับมา
    // console.log(
    //   `[WEB]!!!!!!! มีคนพยายาม Login: ${username} | Password: ${password} | IP: ${ip}`,
    // );

    // ค้นหา User ใน Database
    const user = await prisma.user.findUnique({
      where: { username: username },
    });

    let isSuccess = false;
    let message = "Login Failed";
    status = 401;

    if (user && user.password === password) {
      isSuccess = true;
      message = "Login Success!";
      status = 200;
    }

    // บันทึกลง DB
    await prisma.attackLog.create({
      data: {
        ip: ip,
        success: isSuccess,
        mode: securityMode,
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
    const duration = Date.now() - startTime;
    const timestamp = new Date().toISOString();

    console.log(
      `[LOG],${timestamp},Rate-Limit-Login,${ip},${status},${duration}`,
    );
  }
}
