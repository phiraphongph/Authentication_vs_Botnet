import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST() {
  try {
    // Delete all logs
    await prisma.attackLog.deleteMany({});
    
    return NextResponse.json({ message: "Logs cleared" }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to clear logs" },
      { status: 500 }
    );
  }
}
