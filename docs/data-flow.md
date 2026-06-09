# GizmoCraft Data Flow

This is the source-of-truth map for dashboard data. Keep it updated when changing collectors, bridge routes, or UI data fallbacks.

## Sources

- Minecraft server root: `/home/cisco/minecraft-servers/gizmo-ivan`
- Active world: `/home/cisco/minecraft-servers/gizmo-ivan/gizmo-ivan-dole`
- Server config: `/home/cisco/minecraft-servers/gizmo-ivan/server.properties`
- Player stats files: `gizmo-ivan-dole/players/stats/*.json`
- Current online players: `logs/latest.log` join/leave state since the current server start
- Historical Minecraft world sessions: `logs/*.log` and `logs/*.log.gz` join/leave events

## Bridge

Bridge source lives in `bridge/src/` and runs on `gizmo-server` as user service:

```bash
systemctl --user status minecraft-dashboard-bridge.service
```

Important routes:

- `POST /api/sync` — reads world stat files and server logs into MySQL.
- `GET /api/leaderboards` — returns player stats plus live `world.playersOnline`, `world.onlinePlayers`, and `world.maxPlayers`.
- `GET /api/usage` — returns host/server telemetry plus `minecraft.playersOnline` and `minecraft.onlinePlayers`.
- `GET /api/profiles` and `/api/profiles/:username` — returns public profile data, stats, playtime, and recent Minecraft sessions. If a player is currently online, the profile payload includes an open session from `latest.log`.

Production Vercel reaches the bridge through Tailscale Funnel. With the current `/api` Funnel mount, the public probe path is usually:

```bash
https://gizmo-server.tailfca8d2.ts.net/api/api/leaderboards
```

## UI data rules

- Do not show invented/sample player stats in production views.
- Use last-loaded client-cached data as the fallback while live data loads.
- Show skeletons only during an explicit refresh action.
- If no cached/live data exists yet, show honest empty copy such as `No player data loaded yet`, not fake player values.

## Verification checklist

Run these after data-flow changes:

```bash
npm run build
node --check bridge/src/server.js
node --check bridge/src/sync.js
```

On `gizmo-server`, verify real online state from the current server log:

```bash
cd /home/cisco/minecraft-servers/gizmo-ivan
python3 - <<'PY'
import re
players=set()
for line in open('logs/latest.log', errors='ignore'):
    m=re.search(r': ([A-Za-z0-9_]{1,16}) joined the game', line)
    if m: players.add(m.group(1))
    m=re.search(r': ([A-Za-z0-9_]{1,16}) left the game', line)
    if m: players.discard(m.group(1))
print(sorted(players), len(players))
PY
```

Then verify bridge output matches:

```bash
curl -fsS -H "Authorization: Bearer $MINECRAFT_BRIDGE_TOKEN" \
  https://gizmo-server.tailfca8d2.ts.net/api/api/leaderboards | jq '.world.playersOnline,.world.onlinePlayers'
```

Also verify DB health:

```sql
SELECT COUNT(*) FROM players;
SELECT COUNT(*) FROM player_stat_snapshots;
SELECT COUNT(*) FROM player_sessions a JOIN player_sessions b
  ON a.id < b.id
 AND a.player_uuid = b.player_uuid
 AND a.joined_at <= COALESCE(b.left_at,b.joined_at)
 AND COALESCE(a.left_at,a.joined_at) >= b.joined_at;
SELECT id,status,finished_at,details FROM sync_runs ORDER BY id DESC LIMIT 5;
```
