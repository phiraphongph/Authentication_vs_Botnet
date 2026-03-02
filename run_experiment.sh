#!/bin/bash

# Configuration
OUTPUT_FILE="attack_data.csv"
DURATION=60          # 60 seconds per test
REPETITIONS=3       # จำนวนรอบทดลอง (statistical rigor)
ATTACK_PROFILES=("attacker-basic" "attacker-ratelimit" "attacker-ratelimit-randomip" "attacker-captcha" "attacker-mfa")

# ฟังก์ชันทำลาย container ทุกตัวที่เกี่ยวข้อง (ทุก profile)
cleanup_all() {
    docker compose \
        --profile attacker-basic \
        --profile attacker-ratelimit \
        --profile attacker-ratelimit-randomip \
        --profile attacker-captcha \
        --profile attacker-mfa \
        down -v --remove-orphans 2>&1 | tail -3
}

# Mapping: สำหรับ attacker-ratelimit-randomip ต้องเปลี่ยนชื่อ Scenario ใน CSV
# เพราะ endpoint เดียวกันกับ attacker-ratelimit แต่พฤติกรรม IP ต่างกัน
# (หลีกเลี่ยงการใช้ declare -A เพราะ macOS bash 3.2 ไม่รองรับ)

echo "🧪 Starting Sequential Authentication Research Experiment"
echo "--------------------------------------------------------"
echo "Duration per test : ${DURATION} seconds"
echo "Repetitions       : ${REPETITIONS} rounds"
echo "Total scenarios   : ${#ATTACK_PROFILES[@]} × ${REPETITIONS} = $(( ${#ATTACK_PROFILES[@]} * REPETITIONS )) runs"
echo "Est. total time   : $(( ${#ATTACK_PROFILES[@]} * REPETITIONS * (DURATION + 30) / 60 )) minutes"
echo "Output Data File  : ${OUTPUT_FILE}"
echo "--------------------------------------------------------"

# 1. Prepare clean data file (with Run column)
echo "Timestamp,Scenario,IP,Status,Duration_ms,CPU_ms,Memory_MB,Run" > $OUTPUT_FILE
echo "✅ Emptied and prepared ${OUTPUT_FILE} headers"

# 2. Sequential testing loop with repetitions
for (( RUN=1; RUN<=REPETITIONS; RUN++ )); do
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║  📊 REPETITION ${RUN} of ${REPETITIONS}                              ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    
    for PROFILE in "${ATTACK_PROFILES[@]}"; do
        echo ""
        echo "========================================================"
        echo "🚀 [Run ${RUN}/${REPETITIONS}] Starting Trial: ${PROFILE}"
        echo "========================================================"
        
        echo "🧹 [1/5] Stopping and cleaning ALL containers (every profile)..."
        cleanup_all
        
        echo "🏗️  [2/5] Starting infrastructure (Web + DB + CAPTCHA Mock)..."
        docker compose up -d web db captcha-mock
        
        echo "⏳ Waiting for Web & DB & CAPTCHA Mock to fully initialize..."
        sleep 10
        
        echo "⚔️  [3/5] Launching Attacker Botnet (${PROFILE}) for ${DURATION} seconds..."
        docker compose --profile ${PROFILE} up -d ${PROFILE}
        
        # Wait for the attacks to complete
        sleep $DURATION
        # Give bots 10 extra seconds to finish and shut down
        sleep 10
        
        echo "🛑 [4/5] Stopping ALL containers..."
        docker compose --profile ${PROFILE} stop
        
        echo "📊 [5/5] Extracting data from web server logs..."
        # เก็บ logs ลง temp file ก่อน เพื่อ debug
        TEMP_LOG=$(mktemp)
        docker compose --profile ${PROFILE} logs web > "$TEMP_LOG" 2>&1
        LOG_TOTAL=$(wc -l < "$TEMP_LOG")
        LOG_MATCHED=$(grep -c "\[LOG\]" "$TEMP_LOG" || true)
        echo "   Raw log lines: ${LOG_TOTAL}, Matched [LOG] lines: ${LOG_MATCHED}"
        
        # Extract and append to CSV
        if [ "$PROFILE" == "attacker-ratelimit-randomip" ]; then
            grep "\[LOG\]" "$TEMP_LOG" | tr -d '\r' | sed 's/.*\[LOG\],//' | sed "s/Rate-Limit-Login/Rate-Limit-RandomIP/" | sed "s/$/,${RUN}/" >> $OUTPUT_FILE
        else
            grep "\[LOG\]" "$TEMP_LOG" | tr -d '\r' | sed 's/.*\[LOG\],//' | sed "s/$/,${RUN}/" >> $OUTPUT_FILE
        fi
        rm -f "$TEMP_LOG"
        
        echo "✅ [Run ${RUN}] Data extracted for ${PROFILE}. Total lines so far:"
        wc -l $OUTPUT_FILE
    done
done

echo ""
echo "========================================================"
echo "🎉 Experiment Complete!"
echo "   ${#ATTACK_PROFILES[@]} scenarios × ${REPETITIONS} repetitions = $(( ${#ATTACK_PROFILES[@]} * REPETITIONS )) total runs"
echo "🧹 Cleaning up..."
cleanup_all

echo "📂 Your research data is ready in: ${OUTPUT_FILE}"
echo "Next step: Run 'python3 plot_graphs.py' to visualize the results."
