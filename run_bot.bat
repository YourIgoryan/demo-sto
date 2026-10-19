@echo off
setlocal
cd /d "%~dp0"
if not exist "bot\.env" (
  copy "bot\.env.example" "bot\.env" >nul
  echo Created bot\.env. Add your BOT_TOKEN from @BotFather first.
  notepad "bot\.env"
  echo Save bot\.env, then run run_bot.bat again.
  pause
  exit /b 0
)
if not exist "backend\.venv\Scripts\python.exe" (
  echo Backend virtual environment not found. Run run_local.bat once first.
  pause
  exit /b 1
)
echo Installing Telegram bot dependencies...
call backend\.venv\Scripts\python.exe -m pip install -r bot\requirements.txt
if errorlevel 1 (pause & exit /b 1)
echo Starting AutoStudio Telegram bot...
call backend\.venv\Scripts\python.exe bot\bot.py
pause
