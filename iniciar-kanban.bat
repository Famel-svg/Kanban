@echo off
setlocal
set "PROJECT_DIR=C:\Users\Rafael Tanimoto\NUCLEO ENGENHARIA\CN - 471 SEHAB - 3 - Area de Trabalho\RAFAEL\Kanban"
cd /d "%PROJECT_DIR%"

netstat -ano | findstr /R /C:":8080 .*LISTENING" >nul
if errorlevel 1 (
  start "Kanban Local" /b py -3 server.py
  ping -n 3 127.0.0.1 >nul
)

if /i not "%~1"=="--startup" start "" http://localhost:8080/
endlocal
