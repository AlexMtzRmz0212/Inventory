@echo off
setlocal
cd /d "%~dp0"

rem DEV.bat        start the dev server in the background and open (or refresh) the page
rem DEV.bat stop   stop the background dev server
if /i "%~1"=="stop" goto :stop

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

call :listening
if errorlevel 1 (
  echo Starting the dev server in the background...
  powershell -NoProfile -Command "Start-Process -WindowStyle Hidden -FilePath cmd.exe -ArgumentList '/c npm run dev > dev-server.log 2>&1' -WorkingDirectory '%~dp0'"
  for /l %%i in (1,1,60) do (
    call :listening && goto :ready
    timeout /t 1 /nobreak >nul
  )
  echo.
  echo The server did not come up in 60 seconds. See dev-server.log
  goto :fail
)

:ready
rem If a browser window is already showing the page, refresh it. Otherwise open a new one.
rem Only the active tab of a browser window can be found, so keep the Inventory tab in front.
powershell -NoProfile -Command "$w = Get-Process chrome,msedge,firefox,brave,opera -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like 'Inventory*' } | Select-Object -First 1; if ($w) { $s = New-Object -ComObject WScript.Shell; if ($s.AppActivate($w.Id)) { Start-Sleep -Milliseconds 300; $s.SendKeys('{F5}'); exit 0 } }; Start-Process 'http://localhost:3000'"
rem "exit" (not "exit /b") closes the window even when this was started from an open prompt.
exit

:stop
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"
echo Dev server stopped.
goto :eof

:listening
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
exit /b %errorlevel%

:fail
echo.
echo Setup failed. See the error above.
pause
exit /b 1
