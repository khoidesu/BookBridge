import os
import uvicorn
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import torch
import torch.nn.functional as F
from dotenv import load_dotenv
from google import genai
from google.genai import types
import certifi

from pymongo import MongoClient
import bcrypt
from fastapi import HTTPException, status, Depends
import jwt
from datetime import datetime, timedelta


# Load environment variables
load_dotenv('.env.local', override=True)

GEMINI_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_MODEL = os.environ.get("LLM_MODEL", "gemini-2.5-flash")

# Note: google.genai does not use a global configure method.
# We will create a Client instance where needed.

# Load book links for Sylvi AI
BOOK_LINK_CSV = os.path.join(os.path.dirname(__file__), "Data", "book_link.csv")
try:
    books_df = pd.read_csv(BOOK_LINK_CSV)
    books_list = books_df.to_dict('records')
    books_str = "\n".join([f"- {book['Tiêu đề sách']}: {book['Link tham khảo']}" for book in books_list])
except Exception as e:
    print(f"Error loading book_link.csv: {e}")
    books_str = ""

SYLVI_SYSTEM_PROMPT = f"""
Bạn là Sylvi AI, một trợ lý học liệu ảo tận tâm và thông minh của hệ thống BookBridge.
Nhiệm vụ của bạn là hỗ trợ học sinh và giáo viên tìm kiếm sách giáo khoa, hướng dẫn mượn sách, và trả lời các câu hỏi liên quan đến học tập.
Đặc biệt, nếu người dùng hỏi liên quan đến việc tìm sách (ví dụ: "Tôi cần tìm sách ngữ văn", "Có sách toán không?", v.v.), bạn PHẢI ĐỀ XUẤT sách phù hợp từ danh sách sau và cung cấp kèm NGUỒN cho họ.
Hãy trả về link dưới dạng Markdown để người dùng có thể bấm vào được. QUAN TRỌNG: Bạn chỉ hiển thị chữ "link" cho đường dẫn thay vì hiển thị toàn bộ đường dẫn dài (Ví dụ: dùng cú pháp [link](url_sách) thay vì in trực tiếp url ra). 
Tuyệt đối chỉ lấy link từ danh sách dưới đây, không tự bịa ra link khác.
Và bạn phải tuân thủ quy định về luật bảo vệ quyền sở hữu trí tuệ, khi người dùng hỏi tóm tắt nội dung sách cụ thể (ví dụ: tóm tắt nội dung sách ngữ văn lớp 12, tóm tắt nội dung sách toán lớp 11, v.v.) thì chỉ trả lời không thể hỗ trợ vì vi phạm bản quyền.

DANH SÁCH SÁCH VÀ LINK:
{books_str}

Khi trả lời, hãy giữ thái độ thân thiện, nhiệt tình, rõ ràng và có dùng markdown (in đậm, danh sách) cho đẹp mắt.
Nếu người dùng hỏi những câu không liên quan đến sách hoặc học tập, hãy từ chối một cách khéo léo và hướng họ về việc học tập.
"""

app = FastAPI()

@app.get("/books")
def get_books():
    return books_list

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_NAME = "keepitreal/vietnamese-sbert"
print(f"Loading {MODEL_NAME}...")
model = SentenceTransformer(MODEL_NAME)
print("Model loaded.")

CSV_PATH = os.path.join(os.path.dirname(__file__), "Data", "filter_content.csv")
print(f"Loading CSV from {CSV_PATH}...")
df = pd.read_csv(CSV_PATH)
df = df.dropna(subset=['Nội dung'])

print("Precomputing embeddings for CSV data...")
# Format: "Chủ đề / Bài: Nội dung"
full_sentences = [f"{row['Chủ đề / Bài']}: {row['Nội dung']}" for _, row in df.iterrows()]
embeddings = model.encode(full_sentences, convert_to_tensor=True)
print(f"Precomputed {len(embeddings)} embeddings.")

class CompareRequest(BaseModel):
    book_name: str
    chapter_titles: list[str]

