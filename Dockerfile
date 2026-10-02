FROM python:3.10-slim

WORKDIR /app

# Cài đặt hệ thống cần thiết
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements và cài đặt
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ code vào container
COPY . .

# Hugging Face Space sử dụng cổng 7860 làm mặc định
EXPOSE 7860

# Chạy uvicorn trên port 7860
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "7860"]
