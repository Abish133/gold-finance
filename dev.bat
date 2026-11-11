@echo off
cd /d "%~dp0"

if not exist "server\.env" (
  echo server\.env is missing - copy .env.local to server\.env first.
  pause
  exit /b 1
)

start "Gold Finance - API" cmd /k npm run dev:server
start "Gold Finance - Client" cmd /k npm run dev:client
