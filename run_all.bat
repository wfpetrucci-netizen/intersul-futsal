@echo off
REM Start FastAPI server
start "" "%~dp0.venv_new\Scripts\uvicorn.exe" main:app --host 0.0.0.0 --port 8000

REM Wait a few seconds for the server to start
ping 127.0.0.1 -n 5 > NUL

REM Start ngrok tunnel
start "" "%~dp0ngrok.exe" http 8000 --subdomain inter-sul-futsal-diretoria


