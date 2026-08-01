import subprocess, sys, re, time
from pathlib import Path

SERVER = Path(r'D:\ledger\server')

# 1. Kill old processes
print('[1/3] Cleaning up old processes...')
subprocess.run(['taskkill', '/f', '/im', 'python.exe', '/fi', 'WINDOWTITLE eq uvicorn*'], capture_output=True)
subprocess.run(['taskkill', '/f', '/im', 'cf.exe'], capture_output=True)
time.sleep(1)

# 2. Start uvicorn
print('[2/3] Starting uvicorn on port 8765...')
uvicorn = subprocess.Popen(
    [str(SERVER / '.venv' / 'Scripts' / 'python.exe'), '-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8765'],
    cwd=str(SERVER),
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
time.sleep(2)

# 3. Start Cloudflare Tunnel
print('[3/3] Starting Cloudflare Tunnel...')
cf = subprocess.Popen(
    [str(SERVER / 'cf.exe'), 'tunnel', '--url', 'http://localhost:8765'],
    cwd=str(SERVER),
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1,
)

tunnel_url = None
pattern = re.compile(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com')

try:
    for line in cf.stdout:
        print(f'  cf: {line.rstrip()}')
        m = pattern.search(line)
        if m:
            tunnel_url = m.group(0)
            break
except KeyboardInterrupt:
    pass

if not tunnel_url:
    print('ERROR: Could not get tunnel URL')
    uvicorn.kill()
    cf.kill()
    sys.exit(1)

print()
print('=' * 50)
print(f'  Tunnel URL: {tunnel_url}')
print(f'  Local:      http://localhost:8765')
print('=' * 50)
print()
print('Copy the Tunnel URL above, open the app, go to:')
print('  资产 tab -> 同步 -> paste URL -> save')
print()
print('Keep this window open. Press Ctrl+C to stop.')
sys.stdout.flush()

try:
    cf.wait()
except KeyboardInterrupt:
    print('\nShutting down...')
    cf.kill()
    uvicorn.kill()
