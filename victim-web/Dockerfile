# victim-web/Dockerfile
FROM node:20-alpine

WORKDIR /app

# ✅ เพิ่มบรรทัดนี้ครับ: ลง OpenSSL ให้ Prisma คุยกับ Database ได้
RUN apk add --no-cache openssl

# ลง dependencies
COPY package*.json ./
RUN npm install

# ก๊อปปี้โค้ดทั้งหมด
COPY . .

# สร้าง Database Client (Prisma)
RUN npx prisma generate

# เปิด Port 3000
EXPOSE 3000

# รันโหมด Dev (เพื่อให้แก้โค้ดแล้วเปลี่ยนทันทีไม่ต้อง Rebuild)
CMD ["npm", "run", "dev"]