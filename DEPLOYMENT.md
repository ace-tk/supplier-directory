# SupplyBase — Oracle Cloud Deployment Guide

This guide covers deploying SupplyBase (Next.js 16 app, PostgreSQL via Prisma) to a single Oracle Cloud VM, fronted by Nginx, running under PM2.

## A. Requirements

- Oracle Cloud VM (any shape with at least 2 vCPU / 4 GB RAM is comfortable for a Next.js app + PM2 + Nginx)
- OS: Ubuntu 22.04 LTS (or any recent Ubuntu/OL8 — commands below assume Ubuntu/apt)
- **Node.js >= 20.9.0** (required by Next.js 16.2.10 — see `engines` in `package.json`)
- npm (ships with Node)
- Git
- PM2 (`npm install -g pm2`)
- Nginx

Install Node 20 LTS via NodeSource, then the rest:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx
sudo npm install -g pm2
node -v   # confirm >= 20.9.0
```

## B. Project Setup

```bash
git clone <your-repo-url> supplybase
cd supplybase
npm install
```

`npm install` automatically runs `prisma generate` via the project's `postinstall` script — you don't need to run it separately after `install`.

## C. Environment Configuration

Copy the example file and fill in real values — **never commit `.env`**:

```bash
cp .env.example .env
nano .env
```

Required variables (all read from `process.env` in the app — see `.env.example` for the authoritative list):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Runtime PostgreSQL connection. If using Supabase, this must be the **Supavisor transaction-mode pooler** URL (typically port `6543`) — see `lib/db.ts`. Session-mode exhausts its small connection budget under concurrent app traffic. |
| `DIRECT_URL` | Direct/session-mode PostgreSQL connection used only by the Prisma CLI (`migrate deploy`, `migrate dev`, `db push`). DDL and advisory locks aren't reliable through a transaction-mode pooler. Falls back to `DATABASE_URL` if unset (`prisma.config.ts`). |
| `JWT_SECRET` | Signs/verifies session cookies (`lib/session.ts`, `proxy.ts`). **Required in production** — the app now throws at startup if it's missing in production rather than silently using the development placeholder (see Security section below). Generate one with `openssl rand -base64 48`. |
| `OPENAI_API_KEY` | Used by the AI features (AI Garment Studio, AI Design Studio, Repeat Print Maker, etc.). |
| `TEAM_SEAT_LIMIT` | Optional. Caps seats per team/workspace. Defaults to `10` if unset (`services/team-management.ts`). |

## D. Database (Prisma) Setup

The project uses Prisma 7 with `prisma.config.ts` pointing migrations at `prisma/migrations/`.

Generate the client (already done by `postinstall`, but safe to re-run):

```bash
npx prisma generate
```

Apply existing migrations to the production database:

```bash
npx prisma migrate deploy
```

**Do not use `npx prisma db push` in production.** `db push` is a schema-sync command meant for prototyping and has no migration history — it can silently diverge from the committed `prisma/migrations/` directory and is not reversible. This project already has migrations, so `migrate deploy` is the correct production command. (`db:push` in `package.json` is a local convenience script for development only, gated behind `.env.local`.)

`DATABASE_URL` vs `DIRECT_URL`: the schema (`prisma/schema.prisma`) declares one `datasource`, but `prisma.config.ts` resolves the CLI's connection to `DIRECT_URL` (falling back to `DATABASE_URL`) because `migrate deploy` needs session-mode Postgres for DDL and advisory locks. The running app, via `lib/db.ts`, always uses `DATABASE_URL` (transaction-mode pooler) for request traffic. Make sure both are set correctly before running migrations or starting the app.

## E. Build

```bash
npm run build
```

This runs `next build` (see `scripts.build` in `package.json`).

## F. Start (production)

```bash
npm run start
```

This runs `next start`, which listens on port **3000** by default (the project sets no custom `PORT` env var or `-p` flag). You can override the port ad hoc with `PORT=4000 npm run start` if 3000 is already in use, and update the Nginx config below to match.

## G. Running with PM2

From the project directory:

```bash
# Start (build first!)
npm run build
pm2 start npm --name supplybase -- run start

# Check status
pm2 status

# Restart after a deploy
pm2 restart supplybase

# View logs
pm2 logs supplybase

