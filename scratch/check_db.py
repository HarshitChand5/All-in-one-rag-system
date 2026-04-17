
import sqlite3
import os

db_path = "backend/docurag.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM image_assets")
        rows = cursor.fetchall()
        print(f"Found {len(rows)} images in image_assets table.")
        for row in rows:
            print(row)
    except Exception as e:
        print(f"Error: {e}")
    conn.close()
else:
    print("Database not found.")
