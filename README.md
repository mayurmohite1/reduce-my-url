## URL shortener + analytics

Production-style URL shortener with analytics.

### Stack
- **Redis**: caches redirects (cache-first, avoid hitting Postgres on hot paths)
- **PostgreSQL**: stores users, short links, and click events
- **Express/Node**: REST API + redirect handler
- **React**: analytics dashboard (click charts, top referrers, geo breakdown)

### Repo layout
- `apps/api`: Express API + redirect service
- `apps/web`: React dashboard (Vite)
- `packages/db`: SQL migrations

---

## Node version (required)

Vite 8 needs **Node 20.19+** or **22.12+**. You currently may have 18.x — upgrade with `nvm`:

```bash
nvm install 22
nvm use 22
nvm alias default 22
node -v   # should be v22.x
npm -v
```

From the project folder you can also run:

```bash
nvm install
nvm use
```

(uses `.nvmrc` → Node 22)

Then reinstall deps (required after changing Node major version):

```bash
cd /home/mayur/reduce-my-url
rm -rf node_modules package-lock.json apps/web/node_modules
npm install
```

If `npm run dev -w web` still fails with **Cannot find native binding**, run:

```bash
npm install @rolldown/binding-linux-x64-gnu@1.0.2 -w web
```

---

## Run locally (no Docker) — VS Code + WSL Ubuntu

**Where:** open this folder in VS Code using WSL:

```bash
cd /home/mayur/reduce-my-url
code .
```

Use the **integrated terminal** in VS Code (bottom panel). It should be a **WSL/Ubuntu** shell, not PowerShell.

### 1) Install Postgres + Redis (one time)

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib redis-server
sudo service postgresql start
sudo service redis-server start
```

Check they are running:

```bash
sudo service postgresql status
sudo service redis-server status
redis-cli ping
```

(`PONG` means Redis is OK.)

### 2) Create the database (one time)

Matches `apps/api/.env.example` (`app` / `app` / `shortener`):

```bash
chmod +x scripts/setup-local-db.sh
./scripts/setup-local-db.sh
```

### 3) App config + npm install

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
npm install
```

### 4) Run API and web (two terminals)

**Terminal 1 — API** (port 4000):

```bash
npm run dev -w @reduce-my-url/api
```

Wait until you see: `api listening on http://localhost:4000`

**Terminal 2 — Web** (usually port 5173):

```bash
npm run dev -w web
```

Or in VS Code: **Terminal → Split Terminal** and run one command in each pane.

### 5) Open in browser

| What | URL |
|------|-----|
| API health | http://localhost:4000/health |
| Dashboard | http://localhost:5173 (Vite prints the exact URL) |

### 6) Try it

1. Open the web app → **Register** → **Login**
2. Paste a long URL → **Shorten**
3. Open the short link a few times (e.g. `http://localhost:4000/abc1234`)
4. In the dashboard, click **Analytics** on that link

---

## Optional: Docker instead of local Postgres/Redis

```bash
docker compose up -d
```

Then use the same steps from “App config + npm install” above.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `ECONNREFUSED 127.0.0.1:5432` | Start Postgres: `sudo service postgresql start` |
| `password authentication failed` | Re-run `./scripts/setup-local-db.sh` or fix `DATABASE_URL` in `apps/api/.env` |
| Redis connection errors | `sudo service redis-server start` and `redis-cli ping` |
| `npm` points to `/mnt/c/...` | Use Linux npm: `which npm` should be `/usr/bin/npm` or `~/.nvm/...` |

## Geo IP lookup

By default the API will try to populate geo from request headers (`cf-ipcountry`/`x-country-code`). If those are missing, it will fall back to an offline IP lookup using `geoip-lite` and store `country_code/region/city` in `click_events`.

Configure in `apps/api/.env`:

- `GEO_MODE=geoip-lite` (default)
- `GEO_MODE=naive` (always `UN`)
- `GEO_MODE=off` (disable)

Migrations run automatically when the API starts in development.
