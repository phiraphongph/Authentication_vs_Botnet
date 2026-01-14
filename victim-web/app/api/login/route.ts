import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    // รับข้อมูลที่บอตส่งมา
    const body = await request.json();
    const { username, password } = body;

    // Get IP
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const securityMode = process.env.SECURITY_MODE || "NONE";

    // แสดงข้อมูลที่รับมา
    console.log(
      `[WEB]!!!!!!! มีคนพยายาม Login: ${username} | Password: ${password} | IP: ${ip}`
    );

    // ค้นหา User ใน Database
    const user = await prisma.user.findUnique({
      where: { username: username },
    });

    let isSuccess = false;
    let message = "Login พลาดจ้า";
    let status = 401;

    // (ตรงนี้แหละที่เพื่อนคุณต้องมาเขียน Logic เชื่อม DB ทีหลัง)
    // ตอนนี้เอาแค่ if โง่ๆ ไปก่อน
    console.log("password จริงคือ:", user?.password, "vs", password);
    if (user && user.password === password) {
      isSuccess = true;
      message = "Login สำเร็จ! (แต่ระบบยังไม่เสร็จนะ)";
      status = 200;
    }

    // 3. บันทึกลง DB
    await prisma.attackLog.create({
      data: {
        ip: ip,
        success: isSuccess,
        mode: securityMode,
      },
    });

    // 4. ตอบกลับไป
    return NextResponse.json(
      { success: isSuccess, message: message },
      { status: status }
    );
  } catch (error) {
    console.error("Error processing login:", error);
    return NextResponse.json(
      { error: "ส่งข้อมูลมาผิดรูปแบบหรือเปล่า?" },
      { status: 400 }
    );
  }
}