@app.post("/compare_titles")
def compare_titles(req: CompareRequest):
    if not req.chapter_titles:
        return {"match_percentage": 0, "matched_items": 0, "total_items": 0, "matches": []}

    # --- Tuning constants ---
    # Raw cosine similarity below this is treated as 0% (noise floor for Vietnamese SBERT)
    SIMILARITY_THRESHOLD = 0.50
    # Above this raw score, we trust the embedding match without keyword checks
    CONFIDENT_THRESHOLD = 0.70
    # Vietnamese stopwords to ignore in keyword overlap checks
    VN_STOPWORDS = {
        'và', 'của', 'là', 'các', 'có', 'được', 'cho', 'trong', 'với', 'một',
        'những', 'không', 'này', 'từ', 'theo', 'đã', 'cũng', 'về', 'hay',
        'khi', 'đến', 'như', 'để', 'bài', 'chủ', 'đề', 'nội', 'dung',
        'chương', 'phần', 'mục', 'sgk', 'sách', 'tập', 'học', 'kiến',
        'thức', 'hoạt', 'động', 'thực', 'hành', 'ôn', 'luyện', 'tổng',
        'hợp', 'giới', 'thiệu', 'chung', 'i', 'ii', 'iii', 'iv', 'v',
    }

    # Calculate embeddings for input titles
    input_embeddings = model.encode(req.chapter_titles, convert_to_tensor=True)
    
    # Cosine similarity matrix: shape (num_inputs, num_db_items)
    similarities = F.cosine_similarity(input_embeddings.unsqueeze(1), embeddings.unsqueeze(0), dim=-1)
    
    # Filter by book_name keyword — STRICT: no fallback to all books
    search_kw = req.book_name.lower().strip()
    if search_kw:
        mask = df['Sách'].str.lower().str.contains(search_kw, na=False).values
        valid_idx = torch.tensor(mask)
        if not valid_idx.any():
            # No matching book in DB — return 0% for everything
            no_match_results = []
            for title in req.chapter_titles:
                no_match_results.append({
                    "found": title,
                    "expected": "(Không tìm thấy sách phù hợp trong CSDL)",
                    "score": 0,
                    "book": req.book_name
                })
            return {
                "match_percentage": 0,
                "matched_items": 0,
                "total_items": len(req.chapter_titles),
                "matches": no_match_results
            }
    else:
        valid_idx = torch.ones(len(df), dtype=torch.bool)
    
    matches = []
    total_score = 0
    
    for i in range(len(req.chapter_titles)):
        input_str = req.chapter_titles[i].lower().strip()
        sim_scores = similarities[i].clone()
        
        # Apply book filter — mask out entries from other books
        sim_scores[~valid_idx] = -1.0
        
        # Lexical boost: exact substring match → 1.0 (this is always reliable)
        has_lexical_match = False
        for j in range(len(df)):
            if not valid_idx[j]:
                continue
            expected_str = full_sentences[j].lower()
            if input_str in expected_str:
                sim_scores[j] = 1.0
                has_lexical_match = True
                
        best_idx = torch.argmax(sim_scores).item()
        raw_score = sim_scores[best_idx].item()
        
        row = df.iloc[best_idx]
        expected_text = f"{row['Chủ đề / Bài']}: {row['Nội dung']}"
        
        # --- Score transformation ---
        if has_lexical_match:
            # Exact substring match: always 100%
            final_score = 1.0
        elif raw_score < SIMILARITY_THRESHOLD:
            # Below noise floor: 0%
            final_score = 0.0
        else:
            # Rescale [THRESHOLD, 1.0] → [0.0, 1.0]
            final_score = (raw_score - SIMILARITY_THRESHOLD) / (1.0 - SIMILARITY_THRESHOLD)
            
            # Keyword overlap validation for scores below confident threshold
            if raw_score < CONFIDENT_THRESHOLD:
                input_words = set(input_str.split()) - VN_STOPWORDS
                expected_words = set(full_sentences[best_idx].lower().split()) - VN_STOPWORDS
                overlap = input_words & expected_words
                
                if len(overlap) == 0:
                    # Zero keyword overlap + mediocre embedding score = likely false positive
                    final_score *= 0.3  # heavy penalty
                elif len(overlap) == 1 and len(input_words) > 2:
                    # Only 1 shared word with multi-word input = weak signal
                    final_score *= 0.6
        
        score_percent = round(final_score * 100)
        score_percent = max(0, min(100, score_percent))
        
        matches.append({
            "found": req.chapter_titles[i],
            "expected": expected_text,
            "score": score_percent,
            "book": str(row['Sách'])
        })
        total_score += score_percent
        
    avg_score = round(total_score / len(req.chapter_titles)) if req.chapter_titles else 0
    
    return {
        "match_percentage": avg_score,
        "matched_items": sum(1 for m in matches if m['score'] >= 50),
        "total_items": len(req.chapter_titles),
        "matches": matches
    }

