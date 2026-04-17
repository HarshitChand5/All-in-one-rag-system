import requests
import sys

def test_chat():
    try:
        # 1. Login
        login_res = requests.post('http://localhost:8000/api/auth/login', 
                                 json={'email': 'test_script2@example.com', 'password': 'password123'})
        if login_res.status_code != 200:
            print("Login failed, trying to sign up...")
            signup_res = requests.post('http://localhost:8000/api/auth/signup', 
                                     json={'email': 'test_script2@example.com', 'password': 'password123', 'full_name': 'Test'})
            if signup_res.status_code != 200:
                print(f"Signup failed: {signup_res.text}")
                return
            token = signup_res.json()['access_token']
        else:
            token = login_res.json()['access_token']
            
        print("Logged in!")
        
        # 2. Create Session
        session_res = requests.post('http://localhost:8000/api/chat/sessions', 
                                   headers={'Authorization': f'Bearer {token}'},
                                   json={'title': 'Test Chat'})
        session_id = session_res.json()['id']
        print(f"Session created: {session_id}")
        
        # 3. Query
        query_res = requests.post('http://localhost:8000/api/chat/query', 
                                 headers={'Authorization': f'Bearer {token}'},
                                 json={'session_id': session_id, 'query': 'What is DocuRAG?'})
                                 
        print(f"Status: {query_res.status_code}")
        print(f"Response: {query_res.json()}")
    except Exception as e:
        print(f"Test error: {e}")

if __name__ == "__main__":
    test_chat()
