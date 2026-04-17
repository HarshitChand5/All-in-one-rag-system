from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
import os

load_dotenv()

llm = ChatGoogleGenerativeAI(
    model="models/gemini-1.5-flash",
    google_api_key=os.getenv("GEMINI_API_KEY"),
)
try:
    print(llm.invoke("hello").content)
except Exception as e:
    print("models/gemini-1.5-flash ERROR:", e)

llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash",
    google_api_key=os.getenv("GEMINI_API_KEY"),
)
try:
    print(llm.invoke("hello").content)
except Exception as e:
    print("gemini-1.5-flash ERROR:", e)
