import subprocess, os
from pathlib import Path

SERVER = Path(r'D:\ledger\server')
PID_FILE = SERVER / '.server_pids'

if not PID_FILE.exists():
    print('No .server_pids found — server might not be running.')
    print('Falling back to taskkill...')
    subprocess.run(['taskkill', '/f', '/im', 'cf.exe'], capture_output=True)
    subprocess.run(['taskkill', '/f', '/im', 'python.exe', '/fi', 'WINDOWTITLE eq uvicorn*'], capture_output=True)
    sys.exit(0)

with open(PID_FILE) as f:
    pids = [line.strip() for line in f if line.strip()]

for pid in pids:
    subprocess.run(['taskkill', '/f', '/pid', pid], capture_output=True)
    print(f'Killed PID {pid}')

PID_FILE.unlink()
print('Server stopped.')