# Persist the process list across reboots
pm2 save
pm2 startup    # follow the printed instructions (runs a systemd/init command)
```

## H. Nginx Reverse Proxy

Create `/etc/nginx/sites-available/supplybase`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/supplybase /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Also confirm the Oracle Cloud **security list / network security group** for the VM's subnet allows inbound TCP 80 and 443 (Oracle Cloud blocks these by default at the cloud firewall level, separate from the VM's own `iptables`/`ufw`).

## I. HTTPS

Once `your-domain.com` DNS points at the VM's public IP and Nginx is serving it on port 80:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Certbot edits the Nginx config to add the SSL block and sets up auto-renewal (`certbot renew` via a systemd timer/cron it installs).

## J. Verification Checklist

After deploying, confirm:

- [ ] App loads at `https://your-domain.com`
- [ ] Login works (session cookie `sb_session` is set, protected routes redirect correctly per `proxy.ts`)
- [ ] Database connection works (any page that reads data, e.g. dashboard, loads without error)
- [ ] Prisma works (`npx prisma migrate deploy` completed with no errors; check `pm2 logs supplybase` for Prisma connection errors on boot)
- [ ] AI features can reach OpenAI (test one AI flow — e.g. AI Garment Studio or Design Studio — and check for `OPENAI_API_KEY` errors in `pm2 logs supplybase`)
- [ ] Uploads work (test the supplier portal upload flow; a file should appear under `public/uploads/portal/` on the VM and be reachable at `/uploads/portal/<filename>`)
- [ ] Team management works (invite/seat flows under the team settings pages)
- [ ] Invoices work (create/view an invoice under `/supplier/invoices`)
- [ ] Admin panel works (settings pages under the admin/settings routes)

## K. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Site unreachable from the internet | Oracle Cloud security list/NSG not allowing 80/443 inbound, or the VM's own firewall (`ufw`/`iptables`) blocking it. Check both layers. |
| 502 Bad Gateway from Nginx | The Node process isn't running or isn't listening on the port Nginx proxies to. Check `pm2 status` and `pm2 logs supplybase`. |
| App crashes on boot with a `JWT_SECRET` error | `JWT_SECRET` isn't set in `.env` / the process environment. The app now refuses to start in production without it rather than silently using a known placeholder — set it and restart. |
| "environment variable not found" errors from Prisma | `.env` is missing or `DATABASE_URL`/`DIRECT_URL` aren't set. PM2 needs the process to actually load `.env` — verify with `pm2 env <id>` that the vars are present, or load them via your process manager rather than relying on shell state. |
| Database connection failures under load | `DATABASE_URL` is pointed at session-mode (port 5432) instead of the Supavisor transaction-mode pooler (typically 6543), exhausting the small connection budget `lib/db.ts` is built around. |
| `prisma migrate deploy` fails | Check `DIRECT_URL` is a session-capable connection (not a transaction-mode pooler) — DDL and advisory locks used by migrations aren't reliable through transaction pooling. |
| Node version errors on install/build | Confirm `node -v` is >= 20.9.0 (`package.json` now declares this in `engines`). Reinstall Node via NodeSource if it's older. |
| PM2 process shows `stopped` or keeps restarting | `pm2 logs supplybase` for the crash reason — usually a missing env var or a failed build. Rebuild (`npm run build`) before `pm2 restart`. |
| Nginx config errors | `sudo nginx -t` validates syntax before reloading; check `server_name` matches your actual domain and `proxy_pass` matches the port `next start` is actually listening on. |
| Permission errors writing uploads | Ensure the OS user running the PM2 process owns/can write to `public/uploads/portal/` (created automatically on first upload via `mkdir -p`, but the parent directory must be writable). |

## Architecture Notes (do not change without reason)

- **Uploads are stored on local disk** at `public/uploads/portal/` (`app/api/supplier-portal/upload/route.ts`), served directly by Next.js as static files. This is fine for a single persistent Oracle VM (unlike serverless/multi-instance platforms, the filesystem persists between requests). Do **not** delete this directory during redeploys, and include it in your backup strategy if uploaded files matter — moving to object storage (e.g. OCI Object Storage) is a possible future improvement but is out of scope for this deployment and not currently implemented.
- **Database**: Prisma 7 + `pg` + `@prisma/adapter-pg`, built around a Supabase/Supavisor-style pooler split between `DATABASE_URL` (transaction mode, runtime) and `DIRECT_URL` (session mode, CLI/migrations). See `lib/db.ts` and `prisma.config.ts` for the reasoning in code comments.
- **Auth**: JWT session cookies signed with `JWT_SECRET` via `jose`, checked in `proxy.ts` (Next's middleware-equivalent in this codebase) and `lib/session.ts`. The signing secret is now centralized in `lib/auth-secret.ts`, which throws on boot if `JWT_SECRET` is missing in production.
