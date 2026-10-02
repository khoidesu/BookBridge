import os
import sys
from pymongo import MongoClient
import bcrypt
from datetime import datetime
from dotenv import load_dotenv

load_dotenv('.env.local', override=True)

MONGODB_URL = os.environ.get("MONGODB_URL")

print("Đang kết nối tới MongoDB...")
try:
    client = MongoClient(MONGODB_URL)
    try:
        db = client.get_default_database()
    except Exception:
        db = client['bookbridge']
    users_collection = db['users']

    if users_collection.find_one({"role": "admin"}):
        print("Tài khoản Admin đã tồn tại trong hệ thống!")
        sys.exit(0)

    
    hashed_password = bcrypt.hashpw("admin123".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    admin_user = {
        "username": "admin",
        "password": hashed_password,
        "role": "admin",
        "is_approved": True,
        "created_at": datetime.utcnow()
    }
    
    users_collection.insert_one(admin_user)
    print("✅ ĐÃ TẠO TÀI KHOẢN ADMIN THÀNH CÔNG!")
    print("👉 Username: admin")
    print("👉 Password: admin123")

except Exception as e:
    print(f"Lỗi khi kết nối MongoDB: {e}")
