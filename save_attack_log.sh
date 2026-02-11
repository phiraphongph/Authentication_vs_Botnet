#!/bin/bash

# กำหนดชื่อไฟล์
OUTPUT_FILE="attack_data.csv"

# 1. เขียน Header ลงไปใหม่ (เครื่องหมาย > จะทำการล้างไฟล์เดิมแล้วเขียนทับ)
# เช็คให้ชัวร์ว่าจำนวนคอลัมน์ตรงกับข้อมูลที่ Log ออกมาจริง
echo "Timestamp,Scenario,IP,Status,Duration_ms,CPU_ms,Memory_MB" > $OUTPUT_FILE

# 2. ดึง Log แล้วเอาไปต่อท้าย (เครื่องหมาย >> จะเพิ่มข้อมูลต่อจาก Header)
# หมายเหตุ: ถ้าใน Code Node.js คุณเปลี่ยน Log เป็น [PERF] ตามที่คุยกันรอบที่แล้ว 
# ต้องแก้ grep "\[LOG]" เป็น grep "\[PERF]" และ sed เป็น s/.*\[PERF\],// ด้วยครับ
docker compose logs web | grep "\[LOG]" | sed 's/.*\[LOG\],//' >> $OUTPUT_FILE

echo "บันทึกข้อมูลล่าสุดลงไฟล์ $OUTPUT_FILE เรียบร้อยแล้ว"#!/bin/bash

# กำหนดชื่อไฟล์
OUTPUT_FILE="attack_data.csv"

# 1. เขียน Header ลงไปใหม่ (เครื่องหมาย > จะทำการล้างไฟล์เดิมแล้วเขียนทับ)
# เช็คให้ชัวร์ว่าจำนวนคอลัมน์ตรงกับข้อมูลที่ Log ออกมาจริง
echo "Timestamp,Scenario,IP,Status,Duration_ms,CPU_ms,Memory_MB" > $OUTPUT_FILE

# 2. ดึง Log แล้วเอาไปต่อท้าย (เครื่องหมาย >> จะเพิ่มข้อมูลต่อจาก Header)
# หมายเหตุ: ถ้าใน Code Node.js คุณเปลี่ยน Log เป็น [PERF] ตามที่คุยกันรอบที่แล้ว 
# ต้องแก้ grep "\[LOG]" เป็น grep "\[PERF]" และ sed เป็น s/.*\[PERF\],// ด้วยครับ
docker compose logs web | grep "\[LOG]" | sed 's/.*\[LOG\],//' >> $OUTPUT_FILE

echo "บันทึกข้อมูลล่าสุดลงไฟล์ $OUTPUT_FILE เรียบร้อยแล้ว"