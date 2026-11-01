import subprocess, sys, time, os
from pathlib import Path

def log(msg):
    try:
        print(msg, flush=True)
    except (OSError, AttributeError):
        pass

SERVER = Path(r'D:\ledger\server')
TUNNEL_URL = 'https://ledger.lelihome.vip'
PID_FILE = SERVER / '.server_pids'

DETACHED = 0x00000008  # DETACHED_PROCESS

# 1. Kill old processes
log('[1/3] Cleaning up old processes...')
# Kill anything on port 8765
r = subprocess.run(['cmd', '/c', 'netstat -ano | findstr :8765 | findstr LISTENING'],
                   capture_output=True, text=True)
for line in r.stdout.strip().split('\n'):
    parts = line.strip().split()
    if parts and parts[-1].isdigit():
        subprocess.run(['cmd', '/c', f'taskkill /F /PID {parts[-1]}'], capture_output=True)
# Kill old cf.exe
subprocess.run(['taskkill', '/f', '/im', 'cf.exe'], capture_output=True)
time.sleep(1)

# 2. Start uvicorn (detached)
log('[2/3] Starting uvicorn on port 8765...')
uvicorn = subprocess.Popen(
    [str(SERVER / '.venv' / 'Scripts' / 'python.exe'), '-m', 'uvicorn', 'main:app',
     '--host', '0.0.0.0', '--port', '8765'],
    cwd=str(SERVER),
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
    creationflags=DETACHED,
)
time.sleep(2)

# 3. Start Cloudflare Named Tunnel (detached, log to file)
log('[3/3] Starting Cloudflare Tunnel...')
cf_log = open(SERVER / 'tunnel.log', 'w')
cf = subprocess.Popen(
    [str(SERVER / 'cf.exe'), 'tunnel', '--config', str(SERVER / 'tunnel-config.yml'), 'run', 'ledger'],
    cwd=str(SERVER),
    stdout=cf_log,
    stderr=subprocess.STDOUT,
    creationflags=DETACHED,
)

# Wait for tunnel to connect (read from log)
deadline = time.time() + 30
while time.time() < deadline:
    try:
        with open(SERVER / 'tunnel.log', 'r') as f:
            for line in f:
                if 'INF' in line and ('Registered tunnel connection' in line or
                                       'Connection' in line or
                                       'healthy' in line.lower()):
                    break
            else:
                time.sleep(1)
                continue
            break
    except FileNotFoundError:
        time.sleep(1)

# Write PIDs
with open(PID_FILE, 'w') as f:
    f.write(f'{uvicorn.pid}\n{cf.pid}\n')
log(f'  PIDs: uvicorn={uvicorn.pid}, cf={cf.pid}')
log('')
log('=' * 50)
log(f'  Sync URL:   {TUNNEL_URL}')
log(f'  Local:      http://localhost:8765')
log('=' * 50)
