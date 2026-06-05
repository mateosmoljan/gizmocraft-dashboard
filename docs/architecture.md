# GizmoCraft Dashboard architecture

## Goal

A public, visually pleasing Minecraft dashboard where players log in with Google, claim/link their Minecraft profile, view their own profile, and see shared/funny competitive boards for the `Gizmo Ivan — Dole` world.

## Current Minecraft source

- Host: `gizmo-server` / `100.89.200.93`
- Server folder: `/home/cisco/minecraft-servers/gizmo-ivan`
- World folder: `/home/cisco/minecraft-servers/gizmo-ivan/gizmo-ivan-dole`
- Stats source: `gizmo-ivan-dole/players/stats/*.json`
- Advancements source: `gizmo-ivan-dole/players/advancements/*.json`
- Player names source: `usercache.json`
- Minecraft service: `minecraft-gizmo-ivan.service`
- Server port: `25565`

## Deployment split

- UI: Vercel, public HTTPS.
- Auth: Google OAuth through NextAuth.
- Database: MySQL on `gizmo-server`.
- Bridge/API: public authenticated HTTPS endpoint on `gizmo-server` via Tailscale Serve/Funnel or equivalent reverse proxy. Vercel calls this bridge. The bridge talks to MySQL and local Minecraft world files.

Do not expose raw MySQL publicly. Public means public dashboard and authenticated bridge, not `3306` open to the internet.

## Data pipeline

1. Collector on `gizmo-server` reads Minecraft JSON stats, advancements, usercache, logs/latest.log, and optional server health/TPS.
2. Collector writes normalized rows into MySQL.
3. Bridge exposes read APIs: `/health`, `/players`, `/players/:uuid`, `/leaderboards`, `/events`, `/world`.
4. Vercel UI fetches bridge APIs with a server-side token.
5. Players authenticate with Google and link to their Minecraft UUID/name. Known player email addresses can be preloaded into `player_emails`; when that Google email signs in, the app auto-attaches the account to the matching Minecraft UUID. Users can then edit their public username, display name, and profile picture from `/profile`.

## Player profiles

- Public directory: `/profiles`.
- Public profile route: `/u/[username]`.
- Settings route: `/profile`.
- Email linking table: `player_emails(email, player_uuid, label, verified, source)`.
- Admin API for pre-attaching emails: `POST /api/admin/player-emails` with `{ email, playerUuid, label? }`; requester must have `users.role = ADMIN`.
- Usernames are normalized slugs and globally unique, so profile URLs remain scalable for many players.

## Boards

- Richest Miner: diamonds/ancient debris/netherite.
- Tunnel Goblin: blocks mined.
- Mob Menace: mobs killed.
- Death Tax: death count.
- Wanderer: distance traveled.
- Addict Board: playtime.
- Builder: blocks placed/crafted.
- Advancement Hunter: advancement completion.
- Food Vacuum: food eaten.
- Coward Index: beds used / deaths avoided / distance fled, if derivable.

## Implementation phases

1. UI scaffold with sample data and design system.
2. MySQL schema + collector dry run from `gizmo-server` world JSON.
3. Bridge API on laptop/server with token auth.
4. Google OAuth login + player claiming.
5. Vercel deployment and public URL.
6. Live sync job every 1-5 minutes plus daily/weekly awards.
