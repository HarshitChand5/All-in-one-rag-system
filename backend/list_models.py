import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

def list_embedding_models():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not found")
        return
        
    genai.configure(api_key=api_key)
    print(f"API Key found: {api_key[:5]}...")
    
    try:
        models = genai.list_models()
        print("Available Models:")
        for m in models:
            print(f"- {m.name} (Methods: {m.supported_generation_methods})")
    except Exception as e:
        print(f"Error listing models: {e}")

if __name__ == "__main__":
    list_embedding_models()
