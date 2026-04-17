import requests
import sys

def run_sync_test():
    try:
        # 1. Login
        login_res = requests.post('http://localhost:8000/api/auth/login', 
                                 json={'email': 'test_script@example.com', 'password': 'Password123!'})
        if login_res.status_code != 200:
            print(f"Login failed: {login_res.text}")
            return
            
        token = login_res.json()['access_token']
        print("Logged in!")
        
        # 2. Upload
        with open('test_sync.txt', 'w') as f:
            f.write('Sample content for RAG testing. This is a local knowledge base.')
            
        with open('test_sync.txt', 'rb') as f:
            res = requests.post('http://localhost:8000/api/docs/upload', 
                               headers={'Authorization': f'Bearer {token}'}, 
                               files={'file': ('test_sync.txt', f, 'text/plain')})
                               
        print(f"Status: {res.status_code}")
        print(f"Response: {res.json()}")
    except Exception as e:
        print(f"Test error: {e}")

if __name__ == "__main__":
    run_sync_test()
