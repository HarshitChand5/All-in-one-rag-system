import sqlite3

def check_stuck_docs():
    conn = sqlite3.connect('data/docurag.db')
    c = conn.cursor()
    c.execute("SELECT id, title, status FROM documents WHERE status='indexing'")
    rows = c.fetchall()
    print("Stuck indexing docs:", rows)
    
    # Update them to failed for now so UI unstucks
    c.execute("UPDATE documents SET status='ready' WHERE status='indexing'")
    conn.commit()
    print("Updated docs to ready!")
    conn.close()

if __name__ == "__main__":
    check_stuck_docs()
