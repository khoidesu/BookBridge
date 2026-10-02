import os
from dotenv import load_dotenv
load_dotenv(".env.local", override=True)
from google import genai
from google.genai import types

api_key = os.environ.get("LLM_API_KEY")
client = genai.Client(api_key=api_key)

history = [
    types.Content(role="user", parts=[types.Part.from_text(text="Hello, I am testing.")]),
    types.Content(role="model", parts=[types.Part.from_text(text="Great to meet you!")]),
]
chat = client.chats.create(
    model="gemini-2.5-flash",
    config=types.GenerateContentConfig(system_instruction="You are a helpful assistant.", temperature=0.5),
    history=history
)
res = chat.send_message("What did I just say?")
print(res.text)
