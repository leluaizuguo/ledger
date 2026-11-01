@echo off
cd /d D:\ledger\server
.venv\Scripts\python stop.py
timeout /t 2 >nul
