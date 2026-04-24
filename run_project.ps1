Start-Process powershell -WorkingDirectory "backend" -ArgumentList "-NoExit", "-Command", ".\venv\Scripts\python.exe main.py"
Start-Process powershell -WorkingDirectory "frontend" -ArgumentList "-NoExit", "-Command", "npm run dev"
