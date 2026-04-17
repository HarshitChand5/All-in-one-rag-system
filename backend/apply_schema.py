import os
import psycopg2
from urllib.parse import urlparse
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL")

if not db_url:
    print("Error: DATABASE_URL not found in .env")
    exit(1)

# Ensure connection pooling mode is handled if needed, but direct connection should work for schema creation
print(f"Connecting to database...")

try:
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cursor = conn.cursor()
    
    # Read the schema file
    file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "database", "schema.sql")
    with open(file_path, "r") as f:
        schema_sql = f.read()
        
    print("Executing schema.sql...")
    cursor.execute(schema_sql)
    
    print("Schema executed successfully!")
    
except Exception as e:
    print(f"Failed to execute schema: {e}")
finally:
    if 'conn' in locals():
        conn.close()
