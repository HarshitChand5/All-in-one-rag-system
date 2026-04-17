import requests
import sys

def test_signup():
    url = "http://localhost:8000/api/auth/signup"
    payload = {
        "email": "test_script@example.com",
        "password": "Password123!",
        "full_name": "Test Script"
    }
    try:
        response = requests.post(url, json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_signup()
