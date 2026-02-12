import requests
import time
import os
import socket
import random
import string
import concurrent.futures

# อ่าน endpoint จาก Docker Compose
# ค่า default: basic (ไม่มี Rate Limit)
# เปลี่ยนเป้าหมายผ่าน env TARGET_ENDPOINT ใน docker-compose.yml
# - "basic"      → http://web:3000/api/login/basic
# - "rate-limit" → http://web:3000/api/login/rate-limit
TARGET_ENDPOINT = os.getenv("TARGET_ENDPOINT", "basic")
TARGET_URL = f"http://web:3000/api/login/{TARGET_ENDPOINT}"
CONCURRENCY = 10 # จำนวน Thread ที่ยิงพร้อมกันต่อ 1 Bot Container

# ฟังก์ชันดึง IP ของ Container ตัวเอง
def get_my_ip():
    try:
        hostname = socket.gethostname()
        return socket.gethostbyname(hostname)
    except:
        return "Unknown"

def generate_random_password():
    return ''.join(random.choices(string.ascii_letters + string.digits, k=16))

def attack_worker(worker_id):
    my_ip = get_my_ip()
    # จำลองข้อมูล Login
    payload = {
        "username": "admin",
        "password": generate_random_password() # สุ่มรหัสผ่านผิดๆ
    }

    try:
        # ยิง Request ไปที่ endpoint เดียวที่ถูกตั้งค่า
        # ใช้ timeout สั้นๆ (1s) เพื่อให้ loop เร็วขึ้น
        response = requests.post(TARGET_URL, json=payload, timeout=1)

        # เช็คผลลัพธ์
        if response.status_code == 200:
            print(f"[BOT-{worker_id}]  เจาะเข้าได้แล้ว! Response: {response.text}")
        elif response.status_code == 429:
            print(f"[BOT-{worker_id}]  ถูกบล็อก! (Rate Limited)")
        else:
            print(f"[BOT-{worker_id}]  เจาะไม่เข้า (Status: {response.status_code})")
            
    except Exception as e:
        # Error เยอะๆ ไม่ต้องปริ้นท์หมด เดี๋ยวรก Log
        # print(f"[BOT-{worker_id}]  Error: {e}")
        pass

def start_attack():
    print(f"[*] เริ่มต้นโจมตีไปที่: {TARGET_URL}")
    print(f"[*] โหมด: {TARGET_ENDPOINT}")
    print(f"[*] ความแรง: {CONCURRENCY} Threads/Container")
    print("[*] กำลังรอให้ Web Server ตื่น... (10 วินาที)")
    time.sleep(10) # รอแป๊บนึงให้ Next.js บูทเสร็จ

    print("[*] 🔥 FIRE !!!")
    
    # ใช้ ThreadPoolExecutor เพื่อยิงรัวๆ
    with concurrent.futures.ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        while True:
            # ส่งงานเข้า Queue ตลอดเวลา
            futures = [executor.submit(attack_worker, i) for i in range(CONCURRENCY)]
            # รอให้ชุดนี้เสร็จบางส่วนแล้วค่อยเติมใหม่ (หรือ loop ไปเลยก็ได้)
            # แต่เพื่อ performance ที่ดี ปล่อยให้ executor จัดการ
            concurrent.futures.wait(futures, return_when=concurrent.futures.FIRST_COMPLETED)

if __name__ == "__main__":
    start_attack()
