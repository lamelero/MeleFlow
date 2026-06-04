# MeleFlow 🏄

![License](https://img.shields.io/badge/license-MIT-blue)
![Stack](https://img.shields.io/badge/stack-React%2019%20%7C%20Fastify%205%20%7C%20PostgreSQL%2016%20%7C%20Redis%207-14B8A6)

Self-hosted task management web app with tasks, lists, tags, habits, Pomodoro timer, admin panel, email reminders, and i18n (EN/ES).

## Stack

- **Backend**: Node.js 20, Fastify 5, TypeScript, Prisma ORM (PostgreSQL 16), Redis 7, JWT auth
- **Frontend**: React 19, Vite, Tailwind CSS v4, Zustand, react-router-dom, i18next
- **Infra**: Docker Compose (PostgreSQL, Redis, Backend, Frontend, Worker, Nginx)

## Prerequisites

- Docker + Docker Compose (with Compose V2)

## Quick Start

```bash
# 1. Clone and enter the project
git clone <repo> meleflow && cd meleflow

# 2. Copy environment (defaults work out of the box)
cp .env.example .env

# 3. Launch everything
docker compose up --build -d

# 4. Apply database schema
docker compose exec backend npx prisma db push

# The first user to register via the UI is automatically promoted to ADMIN.
# No manual SQL needed.
docker compose logs -f
```

The app is at **http://localhost:3001**.

## Production Deployment

```bash
# 1. Clone the repo on your server
git clone <repo> meleflow && cd meleflow

# 2. Generate unique secrets
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)

# 3. Create .env file
cat > .env << EOF
DOCKER_USER=meleflow
TAG=latest
NGINX_PORT=3001
DATABASE_URL=postgresql://taskflow:taskflow@postgres:5432/taskflow
REDIS_URL=redis://redis:6379
POSTGRES_PASSWORD=taskflow
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
ENCRYPTION_KEY=$ENCRYPTION_KEY
FRONTEND_URL=http://YOUR_SERVER_IP:3001
ALLOW_REGISTRATION=true
MAX_UPLOAD_SIZE=50
EOF

# 4. Pull images (no build needed — images are on Docker Hub)
docker compose -f docker-compose.prod.yml --env-file .env pull

# 5. Launch everything
docker compose -f docker-compose.prod.yml --env-file .env up -d

# 6. Watch logs
docker compose -f docker-compose.prod.yml logs -f
```

> **Note:** Replace `YOUR_SERVER_IP` with your server's IP or domain. All secrets are auto-generated — no manual editing needed.

### Synology NAS specifics

On Synology DSM, Docker is installed as **Container Manager**. The docker and docker-compose binaries are located at `/var/packages/ContainerManager/target/usr/bin/`. You may need to use the full path or `sudo` depending on your user permissions.

```bash
# On Synology with sudo
sudo /var/packages/ContainerManager/target/usr/bin/docker compose \
  -f /path/to/docker-compose.prod.yml --env-file /path/to/.env up -d
```

### Firewall

If containers can't reach each other (e.g. `postgres:5432` unreachable), temporarily disable the Synology firewall or add a rule for the Docker bridge network:

```bash
# Disable firewall (temporary debug)
synofirewall --disable
```

For a permanent setup, create an allow rule from the Docker bridge subnet (`172.x.0.0/16`) to the NAS IP on the required ports.

| Service     | Internal URL                    |
|-------------|---------------------------------|
| Frontend    | http://localhost:3001            |
| Backend API | http://localhost:3001/api        |
| Nginx       | `127.0.0.1:3001` (localhost only) |
| PostgreSQL  | `postgres:5432` (Docker network only) |
| Redis       | `redis:6379` (Docker network only) |

## Custom Port

By default Nginx listens on `127.0.0.1:3001` (localhost only, to avoid conflict with Synology DSM on ports 80/443). To change the port:

1. Edit `docker-compose.yml` → `nginx.ports`:
   ```yaml
   ports:
     - "127.0.0.1:8080:80"   # replace 3001 with your port
   ```
2. If you also want to change the port inside the container, edit `nginx/nginx.conf`:
   ```nginx
   listen 8080;
   ```
   Then update the compose `ports:` to match (e.g. `"3001:8080"`).

Apply with:
```bash
docker compose up -d nginx
```

## Environment Variables

See `.env.example` for defaults:

| Variable              | Default                                        |
|-----------------------|------------------------------------------------|
| `DATABASE_URL`        | `postgresql://taskflow:taskflow@postgres:5432/taskflow` |
| `REDIS_URL`           | `redis://redis:6379`                           |
| `JWT_SECRET`          | (random, change in production)                 |
| `JWT_REFRESH_SECRET`  | (random, change in production)                 |
| `JWT_ACCESS_EXPIRES_IN` | `15m`                                        |
| `JWT_REFRESH_EXPIRES_IN` | `7d`                                        |
| `ENCRYPTION_KEY`      | (32-char key for AES-256)                      |
| `NODE_ENV`            | `development`                                  |
| `PORT`                | `3000`                                         |
| `HOST`                | `0.0.0.0`                                      |
| `FRONTEND_URL`        | `http://localhost:5173`                        |
| `ALLOW_REGISTRATION`  | `true`                                         |
| `MAX_UPLOAD_SIZE`     | `50` (MB)                                      |
| `MAX_LOGIN_ATTEMPTS`  | `5`                                            |
| `LOGIN_LOCKOUT_MINUTES` | `15`                                         |

## Features

- **Tasks** — Full CRUD with subtasks, due dates, attachments, tags, checklists, Markdown descriptions
- **Lists** — Organize tasks into named lists with colors
- **Tags** — Categorize tasks with custom tags and colors
- **Habits** — Track daily/weekly habits with categories, priority, frequency, streaks, and a visual calendar
- **Pomodoro Timer** — Built-in focus timer with start/pause/resume/complete
- **Email Reminders** — Cron worker sends task and habit reminders via SMTP (configurable from admin panel)
- **Two-Factor Auth (2FA)** — TOTP-based 2FA with recovery codes
- **Admin Panel** — User management, system settings, SMTP config, logo upload, security logs
- **i18n** — English and Spanish interface
- **Dark Mode** — Full dark mode support

## API Endpoints

### Auth
- `POST /api/auth/register` — `{ email, username, password }` → `{ accessToken, refreshToken, user }`
- `POST /api/auth/login` — `{ email, password, rememberMe? }` → `{ accessToken, refreshToken, user }`
- `POST /api/auth/refresh` — `{ rememberMe? }` (reads httpOnly cookie) → `{ accessToken, user }`
- `POST /api/auth/logout` — Clears refresh token
- `GET /api/auth/me` — Returns current user
- `PATCH /api/auth/language` — `{ language }` → updates user language preference
- `PATCH /api/auth/profile` — `{ displayName?, notificationEmail?, bio?, timezone? }`
- `POST /api/auth/avatar` — Multipart file upload
- `POST /api/auth/verify-2fa` — `{ twoFactorToken, code }` → `{ accessToken, user }`
- `POST /api/auth/2fa/setup` — Initiates 2FA setup (returns QR code)
- `POST /api/auth/2fa/verify` — `{ code }` → enables 2FA
- `POST /api/auth/2fa/disable` — `{ password }` → disables 2FA
- `POST /api/auth/2fa/recovery-codes` — `{ password }` → generates new recovery codes

### Tasks
- `GET /api/tasks` — Query params: `listId`, `status` (pending/completed), `search`
- `POST /api/tasks` — `{ title, description?, priority?, dueDate?, rrule?, listId? }`
- `PATCH /api/tasks/:id` — Partial update (supports `parentId` for subtasks)
- `DELETE /api/tasks/:id` — Cascading delete (subtasks, task-tag relations)
- `POST /api/tasks/:id/tags/:tagId` — Add tag to task
- `DELETE /api/tasks/:id/tags/:tagId` — Remove tag from task

### Lists
- `GET /api/lists` — Returns lists with task count (`_count.tasks`)
- `POST /api/lists` — `{ name, color? }` (unique per user)
- `PATCH /api/lists/:id` — Partial update
- `DELETE /api/lists/:id`

### Tags
- `GET /api/tags` — Returns tags with usage count
- `POST /api/tags` — `{ name, color? }`
- `PATCH /api/tags/:id` — `{ name?, color? }`
- `DELETE /api/tags/:id`

### Habits
- `GET /api/habits` — Returns habits with `streakCount`
- `GET /api/habits/:id` — Single habit with logs
- `POST /api/habits` — `{ name, category, priority?, frequency?, startDate?, endDate?, description? }`
- `PATCH /api/habits/:id` — Partial update (supports all create fields + `isArchived`)
- `DELETE /api/habits/:id` — Deletes habit and its logs
- `POST /api/habits/:id/progress` — `?date=YYYY-MM-DD` (defaults to today). Check in
- `DELETE /api/habits/:id/progress` — `?date=YYYY-MM-DD`. Undo check-in
- `POST /api/habits/:id/reset` — Resets all progress (logs + streak)

### Pomodoro
- `GET /api/pomodoro/current` — Current active session (if any)
- `POST /api/pomodoro/start` — `{ durationMinutes? }` (default 25, cancels any previous session)
- `POST /api/pomodoro/pause`
- `POST /api/pomodoro/resume`
- `POST /api/pomodoro/complete`

### Admin (requires ADMIN role)
- `GET /api/admin/stats` — Global statistics (users, tasks, completion rate, etc.)
- `GET /api/admin/users` — All users with task/list/habit counts
- `PUT /api/admin/users/:id` — Update `{ role?, isActive? }` (self-role-change blocked)
- `GET /api/admin/settings` — Current system settings
- `PATCH /api/admin/settings` — Update settings (SMTP, registration, upload limits, etc.)
- `POST /api/admin/test-email` — `{ to? }` sends test email (defaults to your email)
- `GET /api/admin/security-logs` — Paginated security audit log
- `POST /api/admin/logo` — Multipart logo upload (PNG/SVG, max 2MB)
- `DELETE /api/admin/logo` — Remove logo

## Making yourself Admin

The first user to register via the UI is automatically promoted to ADMIN.
If you need to promote additional users later:

```bash
# After registering via the UI, promote via direct DB:
docker compose exec postgres psql -U taskflow -d taskflow -c \
  "UPDATE \"User\" SET role = 'ADMIN' WHERE email = 'your@email.com';"
```

Then log out and back in, or re-login to get a new JWT.

## Development

### Without Docker

```bash
# Backend
cd backend
npm install
cp ../.env .env
npx prisma db push
npx vitest
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

### Running Tests

```bash
cd backend
DATABASE_URL=postgresql://taskflow:taskflow@localhost:5432/taskflow \
REDIS_URL=redis://localhost:6379 \
JWT_SECRET=test-secret JWT_REFRESH_SECRET=test-refresh \
npx vitest run
```

## Project Structure

```
  meleflow/
├── backend/
│   └── src/
│       ├── config/          # Env, Prisma, Redis singletons
│       ├── lib/             # AppError, format helper, email service
│       ├── modules/         # auth, tasks, lists, tags, habits, pomodoro, admin
│       ├── prisma/          # schema.prisma + migrations
│       ├── app.ts           # Fastify factory
│       ├── server.ts        # Entry point
│       └── worker.ts        # Cron reminder worker (task + habit reminders)
├── frontend/
│   └── src/
│       ├── api/             # Axios client with 401 interceptor
│       ├── components/      # Reusable UI components
│       ├── lib/             # Utilities, habit categories, i18n config
│       ├── store/           # Zustand stores
│       └── views/           # Page-level views (auth, app)
├── nginx/
│   └── nginx.conf           # Reverse proxy config
├── docker-compose.yml
└── .env.example
```

## i18n

MeleFlow supports English and Spanish. Language can be changed from the profile page or the user menu. Your preference is persisted to the database.

## Email Configuration

SMTP settings are configurable from the admin panel under "Email Configuration". Once configured and enabled, the worker sends task and habit reminder emails. You can also send a test email from the admin panel to verify your setup.

## License

MIT
