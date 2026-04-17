import requests
import sys

def test_upload():
    # 1. Sign up/Login to get Token
    login_url = "http://localhost:8000/api/auth/login"
    login_data = {"email": "test_script@example.com", "password": "Password123!"}
    
    try:
        login_res = requests.post(login_url, json=login_data)
        if login_res.status_code != 200:
            print(f"Login failed: {login_res.json()}")
            return
            
        token = login_res.json()["access_token"]
        print(f"Logged in, token: {token[:20]}...")
        
        # 2. Upload file
        upload_url = "http://localhost:8000/api/docs/upload"
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create a dummy file
        with open("test_upload.txt", "w") as f:
            f.write("This is a test document for DocuRAG.")
            
        with open("test_upload.txt", "rb") as f:
            files = {"file": ("test_upload.txt", f, "text/plain")}
            response = requests.post(upload_url, headers=headers, files=files)
            
        print(f"Upload Status Code: {response.status_code}")
        print(f"Upload Response: {response.json()}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_upload()
