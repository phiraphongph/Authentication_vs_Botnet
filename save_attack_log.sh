#!/bin/bash

# กำหนดชื่อไฟล์
OUTPUT_FILE="attack_data.csv"

# 1. เขียน Header ลงไปใหม่ (เครื่องหมาย > จะทำการล้างไฟล์เดิมแล้วเขียนทับ)
echo "Timestamp,Scenario,IP,Status,Duration_ms,CPU_ms,Memory_MB" > $OUTPUT_FILE

# 2. ดึง Log แล้วเอาไปต่อท้าย (เครื่องหมาย >> จะเพิ่มข้อมูลต่อจาก Header)
docker compose logs web | grep "\[LOG]" | sed 's/.*\[LOG\],//' >> $OUTPUT_FILE

echo "บันทึกข้อมูลล่าสุดลงไฟล์ $OUTPUT_FILE เรียบร้อยแล้ว"