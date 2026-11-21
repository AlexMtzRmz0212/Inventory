@echo off
setlocal
cd /d "%~dp0"
title Inventory dev server

if not exist node_modules (
  echo Installing dependencies...
  call npm install || goto :fail
)

if not exist .env.local (
  echo.
  echo No .env.local found. Running with sample data and no private login.
  echo Copy .env.example to .env.local to use Notion and the owner password.
  echo.
)

rem Open the browser a few seconds after the server starts.
start "" /b cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3000"

call npm run dev
goto :eof

:fail
echo.
echo Setup failed. See the error above.
pause
exit /b 1
