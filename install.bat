@echo off
setlocal
cd /d "%~dp0"
py -3 -m venv backend\.venv 2>nul
if not exist backend\.venv\Scripts\python.exe python -m venv backend\.venv
call backend\.venv\Scripts\python.exe -m pip install --upgrade pip
call backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
pushd frontend
call npm install
popd
call backend\.venv\Scripts\python.exe scripts\init_sample.py
echo Setup finished. Run run_local.bat to start the app.
pause
