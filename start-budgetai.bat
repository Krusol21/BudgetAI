@echo off
echo Stopping any existing BudgetAI processes...
taskkill /F /IM node.exe /T >nul 2>&1

echo Starting BudgetAI...
start "BudgetAI Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"

timeout /t 4 /nobreak >nul

start "BudgetAI Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

timeout /t 4 /nobreak >nul

start "" "http://localhost:5173"