class ChatMessage(BaseModel):
    role: str
    text: str

class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []

@app.post("/chat")
def chat_with_sylvi(req: ChatRequest):
    # Try reloading again just in case the file was changed
    load_dotenv('.env.local', override=True)
    current_api_key = os.environ.get("LLM_API_KEY", "")
    
    if not current_api_key:
        return {"reply": "Xin lỗi, quản trị viên chưa cấu hình API Key cho LLM. Vui lòng thêm LLM_API_KEY vào file .env.local"}
        
    try:
        client = genai.Client(api_key=current_api_key)
        
        # Format history for Gemini
        formatted_history = []
        for msg in req.history:
            role = "model" if msg.role == "model" else "user"
            formatted_history.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=msg.text)]
                )
            )
            
        chat = client.chats.create(
            model=LLM_MODEL,
            config=types.GenerateContentConfig(system_instruction=SYLVI_SYSTEM_PROMPT),
            history=formatted_history
        )
        
        response = chat.send_message(req.message)
        return {"reply": response.text}
    except Exception as e:
        print(f"Chatbot error: {e}")
        return {"reply": "Xin lỗi, hiện tại Sylvi đang gặp chút sự cố kỹ thuật. Vui lòng thử lại sau nhé!"}


# Auth and MongoDB Setup
MONGODB_URL = os.environ.get("MONGODB_URL", "mongodb://localhost:27017/bookbridge")
client = MongoClient(MONGODB_URL, tlsCAFile=certifi.where())
try:
    db = client.get_default_database()
except Exception:
    db = client['bookbridge']
users_collection = db['users']


