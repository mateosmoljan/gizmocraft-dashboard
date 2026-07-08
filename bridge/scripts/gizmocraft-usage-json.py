#!/usr/bin/env python3
"""Emit live GizmoCraft Minecraft host usage telemetry as JSON.

Installed on gizmo-server at /usr/local/sbin/gizmocraft-usage-json.py and called
from the Piston public bridge over SSH. Keep this stdlib-only so it runs on the
Minecraft host without a Node/Python package install.
"""
import json, os, shutil, socket, struct, subprocess, time
from pathlib import Path

SERVER_ROOT = os.environ.get('MINECRAFT_SERVER_ROOT', '/home/cisco/minecraft-servers/gizmo-ivan')
WORLD_NAME = os.environ.get('MINECRAFT_WORLD_NAME', 'gizmo-ivan-dole')
WORLD_DIR = os.environ.get('MINECRAFT_WORLD_DIR', os.path.join(SERVER_ROOT, WORLD_NAME))
PORT = int(os.environ.get('MINECRAFT_SERVER_PORT', '25565'))

def run(cmd, timeout=1.5):
    try:
        return subprocess.check_output(cmd, timeout=timeout, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ''

def human_bytes(n):
    try:
        n = float(n)
    except Exception:
        n = 0
    units = ['B', 'KB', 'MB', 'GB', 'TB']
    i = 0
    while n >= 1024 and i < len(units) - 1:
        n /= 1024
        i += 1
    return f"{n:.0f} {units[i]}" if i == 0 else f"{n:.1f} {units[i]}"

def cpu_snap():
    line = Path('/proc/stat').read_text().splitlines()[0]
    vals = [int(x) for x in line.split()[1:]]
    idle = vals[3] + (vals[4] if len(vals) > 4 else 0)
    return idle, sum(vals)

def cpu_usage():
    a_idle, a_total = cpu_snap()
    time.sleep(0.2)
    b_idle, b_total = cpu_snap()
    total = b_total - a_total
    idle = b_idle - a_idle
    return round((1 - idle / total) * 100, 1) if total else None

def loadavg():
    try:
        return os.getloadavg()
    except Exception:
        return (0, 0, 0)

def memory():
    vals = {}
    for line in Path('/proc/meminfo').read_text().splitlines():
        key, rest = line.split(':', 1)
        vals[key] = int(rest.strip().split()[0]) * 1024
    total = vals.get('MemTotal', 0)
    available = vals.get('MemAvailable', 0)
    used = max(0, total - available)
    return {'used': human_bytes(used), 'total': human_bytes(total), 'available': human_bytes(available), 'usedPercent': round(used / total * 100, 1) if total else None}

def disk():
    mount = WORLD_DIR if Path(WORLD_DIR).exists() else '/'
    usage = shutil.disk_usage(mount)
    return {'mount': mount, 'total': human_bytes(usage.total), 'used': human_bytes(usage.used), 'available': human_bytes(usage.free), 'usedPercent': round(usage.used / usage.total * 100, 1) if usage.total else None}

def network():
    default_route = run(['ip', 'route', 'show', 'default'])
    iface = None
    parts = default_route.split()
    if 'dev' in parts:
        iface = parts[parts.index('dev') + 1]
    oper = run(['cat', f'/sys/class/net/{iface}/operstate']) if iface else ''
    nm_wifi = run(['nmcli', '-t', '-f', 'ACTIVE,SSID', 'dev', 'wifi'])
    nm_status = run(['nmcli', '-t', '-f', 'DEVICE,TYPE,STATE,CONNECTION', 'dev', 'status'])
    wifi_status = None
    for line in nm_status.splitlines():
        cols = line.split(':')
        if len(cols) >= 4 and cols[1] == 'wifi' and cols[2] == 'connected':
            wifi_status = cols
            break
    ssid = ''
    for line in nm_wifi.splitlines():
        cols = line.split(':')
        if len(cols) >= 2 and cols[0] == 'yes' and cols[1]:
            ssid = cols[1]
            break
    ssid = ssid or run(['iwgetid', '-r']) or (wifi_status[3] if wifi_status else '')
    if ssid:
        summary = f'Wi‑Fi: {ssid}'
        detail = f'Minecraft host connected on {wifi_status[0] if wifi_status else iface or "wireless interface"}'
    elif iface:
        summary = f'Interface: {iface}'
        detail = 'Minecraft host network is up; no Wi‑Fi SSID reported.'
    else:
        summary = 'Unavailable'
        detail = 'No default network interface reported.'
    return {'interface': iface, 'state': oper or None, 'wifi': {'ssid': ssid or None, 'connected': bool(ssid or wifi_status)}, 'summary': summary, 'detail': detail}

def varint(n):
    out = bytearray()
    while True:
        b = n & 0x7f
        n >>= 7
        out.append(b | (0x80 if n else 0))
        if not n:
            return bytes(out)

def read_varint(sock):
    num = 0
    for i in range(5):
        b = sock.recv(1)
        if not b:
            raise EOFError('varint eof')
        val = b[0]
        num |= (val & 0x7f) << (7 * i)
        if not val & 0x80:
            return num
    raise ValueError('varint too long')

def mc_status():
    try:
        host = '127.0.0.1'
        proto = 767
        host_b = host.encode()
        payload = varint(0) + varint(proto) + varint(len(host_b)) + host_b + struct.pack('>H', PORT) + varint(1)
        packet = varint(len(payload)) + payload
        with socket.create_connection((host, PORT), timeout=2) as s:
            s.sendall(packet + b'\x01\x00')
            length = read_varint(s)
            data = b''
            while len(data) < length:
                data += s.recv(length - len(data))
        idx = 0
        def vi_buf(buf, off):
            num = 0
            for i in range(5):
                val = buf[off + i]
                num |= (val & 0x7f) << (7 * i)
                if not val & 0x80:
                    return num, off + i + 1
            raise ValueError('bad varint')
        _packet_id, idx = vi_buf(data, idx)
        strlen, idx = vi_buf(data, idx)
        status = json.loads(data[idx:idx + strlen].decode())
        players = status.get('players') or {}
        names = sorted([p.get('name') for p in players.get('sample') or [] if p.get('name')])
        return int(players.get('online') or 0), int(players.get('max') or 0), names, True
    except Exception:
        return None

def latest_log_players():
    open_players = {}
    try:
        text = Path(SERVER_ROOT, 'logs/latest.log').read_text(errors='ignore')
        import re
        for line in text.splitlines():
            m = re.match(r'^\[(\d{2}):(\d{2}):(\d{2})\].*?: ([A-Za-z0-9_]{1,16}) (joined|left) the game\b', line)
            if not m:
                continue
            name, action = m.group(4), m.group(5)
            if action == 'joined':
                open_players[name] = True
            else:
                open_players.pop(name, None)
    except Exception:
        pass
    return sorted(open_players)

def minecraft():
    pid = run(['bash', '-lc', 'systemctl --user show minecraft-gizmo-ivan.service --property=MainPID --value 2>/dev/null || true'])
    service = 'minecraft-gizmo-ivan.service' if pid and pid != '0' else ''
    if not pid or pid == '0':
        pids = run(['pgrep', '-f', 'java.*(minecraft|gizmo|server)']).splitlines()
        pid = pids[0] if pids else ''
    rss = int(run(['ps', '-o', 'rss=', '-p', pid]) or 0) if pid else 0
    uptime = run(['ps', '-o', 'etime=', '-p', pid]) if pid else ''
    max_players = 10
    try:
        for line in Path(SERVER_ROOT, 'server.properties').read_text().splitlines():
            if line.startswith('max-players='):
                max_players = int(line.split('=', 1)[1])
    except Exception:
        pass
    live = mc_status()
    if live:
        online, maxp, names, live_ok = live
    else:
        names = latest_log_players()
        online = len(names)
        maxp = max_players
        live_ok = False
    total_mem = os.sysconf('SC_PAGE_SIZE') * os.sysconf('SC_PHYS_PAGES')
    return {'status': 'running' if pid else 'unknown', 'process': f'pid {pid}' + (f' · {service}' if service else '') if pid else 'not found', 'uptime': uptime or None, 'playersOnline': online, 'maxPlayers': maxp or max_players, 'onlinePlayers': names, 'onlineSource': 'server-status' if live_ok else 'latest-log-fallback', 'memory': {'used': human_bytes(rss * 1024), 'percent': round((rss * 1024) / total_mem * 100, 1) if rss and total_mem else None}}

payload = {
    'checkedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    'system': {
        'host': socket.gethostname(),
        'cpu': {'usagePercent': cpu_usage(), 'detail': f"{os.cpu_count() or 1} cores · load " + ' / '.join(f'{x:.2f}' for x in loadavg())},
        'memory': memory(),
        'disk': disk(),
        'network': network(),
    },
    'minecraft': minecraft(),
}
print(json.dumps(payload, separators=(',', ':')))
