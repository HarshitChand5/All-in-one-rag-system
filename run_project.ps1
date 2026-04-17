Start-Process powershell -ArgumentList "-NoExit -Command cd backend; .\venv\Scripts\python.exe main.py"
Start-Process powershell -ArgumentList "-NoExit -Command cd frontend; npm run dev"
