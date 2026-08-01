@echo off
cd /d D:\ledger\server
.venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8765
