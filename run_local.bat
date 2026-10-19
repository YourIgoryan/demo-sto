@echo off
setlocal
cd /d "%~dp0"
if not exist "backend\.venv\Scripts\python.exe" (
  echo [1/4] Creating backend virtual environment...
  py -3 -m venv backend\.venv
  if errorlevel 1 python -m venv backend\.venv
)
echo [2/4] Installing backend dependencies...
call backend\.venv\Scripts\python.exe -m pip install --upgrade pip
call backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
if errorlevel 1 (pause & exit /b 1)
echo [3/4] Initializing demo studio...
call backend\.venv\Scripts\python.exe scripts\init_sample.py
start "AutoStudio API" /D "%~dp0backend" cmd /k ".venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
if not exist "frontend\node_modules" (
  echo [4/4] Installing frontend dependencies...
  pushd frontend
  call npm install
  if errorlevel 1 (pause & exit /b 1)
  popd
)
start "AutoStudio Web" /D "%~dp0frontend" cmd /k "npm run dev"
echo.
echo AutoStudio is starting.
echo Public sample: http://127.0.0.1:5173/s/sample/
echo Owner cabinet: http://127.0.0.1:5173/owner/sample/
echo API docs:      http://127.0.0.1:8000/docs
echo Demo login: owner@sample.local / SampleOwner2026!
echo Keep both console windows open.
pause