JWT_SECRET = os.environ.get("JWT_SECRET", "supersecretkey_change_in_production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 days

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

class RegisterRequest(BaseModel):
    username: str
    password: str
    role: str # admin, teacher, student

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/register")
def register_user(req: RegisterRequest):
    if req.role not in ["admin", "teacher", "student"]:
        raise HTTPException(status_code=400, detail="Vai trò không hợp lệ.")
    
    # Check if username exists
    if users_collection.find_one({"username": req.username}):
        raise HTTPException(status_code=400, detail="Tên đăng nhập đã tồn tại.")
        
    # Handle roles
    is_approved = True
    if req.role == "teacher":
        is_approved = False
    elif req.role == "admin":
        # Check if admin already exists
        if users_collection.find_one({"role": "admin"}):
            raise HTTPException(status_code=400, detail="Hệ thống đã có Admin.")
            
    hashed_password = get_password_hash(req.password)
    user = {
        "username": req.username,
        "password": hashed_password,
        "role": req.role,
        "is_approved": is_approved,
        "created_at": datetime.utcnow()
    }
    
    users_collection.insert_one(user)
    
    msg = "Đăng ký thành công!"
    if req.role == "teacher":
        msg += " Tài khoản Giáo viên đang chờ Admin phê duyệt."
        
    return {"message": msg}

@app.post("/login")
def login_user(req: LoginRequest):
    user = users_collection.find_one({"username": req.username})
    if not user or not verify_password(req.password, user["password"]):
        raise HTTPException(status_code=400, detail="Sai tên đăng nhập hoặc mật khẩu.")
        
    if not user.get("is_approved", True):
        raise HTTPException(status_code=403, detail="Tài khoản Giáo viên của bạn chưa được Admin phê duyệt.")
        
    access_token = create_access_token(data={"sub": user["username"], "role": user["role"]})
    return {"token": access_token, "role": user["role"], "username": user["username"]}


from fastapi import Header
from typing import Optional
from bson import ObjectId

# --- ADMIN ENDPOINTS ---

def get_current_admin(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Forbidden")
        return payload.get("sub")
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.get("/admin/users")
def get_users(admin_user: str = Depends(get_current_admin)):
    users = list(users_collection.find({"role": {"$ne": "admin"}}, {"password": 0}))
    for u in users:
        u["_id"] = str(u["_id"])
    return users

@app.put("/admin/users/{username}/approve")
def approve_user(username: str, admin_user: str = Depends(get_current_admin)):
    result = users_collection.update_one({"username": username}, {"$set": {"is_approved": True}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found or already approved")
    return {"message": "User approved"}

@app.delete("/admin/users/{username}")
def delete_user(username: str, admin_user: str = Depends(get_current_admin)):
    result = users_collection.delete_one({"username": username})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

# Collections for pairing data and exercises
pairing_collection = db['pairing_data']
exercises_collection = db['exercises']

class PairingDataItem(BaseModel):
    type: str # 'school', 'grade', 'mode'
    value: str

@app.get("/admin/pairing_data")
def get_pairing_data():
    data = list(pairing_collection.find({}))
    for d in data:
        d["_id"] = str(d["_id"])
    return data

@app.post("/admin/pairing_data")
def add_pairing_data(item: PairingDataItem, admin_user: str = Depends(get_current_admin)):
    res = pairing_collection.insert_one(item.dict())
    return {"message": "Added", "id": str(res.inserted_id)}

@app.delete("/admin/pairing_data/{item_id}")
def delete_pairing_data(item_id: str, admin_user: str = Depends(get_current_admin)):
    pairing_collection.delete_one({"_id": ObjectId(item_id)})
    return {"message": "Deleted"}

@app.get("/admin/exercises")
def get_exercises(admin_user: str = Depends(get_current_admin)):
    data = list(exercises_collection.find({}))
    for d in data:
        d["_id"] = str(d["_id"])
    return data

@app.delete("/admin/exercises/{item_id}")
def delete_exercise(item_id: str, admin_user: str = Depends(get_current_admin)):
    exercises_collection.delete_one({"_id": ObjectId(item_id)})
    return {"message": "Deleted"}


# --- TEACHER EXERCISE ENDPOINTS ---

def get_current_teacher(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        if payload.get("role") != "teacher":
            raise HTTPException(status_code=403, detail="Chỉ giáo viên mới có quyền tạo bài tập.")
        return payload.get("sub")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

class CreateExerciseRequest(BaseModel):
    title: str
    format: str  # 'theory', 'quiz', 'slides'
    content: str  # HTML content of the generated exercise
    password: str = ""  # Optional password protection
    time_limit: int = 0 # 0 means no time limit, in minutes

@app.post("/exercises")
def create_exercise(req: CreateExerciseRequest, teacher: str = Depends(get_current_teacher)):
    doc = {
        "title": req.title,
        "format": req.format,
        "content": req.content,
        "password": req.password,
        "time_limit": req.time_limit,
        "teacher": teacher,
        "created_at": datetime.utcnow()
    }
    res = exercises_collection.insert_one(doc)
    return {"message": "Xuất bản bài tập thành công!", "id": str(res.inserted_id)}

class GenerateExerciseRequest(BaseModel):
    content: str   # The uploaded file text content
    format: str    # 'theory', 'quiz', 'slides'
    num_questions: int = 10 # Only for quiz format

GENERATE_PROMPTS = {
    "theory": """Bạn là một giáo viên chuyên nghiệp. Hãy tóm tắt nội dung tài liệu sau thành một bản tóm tắt lý thuyết trọng tâm chuẩn 1 trang A4.

YÊU CẦU FORMAT:
- Viết bằng Markdown thuần (KHÔNG wrap trong ```markdown```)
- Sử dụng cú pháp LaTeX cho công thức toán/vật lý/hóa học:
  + Inline: $công_thức$ (ví dụ: $v = v_0 + at$)
  + Display block: $$công_thức$$ (ví dụ: $$s = v_0 t + \\frac{1}{2}at^2$$)
- Có tiêu đề chính, các mục con, định nghĩa, công thức quan trọng, ví dụ minh họa
- Ngắn gọn, súc tích, dễ hiểu, phù hợp cho ôn tập
- Dùng bảng markdown nếu cần so sánh
- Highlight các công thức quan trọng

NỘI DUNG TÀI LIỆU:
""",
    "quiz": """Bạn là một giáo viên chuyên nghiệp. Hãy tạo CHÍNH XÁC {num_questions} câu hỏi trắc nghiệm từ nội dung tài liệu sau, theo các mức độ nhận thức của Bloom.

YÊU CẦU: Trả về KẾT QUẢ là JSON THUẦN TÚY (KHÔNG có ```json wrapper, KHÔNG có text trước/sau).

CẤU TRÚC JSON:
{
  "title": "Tiêu đề bài trắc nghiệm",
  "questions": [
    {
      "id": 1,
      "level": "Nhận biết",
      "question": "Nội dung câu hỏi (có thể dùng LaTeX: $...$)",
      "options": ["A. Đáp án A", "B. Đáp án B", "C. Đáp án C", "D. Đáp án D"],
      "correct": 0,
      "explanation": "Giải thích chi tiết tại sao đáp án đúng, có thể dùng công thức LaTeX"
    }
  ]
}

QUY TẮC:
- correct: index của đáp án đúng (0=A, 1=B, 2=C, 3=D)
- Mỗi câu PHẢI có đúng 4 options (A, B, C, D)
- explanation: giải thích RÕ RÀNG và CHI TIẾT, có thể dùng công thức LaTeX $...$
- Câu hỏi phải chính xác về mặt khoa học

NỘI DUNG TÀI LIỆU:
""",
    "slides": """Bạn là một giáo viên chuyên nghiệp. Hãy tạo dàn ý chi tiết cho bài thuyết trình PowerPoint từ nội dung tài liệu sau.

YÊU CẦU: Trả về KẾT QUẢ là JSON THUẦN TÚY (KHÔNG có ```json``` wrapper, KHÔNG có text trước/sau).

CẤU TRÚC JSON:
{
  "title": "Tiêu đề bài thuyết trình",
  "slides": [
    {
      "number": 1,
      "title": "Tiêu đề slide",
      "content": ["Nội dung bullet 1", "Nội dung bullet 2"],
      "notes": "Ghi chú chi tiết cho người thuyết trình"
    }
  ]
}

QUY TẮC:
- Tạo 8-12 slides
- Slide 1: Title slide (tiêu đề + subtitle)
- Slide cuối: Tổng kết & Câu hỏi thảo luận
- Mỗi slide có 3-5 bullet points ngắn gọn
- Notes chi tiết hơn nội dung slide (hướng dẫn trình bày)
- Có thể dùng LaTeX cho công thức: $...$
- Nội dung phù hợp để trình chiếu (ngắn gọn, keyword chính)

NỘI DUNG TÀI LIỆU:
"""
}

@app.post("/generate_exercise")
def generate_exercise(req: GenerateExerciseRequest, teacher: str = Depends(get_current_teacher)):
    load_dotenv('.env.local', override=True)
    current_api_key = os.environ.get("LLM_API_KEY", "")
    
    if not current_api_key:
        raise HTTPException(status_code=500, detail="API Key chưa được cấu hình. Vui lòng thêm LLM_API_KEY vào .env.local")
    
    if req.format not in GENERATE_PROMPTS:
        raise HTTPException(status_code=400, detail="Format không hợp lệ. Chọn: theory, quiz, slides")
    
    if not req.content or len(req.content.strip()) < 10:
        raise HTTPException(status_code=400, detail="Nội dung tài liệu quá ngắn hoặc trống.")
    
    try:
        client = genai.Client(api_key=current_api_key)
        
        if req.format == "quiz":
            prompt = GENERATE_PROMPTS[req.format].replace("{num_questions}", str(req.num_questions)) + "\n\nNỘI DUNG TÀI LIỆU:\n" + req.content
        else:
            prompt = GENERATE_PROMPTS[req.format] + req.content
        response = client.models.generate_content(
            model=LLM_MODEL,
            contents=prompt,
        )
        
        result_text = response.text.strip()
        
        # For quiz and slides: parse and validate JSON server-side to catch encoding issues early
        if req.format in ("quiz", "slides"):
            import re, json as _json
            
            # 1. Extract JSON block between first { and last }
            match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if match:
                result_text = match.group(0)
            
            # 2. Try to parse; if it fails due to bad escape sequences (e.g. LaTeX \frac)
            #    fix unescaped backslashes that are not valid JSON escape chars
            def fix_json_escapes(s: str) -> str:
                # Valid JSON escape sequences after backslash: " \ / b f n r t u
                valid_escapes = set('"\\\/bfnrtu')
                result = []
                i = 0
                while i < len(s):
                    ch = s[i]
                    if ch == '\\' and i + 1 < len(s):
                        next_ch = s[i + 1]
                        if next_ch in valid_escapes:
                            result.append(ch)
                            result.append(next_ch)
                            i += 2
                        else:
                            # Double the backslash so it becomes a valid \\
                            result.append('\\\\')
                            i += 1
                    else:
                        result.append(ch)
                        i += 1
                return ''.join(result)
            
            try:
                parsed = _json.loads(result_text)
                # Return as validated string (re-serialized clean JSON)
                result_text = _json.dumps(parsed, ensure_ascii=False)
            except _json.JSONDecodeError:
                # Try fixing escape sequences then re-parse
                fixed = fix_json_escapes(result_text)
                try:
                    parsed = _json.loads(fixed)
                    result_text = _json.dumps(parsed, ensure_ascii=False)
                except _json.JSONDecodeError as e2:
                    print(f"JSON fix still failed: {e2}\nRaw: {result_text[:500]}")
                    raise HTTPException(status_code=500, detail=f"AI trả về JSON không hợp lệ. Vui lòng thử lại!")
        
        return {"result": result_text, "format": req.format}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Generate exercise error: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi tạo nội dung: {str(e)}")

@app.get("/exercises")
def list_exercises():
    """Public endpoint — returns all published exercises (without content/password)."""
    data = list(exercises_collection.find({}).sort("created_at", -1))
    result = []
    for d in data:
        result.append({
            "_id": str(d["_id"]),
            "title": d.get("title", ""),
            "format": d.get("format", ""),
            "teacher": d.get("teacher", ""),
            "has_password": bool(d.get("password", "")),
            "created_at": d.get("created_at", "").isoformat() if d.get("created_at") else ""
        })
    return result

@app.get("/exercises/{exercise_id}")
def get_exercise(exercise_id: str, password: str = ""):
    """Get exercise content. If password-protected, must provide correct password."""
    exercise = exercises_collection.find_one({"_id": ObjectId(exercise_id)})
    if not exercise:
        raise HTTPException(status_code=404, detail="Bài tập không tồn tại.")
    
    stored_password = exercise.get("password", "")
    if stored_password and password != stored_password:
        raise HTTPException(status_code=403, detail="Mật khẩu không chính xác.")
    
    return {
        "_id": str(exercise["_id"]),
        "title": exercise.get("title", ""),
        "format": exercise.get("format", ""),
        "content": exercise.get("content", ""),
        "time_limit": exercise.get("time_limit", 0),
        "teacher": exercise.get("teacher", ""),
        "created_at": exercise.get("created_at", "").isoformat() if exercise.get("created_at") else ""
    }

class EditExerciseRequest(BaseModel):
    title: str
    content: str
    time_limit: int = 0

@app.put("/exercises/{exercise_id}")
def update_exercise(exercise_id: str, req: EditExerciseRequest, teacher: str = Depends(get_current_teacher)):
    """Allow a teacher to edit an exercise they created."""
    ex = exercises_collection.find_one({"_id": ObjectId(exercise_id)})
    if not ex:
        raise HTTPException(status_code=404, detail="Bài tập không tồn tại.")
    if ex.get("teacher") != teacher:
        raise HTTPException(status_code=403, detail="Chỉ người tạo mới được phép chỉnh sửa.")
    
    update_data = {
        "title": req.title,
        "content": req.content,
    }
    if req.time_limit is not None:
        update_data["time_limit"] = req.time_limit

    exercises_collection.update_one(
        {"_id": ObjectId(exercise_id)},
        {"$set": update_data}
    )
    return {"message": "Cập nhật bài tập thành công!"}

@app.get("/teacher/exercises")
def get_teacher_exercises(teacher: str = Depends(get_current_teacher)):
    """Get exercises created by current teacher."""
    data = list(exercises_collection.find({"teacher": teacher}).sort("created_at", -1))
    result = []
    for d in data:
        result.append({
            "_id": str(d["_id"]),
            "title": d.get("title", ""),
            "format": d.get("format", ""),
            "has_password": bool(d.get("password")),
            "time_limit": d.get("time_limit", 0),
            "created_at": d.get("created_at", "").isoformat() if d.get("created_at") else ""
        })
    return result


# --- PAIRING & NOTIFICATIONS ENDPOINTS ---
pairing_requests_collection = db['pairing_requests']
notifications_collection = db['notifications']

def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        return payload.get("sub")
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.get("/pairing_options")
def get_pairing_options():
    data = list(pairing_collection.find({}))
    result = {"school": [], "grade": [], "mode": []}
    for d in data:
        if d["type"] in result:
            result[d["type"]].append(d["value"])
    return result

from typing import Optional

class UserProfileUpdate(BaseModel):
    school: Optional[str] = None
    grade: Optional[str] = None
    mode: Optional[str] = None
    fullname: Optional[str] = None
    dob: Optional[str] = None
    class_name: Optional[str] = None
    address: Optional[str] = None
    avatar: Optional[str] = None

@app.put("/user/profile")
def update_profile(profile: UserProfileUpdate, username: str = Depends(get_current_user)):
    update_data = profile.dict(exclude_unset=True)
    if not update_data:
        return {"message": "No data to update"}
    
    # We update nested fields by prefixing them with 'profile.'
    set_fields = {f"profile.{k}": v for k, v in update_data.items()}
    users_collection.update_one({"username": username}, {"$set": set_fields})
    return {"message": "Profile updated"}

@app.get("/user/profile")
def get_profile(username: str = Depends(get_current_user)):
    user = users_collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    profile = user.get("profile", {})
    return profile

class PasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str

@app.put("/user/password")
def change_password(req: PasswordChangeRequest, username: str = Depends(get_current_user)):
    user = users_collection.find_one({"username": username})
    if not user or user.get("password") != req.old_password:
        raise HTTPException(status_code=400, detail="Mật khẩu cũ không chính xác")
    users_collection.update_one({"username": username}, {"$set": {"password": req.new_password}})
    return {"message": "Đổi mật khẩu thành công"}

student_exercises_collection = db['student_exercises']

class ExerciseSubmitRequest(BaseModel):
    title: str
    subject: str
    score: float
    time: str

@app.post("/user/exercises/submit")
def submit_exercise(req: ExerciseSubmitRequest, username: str = Depends(get_current_user)):
    doc = req.dict()
    doc["username"] = username
    doc["date"] = datetime.utcnow().strftime("%d/%m/%Y")
    student_exercises_collection.insert_one(doc)
    return {"message": "Đã lưu kết quả học tập"}

@app.get("/user/exercises")
def get_user_exercises(username: str = Depends(get_current_user)):
    records = list(student_exercises_collection.find({"username": username}).sort("_id", -1))
    history = []
    scores = []
    for r in records:
        history.append({
            "title": r.get("title", "Bài tập"),
            "score": r.get("score", 0.0),
            "time": r.get("time", "N/A"),
            "date": r.get("date", "")
        })
        scores.append({
            "subject": r.get("subject", r.get("title", "Môn học")),
            "score": r.get("score", 0.0),
            "date": r.get("date", "")
        })
    return {"scores": scores, "history": history}

class PairingRequestModel(BaseModel):
    type: str # 'borrow' or 'share'
    student_id: str
    class_time: str
    book_type: str

@app.post("/pairing_requests")
def create_pairing_request(req: PairingRequestModel, username: str = Depends(get_current_user)):
    user = users_collection.find_one({"username": username})
    school = user.get("profile", {}).get("school", "Chưa xác định") if user else "Chưa xác định"
    
    doc = req.dict()
    doc["username"] = username
    doc["school"] = school
    doc["created_at"] = datetime.utcnow()
    doc["status"] = "active"
    
    res = pairing_requests_collection.insert_one(doc)
    return {"message": "Tạo yêu cầu thành công!", "id": str(res.inserted_id)}

@app.get("/pairing_requests")
def get_pairing_requests():
    reqs = list(pairing_requests_collection.find({"status": "active"}).sort("created_at", -1))
    for r in reqs:
        r["_id"] = str(r["_id"])
    return reqs

class PairActionModel(BaseModel):
    target_request_id: str

@app.post("/pair_action")
def pair_action(req: PairActionModel, username: str = Depends(get_current_user)):
    target_req = pairing_requests_collection.find_one({"_id": ObjectId(req.target_request_id)})
    if not target_req:
        raise HTTPException(status_code=404, detail="Request not found")
        
    if target_req["username"] == username:
        raise HTTPException(status_code=400, detail="Không thể ghép cặp với chính mình!")
        
    noti = {
        "username": target_req["username"],
        "message": f"Người dùng <b>{username}</b> muốn ghép cặp với yêu cầu <b>{target_req['book_type']}</b> của bạn!",
        "created_at": datetime.utcnow(),
        "read": False
    }
    notifications_collection.insert_one(noti)
    # Auto-send a chat message to the request owner
    auto_msg = {
        "from": username,
        "to": target_req["username"],
        "text": f"Xin chào! Mình muốn ghép cặp với yêu cầu \"{target_req['book_type']}\" của bạn. Mình có thể trao đổi thêm được không?",
        "created_at": datetime.utcnow(),
        "read": False
    }
    messages_collection.insert_one(auto_msg)
    return {"message": "Đã gửi yêu cầu ghép cặp thành công!"}

@app.get("/notifications")
def get_notifications(username: str = Depends(get_current_user)):
    notis = list(notifications_collection.find({"username": username}).sort("created_at", -1))
    for n in notis:
        n["_id"] = str(n["_id"])
    return notis

@app.post("/notifications/read")
def read_notifications(username: str = Depends(get_current_user)):
    notifications_collection.update_many({"username": username, "read": False}, {"$set": {"read": True}})
    return {"message": "OK"}

# --- MESSAGING ENDPOINTS ---
messages_collection = db['messages']

class SendMessageRequest(BaseModel):
    to: str
    text: str

@app.post("/messages/send")
def send_message(req: SendMessageRequest, username: str = Depends(get_current_user)):
    if req.to == username:
        raise HTTPException(status_code=400, detail="Không thể gửi tin nhắn cho chính mình")
    # Check recipient exists
    recipient = users_collection.find_one({"username": req.to})
    if not recipient:
        raise HTTPException(status_code=404, detail="Người dùng không tồn tại")
    doc = {
        "from": username,
        "to": req.to,
        "text": req.text,
        "created_at": datetime.utcnow(),
        "read": False
    }
    messages_collection.insert_one(doc)
    return {"message": "Đã gửi tin nhắn"}

@app.get("/messages/conversations")
def get_conversations(username: str = Depends(get_current_user)):
    """Get list of users the current user has chatted with, with last message preview."""
    pipeline = [
        {"$match": {"$or": [{"from": username}, {"to": username}]}},
        {"$sort": {"created_at": -1}},
        {"$project": {
            "other": {"$cond": [{"$eq": ["$from", username]}, "$to", "$from"]},
            "text": 1, "created_at": 1, "read": 1, "from": 1
        }},
        {"$group": {
            "_id": "$other",
            "last_message": {"$first": "$text"},
            "last_time": {"$first": "$created_at"},
            "last_from": {"$first": "$from"},
            "last_read": {"$first": "$read"}
        }},
        {"$sort": {"last_time": -1}}
    ]
    convos = list(messages_collection.aggregate(pipeline))
    result = []
    for c in convos:
        # Count unread from this person
        unread = messages_collection.count_documents({"from": c["_id"], "to": username, "read": False})
        # Get role of the other user
        other_user = users_collection.find_one({"username": c["_id"]})
        other_role = other_user.get("role", "student") if other_user else "student"
        result.append({
            "username": c["_id"],
            "role": other_role,
            "last_message": c["last_message"][:60] + ("..." if len(c["last_message"]) > 60 else ""),
            "last_time": c["last_time"].isoformat() if c["last_time"] else "",
            "unread": unread
        })
    return result

@app.get("/messages/unread/count")
def get_unread_count(username: str = Depends(get_current_user)):
    count = messages_collection.count_documents({"to": username, "read": False})
    return {"count": count}

@app.get("/messages/{other_user}")
def get_messages(other_user: str, username: str = Depends(get_current_user)):
    """Get all messages between current user and other_user."""
    msgs = list(messages_collection.find({
        "$or": [
            {"from": username, "to": other_user},
            {"from": other_user, "to": username}
        ]
    }).sort("created_at", 1).limit(200))
    # Mark messages from other as read
    messages_collection.update_many(
        {"from": other_user, "to": username, "read": False},
        {"$set": {"read": True}}
    )
    result = []
    for m in msgs:
        result.append({
            "from": m["from"],
            "to": m["to"],
            "text": m["text"],
            "created_at": m["created_at"].isoformat() if m.get("created_at") else "",
            "read": m.get("read", True)
        })
    return result

@app.get("/users/search")
def search_users(q: str = "", username: str = Depends(get_current_user)):
    """Search users by username (partial match)."""
    if not q or len(q) < 1:
        return []
    users = list(users_collection.find(
        {"username": {"$regex": q, "$options": "i"}, "role": {"$ne": "admin"}},
        {"password": 0}
    ).limit(10))
    result = []
    for u in users:
        if u["username"] != username:
            result.append({
                "username": u["username"],
                "role": u.get("role", "student"),
                "fullname": u.get("profile", {}).get("fullname", "")
            })
    return result

if __name__ == "__main__":
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True)
