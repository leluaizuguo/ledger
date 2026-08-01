@echo off
echo Starting Ledger Sync Server...
start "Ledger Server" /min cmd /c "cd /d D:\ledger\server && .venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8765"
timeout /t 3 /nobreak >nul
echo Starting Cloudflare Tunnel...
start "Cloudflare Tunnel" /min cmd /c "D:\ledger\server\cf.exe tunnel --url http://localhost:8765"
echo Done. Server running on port 8765, tunnel active.
