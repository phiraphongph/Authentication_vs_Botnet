# attacker-bot/Dockerfile
FROM python:3.9-slim

WORKDIR /app

# ลง Library
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ก๊อปปี้โค้ด
COPY . .

# รันสคริปต์โจมตีทันทีที่เปิด Container
CMD ["python", "attack.py"]