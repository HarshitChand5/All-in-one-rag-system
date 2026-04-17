
import sqlite3
import os

db_path = "backend/data/docurag.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print(f"Tables: {tables}")
        
        cursor.execute("SELECT * FROM image_assets")
        rows = cursor.fetchall()
        print(f"Found {len(rows)} images in image_assets table.")
        for row in rows:
            print(row)
    except Exception as e:
        print(f"Error: {e}")
    conn.close()
else:
    print(f"Database not found at {db_path}.")
