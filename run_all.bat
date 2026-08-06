@echo off
REM Start FastAPI server
start "" "C:\Users\Wagne\AppData\Local\Python\pythoncore-3.14-64\Scripts\uvicorn.exe" main:app --host 0.0.0.0 --port 8000

REM Wait a few seconds for the server to start
timeout /t 5 /nobreak > NUL

REM Start ngrok tunnel
start "" "%~dp0ngrok.exe" http 8000 --subdomain inter-sul-futsal-diretoria
