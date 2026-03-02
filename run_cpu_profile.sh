#!/bin/bash
# run_cpu_profile.sh - Phase 2: CPU Isolation Testing

OUTPUT_FILE="cpu_profile_data.csv"
DURATION=60  # รันแค่ 60 วินาทีก็พอสำหรับเก็บกลุ่มตัวอย่างค่า CPU
PROFILES=("attacker-captcha" "attacker-mfa")

echo "🔬 Starting Phase 2: CPU Profiling (Strict Isolation)"
echo "Timestamp,Scenario,IP,Status,Duration_ms,CPU_ms,Memory_MB,Run" > $OUTPUT_FILE

for PROFILE in "${PROFILES[@]}"; do
    echo "--------------------------------------------------------"
    echo "🔍 Profiling: ${PROFILE} (Concurrency = 1, Replicas = 1)"
    
    # เคลียร์ระบบให้สะอาดที่สุด
    docker compose down -v --remove-orphans > /dev/null 2>&1
    docker compose up -d web db captcha-mock
    
    echo "⏳ Waiting for initialization..."
    sleep 10
    
    # บังคับ Concurrency=1 ผ่าน Environment Variable และใช้ --scale เพื่อให้รันแค่ 1 Container
    export CONCURRENCY=1
    docker compose --profile ${PROFILE} up -d --scale ${PROFILE}=1
    
    sleep $DURATION
    
    docker compose --profile ${PROFILE} stop
    
    # ดึง Log ออกมา และลบ \r ทิ้งป้องกันไฟล์ CSV พัง
    docker compose logs web | grep "\[LOG\]" | tr -d '\r' | sed 's/.*\[LOG\],//' | sed "s/$/,1/" >> $OUTPUT_FILE
    
    echo "✅ Finished profiling ${PROFILE}"
done

echo "🧹 Cleaning up..."
docker compose down -v --remove-orphans > /dev/null 2>&1
echo "📂 CPU Profiling data saved to: ${OUTPUT_FILE}"