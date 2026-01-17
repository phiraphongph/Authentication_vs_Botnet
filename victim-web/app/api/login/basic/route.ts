import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function POST(request: Request) {
  const startTime = Date.now(); // เริ่มจับเวลา
  let status = 200;
  let ip = "unknown";

  try {
    // รับข้อมูลที่บอตส่งมา
    const body = await request.json();
    const { username, password } = body;

    // Get IP
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const securityMode = process.env.SECURITY_MODE || "NONE";

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

    // ตอบกลับไป
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
    console.log(`[LOG],${timestamp},Basic-Login,${ip},${status},${duration}`);
  }
}
