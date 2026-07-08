# MeleFlow 🏄

<p align="center">
  <img src="images/MeleFlowIcon.svg" alt="MeleFlow" width="80" height="80">
</p>

![License](https://img.shields.io/badge/license-MIT-blue)
![Stack](https://img.shields.io/badge/stack-React%2019%20%7C%20Fastify%205%20%7C%20PostgreSQL%2016%20%7C%20Redis%207-14B8A6)

Self-hosted task management web app with tasks, lists, tags, habits, Pomodoro timer, ICS calendar feeds, Kanban/Eisenhower views, NLP input, admin panel, push notifications (FCM + browser + email), and i18n (EN/ES).

## Screenshots

<p align="center">
  <img src="screenshots/MainLiight.png" alt="Dashboard Light" width="45%" />
  <img src="screenshots/MainDark.png" alt="Dashboard Dark" width="45%" />
</p>
<p align="center">
  <img src="screenshots/admin.png" alt="Admin Panel" width="45%" />
  <img src="screenshots/NewHabit.png" alt="New Habit" width="45%" />
</p>
<p align="center">
  <img src="screenshots/Menu.png" alt="Navigation Menu" width="45%" />
  <img src="screenshots/2FA.png" alt="Two-Factor Auth" width="45%" />
</p>

## Features

- **Tasks** — Full CRUD with subtasks, due dates, attachments, tags, checklists, Markdown descriptions, status (todo/in_progress/completed), priority levels, NLP input ("buy milk tomorrow at 3pm #groceries")
- **Lists** — Organize tasks into named lists with colors and icons
- **Tags** — Categorize tasks with custom tags and colors
- **Smart Filters** — Quick filter chips: Today, Next 7 days, Overdue, No date
- **Views** — List, Kanban (drag & drop columns), Eisenhower Matrix (2×2 by priority), Agenda (by date with time grouping)
- **Global Search** — Search across tasks and ICS events from the calendar toolbar
- **Habits** — Track daily/weekly habits with categories, frequency, streaks, 3-state system (completed/skipped/failed), and visual calendar
- **Habit Categories** — Customizable categories with icons and colors, editable via CategoryManager
- **Pomodoro Timer** — Built-in focus timer with work/break intervals and session history
- **ICS Calendar Feeds** — Import external calendars via URL, auto-sync every 15 min, event notifications
- **Notifications** — Email (SMTP), Push (FCM for Android APK), Browser (Web Notification API). Configurable per type in Profile
- **Two-Factor Auth (2FA)** — TOTP-based 2FA with recovery codes and trusted devices
- **Admin Panel** — User management, system settings, SMTP config, logo upload, security logs, backups (create/download/restore/upload)
- **Update Checker** — Checks GitHub releases for new APK versions; direct APK download from the banner
- **Keyboard Shortcuts** — N (new task), 1-4 (navigate views)
- **i18n** — English and Spanish interface
- **Dark Mode** — Full dark mode support with theme-aware status bar
- **Responsive** — Mobile-first with bottom tab bar, landscape right nav bar, collapsible sidebar on web
- **Statistics** — Bar charts for tasks completed and habit rates (weekly/monthly)

## Stack

- **Backend**: Node.js 20, Fastify 5 (ZodTypeProvider + http-errors + sensible), TypeScript, Prisma ORM (PostgreSQL 16), Redis 7, JWT auth, firebase-admin (FCM)
- **Frontend**: React 19, Vite, Tailwind CSS v4, Zustand, react-router-dom, i18next, framer-motion, lucide-react
- **Infra**: Docker Compose (PostgreSQL, Redis, Backend, Worker, Frontend/Nginx)
- **Mobile**: Capacitor v7 Android APK (FCM push, local notifications, Preferences)

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
docker compose exec backend npx prisma migrate deploy

# The first user to register via the UI is automatically promoted to ADMIN.
# No manual SQL needed.
docker compose logs -f
```

The app is at **http://localhost:3001**.

## Production Deployment (fresh install)

You only need a server with Docker installed. **No need to compile anything.**

### Step by step

```bash
# 1. Create a folder for MeleFlow
mkdir -p ~/meleflow && cd ~/meleflow

# 2. Download the docker-compose file
curl -L -o docker-compose.yml \
  "https://raw.githubusercontent.com/lamelero/MeleFlow/main/docker-compose.prod.yml"

# 3. Generate secure random passwords
POSTGRES_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)

# 4. Create the data folders
mkdir -p uploads backups
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
CORS_ORIGIN=http://YOUR_SERVER_IP:3001
ALLOW_REGISTRATION=true
MAX_UPLOAD_SIZE=50
EOF

# 5. Pull the Docker images from Docker Hub
docker compose pull

# 6. Start MeleFlow
docker compose up -d

# 7. Check it's running
curl -s http://localhost:3001/api/health
# → {"status":"ok","timestamp":"..."}
```

> ⚠️ **Before step 4:** replace `YOUR_SERVER_IP` with your server's IP or domain (e.g. `http://192.168.1.100:3001` or `https://meleflow.tudominio.com`).

---

### After installing

- Open `http://YOUR_SERVER_IP:3001` in your browser
- Create an account — **the first user becomes admin automatically**
- Start using MeleFlow!

To change the port, edit `NGINX_PORT` in `.env` before starting, then run `docker compose up -d` again.

To see the logs:

```bash
docker compose logs -f
```

To stop:

```bash
docker compose down
```

---

### Synology NAS specifics

On Synology DSM, Docker is called **Container Manager**. The `docker` and `docker compose` commands may not be in the default PATH. The easiest way to install is:

```bash
# 1. Connect to your NAS via SSH (admin user)
ssh admin@YOUR_NAS_IP

# 2. Get a root shell (this adds docker to the PATH automatically)
sudo -i

# 3. Follow the steps above (create folder, download compose, etc.)
mkdir -p ~/meleflow && cd ~/meleflow
curl -L -o docker-compose.yml \
  "https://raw.githubusercontent.com/lamelero/MeleFlow/main/docker-compose.prod.yml"
# ... continue with step 3 (generate secrets) ...
```

> 💡 Using `sudo -i` gives you a root shell where `docker compose` works without specifying the full path. If you prefer not to use root, the binaries are at `/var/packages/ContainerManager/target/usr/bin/docker`.

#### Firewall

On Synology, if containers can't reach each other (e.g. `postgres:5432` unreachable), temporarily disable the firewall or add a rule for the Docker bridge network:

```bash
# Disable firewall (temporary debug)
synofirewall --disable
```

| Service     | Internal URL                    |
|-------------|---------------------------------|
| Frontend    | http://localhost:3001            |
| Backend API | http://localhost:3001/api        |
| Nginx       | `127.0.0.1:3001` (localhost only) |
| PostgreSQL  | `postgres:5432` (Docker network only) |
| Redis       | `redis:6379` (Docker network only) |

## Docker Hub Images

Pre-built images are available on Docker Hub:

| Image | Tags |
|-------|------|
| `meleflow/meleflow-backend` | `latest` |
| `meleflow/meleflow-frontend` | `latest` |

## Custom Port

By default Nginx listens on `127.0.0.1:3001` (localhost only). To change the port, edit the `NGINX_PORT` env variable.

## Environment Variables

See `.env.example` for defaults:

| Variable                    | Default                                        |
|-----------------------------|------------------------------------------------|
| `DATABASE_URL`              | `postgresql://taskflow:taskflow@postgres:5432/taskflow` |
| `REDIS_URL`                 | `redis://redis:6379`                           |
| `JWT_SECRET`                | (random, change in production)                 |
| `JWT_REFRESH_SECRET`        | (random, change in production)                 |
| `JWT_ACCESS_EXPIRES_IN`     | `15m`                                          |
| `JWT_REFRESH_EXPIRES_IN`    | `7d`                                           |
| `ENCRYPTION_KEY`            | (32-char key for AES-256)                      |
| `NODE_ENV`                  | `development`                                  |
| `PORT`                      | `3000`                                         |
| `HOST`                      | `0.0.0.0`                                      |
| `FRONTEND_URL`              | `http://localhost:5173`                        |
| `CORS_ORIGIN`               | (empty = allows Capacitor APK + localhost)     |
| `FORCE_SECURE`              | (set `true` behind HTTPS reverse proxy)        |
| `ALLOW_REGISTRATION`        | `true`                                         |
| `MAX_UPLOAD_SIZE`           | `50` (MB)                                      |
| `MAX_LOGIN_ATTEMPTS`        | `5`                                            |
| `LOGIN_LOCKOUT_MINUTES`     | `15`                                           |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | (path to firebase-key.json for push notifications) |

## Backups

Backups are managed from the admin panel: **Settings → Backup**.

- **Create** — exports all database tables (users, tasks, habits, lists, tags, ICS calendars, events, habit categories, etc.) and uploaded files (attachments, avatars, logos) into a compressed archive
- **List / Download** — browse existing backups and download them
- **Restore** — restore from an existing backup or upload a backup file
- **Encryption** — optional AES-256 encryption using the `ENCRYPTION_KEY`

For persistence across container restarts, the `docker-compose.yml` mounts the backups directory:

```yaml
volumes:
  - ./backend/backups:/usr/src/app/backups
```

## API Endpoints

### Auth
- `POST /api/auth/register` — `{ email, username, password }` → `{ accessToken, refreshToken, user }`
- `POST /api/auth/login` — `{ email, password, rememberMe? }` → `{ accessToken, refreshToken, user }`
- `POST /api/auth/verify-2fa` — `{ twoFactorToken, code, trustDevice? }`
- `POST /api/auth/refresh` — `{ refreshToken? }` → `{ accessToken, refreshToken, user }`
- `POST /api/auth/logout` — Clears refresh token
- `GET /api/auth/me` — Returns current user
- `PATCH /api/auth/language` — `{ language }`
- `PATCH /api/auth/profile` — `{ displayName?, notificationEmail?, bio?, timezone? }`
- `POST /api/auth/avatar` — Multipart file upload
- `GET /api/auth/notification-prefs` — `{ email, push, browser }`
- `PATCH /api/auth/notification-prefs` — `{ email?, push?, browser? }`
- `GET /api/auth/users/search?q=` — Search users by email/username
- `GET /api/auth/2fa/status` — Current 2FA configuration
- `POST /api/auth/2fa/setup` — Initiate 2FA (returns QR code)
- `POST /api/auth/2fa/enable` — `{ code }`
- `POST /api/auth/2fa/disable` — `{ password }`
- `POST /api/auth/2fa/recovery-codes` — `{ password }`
- `POST /api/auth/2fa/send-otp` — `{ twoFactorToken }`

### Tasks
- `GET /api/tasks?listId=&status=&status=in_progress` — Filter by list, status
- `GET /api/tasks/search?q=` — Full-text search across tasks
- `POST /api/tasks` — `{ title, description?, priority?, dueDate?, rrule?, listId?, status?, parentId? }`
- `PATCH /api/tasks/:id` — Partial update
- `DELETE /api/tasks/:id` — Cascading delete
- `POST /api/tasks/:id/tags/:tagId` — Add tag
- `DELETE /api/tasks/:id/tags/:tagId` — Remove tag
- `POST /api/tasks/:id/collaborators/:collaboratorId` — Add collaborator
- `DELETE /api/tasks/:id/collaborators/:collaboratorId` — Remove collaborator
- `POST /api/tasks/:id/attachments` — Upload attachment (with MIME validation)
- `DELETE /api/tasks/:id/attachments/:attachmentId` — Delete attachment

### Lists
- `GET /api/lists` — With `_count.tasks`
- `POST /api/lists` — `{ name, color?, icon? }`
- `PATCH /api/lists/:id` — Partial update
- `DELETE /api/lists/:id`

### Tags
- `GET /api/tags` — With usage count
- `POST /api/tags` — `{ name, color? }`
- `PATCH /api/tags/:id` — `{ name?, color? }`
- `DELETE /api/tags/:id`

### Habits
- `GET /api/habits` — With `streakCount`
- `GET /api/habits/:id` — Single habit with logs
- `POST /api/habits` — `{ name, categoryId?, frequency?, startDate?, endDate?, description? }`
- `PATCH /api/habits/:id`
- `DELETE /api/habits/:id`
- `POST /api/habits/:id/progress?date=YYYY-MM-DD` — Check in (with status: completed/skipped/failed)
- `DELETE /api/habits/:id/progress?date=YYYY-MM-DD` — Undo
- `POST /api/habits/:id/reset` — Reset all progress

### Habit Categories
- `GET /api/habit-categories`
- `POST /api/habit-categories` — `{ name, icon?, color? }`
- `PATCH /api/habit-categories/:id`
- `DELETE /api/habit-categories/:id`

### Pomodoro
- `GET /api/pomodoro/current` — Current active session
- `GET /api/pomodoro/settings` — User settings
- `PATCH /api/pomodoro/settings` — Update settings
- `GET /api/pomodoro/stats` — Today's stats
- `POST /api/pomodoro/start` — `{ durationMinutes? }`
- `POST /api/pomodoro/pause`
- `POST /api/pomodoro/resume`
- `POST /api/pomodoro/complete`
- `POST /api/pomodoro/cancel`

### ICS Calendars
- `GET /api/ics-calendars` — User's feeds
- `GET /api/ics-calendars/search?q=` — Search events
- `POST /api/ics-calendars` — `{ name, url, color?, reminderBefore?, allDayReminderTime? }`
- `PATCH /api/ics-calendars/:id`
- `DELETE /api/ics-calendars/:id`
- `POST /api/ics-calendars/:id/sync` — Force re-sync
- `GET /api/ics-calendars/:id/events` — Cached events

### Notifications
- `POST /api/notifications/register-token` — `{ token, platform? }` (FCM)
- `POST /api/notifications/unregister-token` — `{ token }`

### Settings (public)
- `GET /api/settings/logo` — Logo URLs (light/dark)
- `GET /api/settings/registration-status` — `{ allowRegistration }`

### Admin (requires ADMIN role)
- `GET /api/admin/users` — All users
- `PUT /api/admin/users/:id` — `{ role?, isActive?, storageQuota? }`
- `DELETE /api/admin/users/:id`
- `GET /api/admin/stats` — Global statistics
- `GET /api/admin/settings` — System settings
- `PATCH /api/admin/settings` — Update settings (SMTP, registration, upload limits, etc.)
- `POST /api/admin/test-email` — `{ to? }`
- `GET /api/admin/security-logs?limit=&offset=`
- `POST /api/admin/logo?variant=light|dark` — Multipart (PNG/SVG, max 2MB)
- `DELETE /api/admin/logo?variant=light|dark`
- `GET /api/admin/backup-settings`
- `PATCH /api/admin/backup-settings` — Backup interval, retention, encryption
- `POST /api/admin/backup` — `{ encrypted? }` → Create backup
- `GET /api/admin/backups` — List backups
- `GET /api/admin/backups/:name/download` — Download backup
- `DELETE /api/admin/backups/:name` — Delete backup
- `POST /api/admin/restore/:name` — Restore from disk
- `POST /api/admin/restore` — Restore from uploaded file
- `POST /api/admin/wipe` — `{ password }` — Wipe all data
- `GET /api/admin/security-logs` — Paginated security audit log

## Making yourself Admin

The first user to register via the UI is automatically promoted to ADMIN.
If you need to promote additional users later:

```bash
docker compose exec postgres psql -U taskflow -d taskflow -c \
  "UPDATE \"User\" SET role = 'ADMIN' WHERE email = 'your@email.com';"
```

Then log out and back in.

## Development

### Without Docker

```bash
# Backend
cd backend
npm install
cp ../.env .env
npx prisma migrate deploy
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

> The backend starts on port 3000. The Vite dev server proxies `/api` requests to it.

### Running Tests

```bash
cd backend
npx vitest run          # runs all tests (uses isolated taskflow_test DB)
npx vitest              # watch mode
```

Tests run in an isolated `taskflow_test` PostgreSQL database, created automatically by `vitest.global.ts`. Your development data is never touched.

## Project Structure

```
meleflow/
├── backend/
│   └── src/
│       ├── config/          # Env, Prisma, Redis singletons
│       ├── lib/             # http-errors, format helper, email service, file validator
│       ├── modules/         # auth, tasks, lists, tags, habits, habit-categories,
│       │                    # pomodoro, notifications, admin, ics-calendars, settings
│       ├── prisma/          # schema.prisma + migrations
│       ├── utils/           # file-validator
│       ├── app.ts           # Fastify factory (ZodTypeProvider, http-errors)
│       ├── server.ts        # Entry point
│       ├── worker.ts        # Cron reminder worker
│       └── vitest.global.ts # Test setup (isolated DB, migrations)
├── frontend/
│   └── src/
│       ├── api/             # Axios client with 401 interceptor
│       ├── capacitor/       # Native plugins (push, local notifications, register)
│       ├── components/      # Reusable UI (AppLayout, UpdateBanner, EmptyState, Skeletons, etc.)
│       ├── lib/             # Utilities, NLP parser, i18n, update checker, date utils
│       ├── store/           # Zustand stores (tasks, habits, auth, pomodoro, etc.)
│       └── views/           # Page-level views (auth, app)
├── nginx/
│   └── nginx.conf           # Reverse proxy config (prod)
├── docker-compose.yml       # Development stack
├── docker-compose.prod.yml  # Production stack
└── .env.example
```

## i18n

MeleFlow supports English and Spanish. Language can be changed from the profile page or the user menu. Your preference is persisted to the database.

## Email Configuration

SMTP settings are configurable from the admin panel under "Email Configuration". Once configured and enabled, the worker sends task and habit reminder emails. You can also send a test email from the admin panel to verify your setup.

## Push Notifications (Android APK)

MeleFlow supports **push notifications** via Firebase Cloud Messaging (FCM) for the Android APK, plus **browser notifications** (Web Notification API) for the web version. Notification preferences (email/push/browser) are configurable per user in Profile → General.

### One-time Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com) and create a project
2. Add an **Android app** with package name `com.meleflow.app`
3. Add the **SHA-1 fingerprint** of your debug keystore:
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
npx cap copy android
cd android

# Normal flavor (com.meleflow.app)
./gradlew assembleNormalDebug

# Trabajo flavor (com.meleflow.app.trabajo)
./gradlew assembleTrabajoDebug
```

APK outputs:
- `android/app/build/outputs/apk/normal/debug/meleflow-normal.apk` → renamed as `meleflow-v1.1.0.apk`
- `android/app/build/outputs/apk/trabajo/debug/meleflow-trabajo.apk`

### Backend: Firebase Admin SDK

For the backend to send push notifications, it needs a **service account key**:

1. In Firebase Console → Project Settings → **Service accounts** → **Generate new private key**
2. Save the downloaded JSON file on your server (e.g., `/opt/meleflow/firebase-key.json`)
3. Mount it as a volume:

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

4. Restart:
```bash
docker compose pull && docker compose up -d
```

> ⚠️ **Multiple servers?** Each NAS/VPS needs its own `firebase-key.json`. The APK (`google-services.json`) is universal.

### Update Checker

The app checks GitHub releases for new APK versions (cached for 24h). When a new version is detected, an amber banner appears with **Download** (direct APK download) and **Skip** options. Cached update data is automatically invalidated when the app version changes.

### Troubleshooting

| Symptom | Check |
|---------|-------|
| **"Test push" returns success but notification doesn't arrive** | `docker compose exec backend env \| grep FIREBASE` — if empty, service account key not configured |
| **"Push notifications ready" toast on startup** | FCM token received; check `docker compose logs backend \| grep push` for send errors |
| **Push tokens: 0** | App hasn't registered the token yet; open the app and wait |

## License

MIT
