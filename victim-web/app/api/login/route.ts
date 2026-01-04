import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    // 1. รับข้อมูลที่บอตส่งมา
    const body = await request.json();
    const { username, password } = body;

    // 2. ปริ้นท์ลง Console (เพื่อให้เราเห็นใน Docker Log)
    // console.log(
    //   `[WEB] ⚠️ มีคนพยายาม Login: ${username} | Password: ${password}`
    // );
    // 🔍 1. ค้นหา User ใน Database
    const user = await prisma.user.findUnique({
      where: { username: username },
    });

    // (ตรงนี้แหละที่เพื่อนคุณต้องมาเขียน Logic เชื่อม DB ทีหลัง)
    // ตอนนี้เอาแค่ if โง่ๆ ไปก่อน
    if (user && user.password === password) {
      return NextResponse.json({
        success: true,
        message: "Login สำเร็จ! (แต่ระบบยังไม่เสร็จนะ)",
      });
    }

    // 3. ตอบกลับไป
    return NextResponse.json(
      { success: false, message: "Login พลาดจ้า" },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "ส่งข้อมูลมาผิดรูปแบบหรือเปล่า?" },
      { status: 400 }
    );
  }
}
