# MeleFlow 🏄

<p align="center">
  <img src="images/MeleFlowIcon.svg" alt="MeleFlow" width="80" height="80">
</p>

![License](https://img.shields.io/badge/license-MIT-blue)
![Stack](https://img.shields.io/badge/stack-React%2019%20%7C%20Fastify%205%20%7C%20PostgreSQL%2016%20%7C%20Redis%207-14B8A6)

Self-hosted task management web app with tasks, lists, tags, habits, Pomodoro timer, admin panel, email reminders, and i18n (EN/ES).

## Stack

- **Backend**: Node.js 20, Fastify 5 (ZodTypeProvider + http-errors), TypeScript, Prisma ORM (PostgreSQL 16), Redis 7, JWT auth
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
POSTGRES_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)

# 3. Create .env file (variables are expanded correctly)
cat > .env << EOF
DOCKER_USER=meleflow
TAG=latest
NGINX_PORT=3001
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DATABASE_URL=postgresql://taskflow:${POSTGRES_PASSWORD}@postgres:5432/taskflow
REDIS_URL=redis://redis:6379
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
ENCRYPTION_KEY=${ENCRYPTION_KEY}
FRONTEND_URL=http://YOUR_SERVER_IP:3001
CORS_ORIGIN=https://YOUR_DOMAIN_OR_IP
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
| `CORS_ORIGIN`          | (vacío = permite cualquier origen)            |

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
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

> Note: The backend starts on port 3000. The Vite dev server proxies `/api` requests to it.
### Running Tests

```bash
cd backend
npx vitest run          # runs all tests (uses isolated taskflow_test DB)
npx vitest              # watch mode
```

Tests run in an isolated `taskflow_test` PostgreSQL database and Redis DB 1, created automatically by `vitest.global.ts`. Your development data is never touched.

## Project Structure

```
  meleflow/
├── backend/
│   └── src/
│       ├── config/          # Env, Prisma, Redis singletons
│       ├── lib/             # http-errors, format helper, email service
│       ├── modules/         # auth, tasks, lists, tags, habits, pomodoro, admin
│       ├── prisma/          # schema.prisma + migrations
│   ├── app.ts           # Fastify factory (ZodTypeProvider, http-errors)
│   ├── server.ts        # Entry point
│   ├── worker.ts        # Cron reminder worker (task + habit reminders)
│   └── vitest.global.ts # Test setup (isolated DB, migrations)
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

## Push Notifications (Android APK)

MeleFlow supports **push notifications** via Firebase Cloud Messaging (FCM) for the Android APK. Notifications arrive even when the app is closed.

### One-time Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com) and create a project
2. Add an **Android app** with package name `com.meleflow.app`
3. Add the **SHA-1 fingerprint** of your debug keystore in Firebase Console (App → "Add fingerprint"):
   ```bash
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA1
   ```
4. Download `google-services.json` and place it at `frontend/android/app/google-services.json`

### Building the APK

```bash
cd frontend
npm install
npx cap sync android
npx vite build
npx cap copy
cd android && ./gradlew assembleDebug
```

The APK is at `android/app/build/outputs/apk/debug/meleflow.apk`.

### Backend: Firebase Admin SDK

For the backend to send push notifications, it needs a **service account key**:

1. In Firebase Console → Project Settings → **Service accounts** → **Generate new private key**
2. Save the downloaded JSON file on your server (e.g., `/opt/meleflow/firebase-key.json`)
3. Mount it as a volume in `docker-compose.yml`:

```yaml
backend:
  volumes:
    - /opt/meleflow/firebase-key.json:/usr/src/app/firebase-key.json:ro
  environment:
    - FIREBASE_SERVICE_ACCOUNT_PATH=/usr/src/app/firebase-key.json

worker:
  volumes:
    - /opt/meleflow/firebase-key.json:/usr/src/app/firebase-key.json:ro
  environment:
    - FIREBASE_SERVICE_ACCOUNT_PATH=/usr/src/app/firebase-key.json
```

4. Restart the services:
```bash
docker compose pull && docker compose up -d
```

> ⚠️ The service account key is **sensitive**. Do not commit it to Git. Use a secure path on your server.

> ⚠️ **Multiple servers?** Each server (NAS casa, NAS trabajo, VPS, etc.) needs its **own copy** of the `firebase-key.json` file. The APK (`google-services.json`) is the same for all, but the **service account key** must be mounted on every backend that sends push notifications. Without it, the API accepts token registrations but push messages fail silently.

### Enabling notifications on an existing installation

| Component | Role |
|-----------|------|
| **APK** | Registers the device FCM token on first launch via `POST /api/notifications/register-token` |
| **Backend** | Stores tokens in the `DeviceToken` table and sends pushes via `firebase-admin` |
| **Worker** | Sends push notifications alongside email when task/habit reminders fire |
| **FCM** | Google's infrastructure delivers the notification to the device |

### Troubleshooting

| Symptom | Check |
|---------|-------|
| **"Test push" returns success but notification doesn't arrive** | `docker compose exec backend env \| grep FIREBASE` — if empty, the service account key is not configured on this server |
| **"Push notifications ready" toast on app startup** | FCM token was received; check `docker compose logs backend \| grep push` for send errors |
| **"Local test (10s)" works but pushes don't** | The `firebase-key.json` is missing or invalid on the backend |
| **Push tokens: 0** | App hasn't registered the token yet; open the app and wait for "Push notifications ready" |

## License

MIT
