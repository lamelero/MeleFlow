# MeleNotes

Self-hosted task management web app with full CRUD tasks, lists, tags, habits, Pomodoro timer, and an admin panel.

## Stack

- **Backend**: Node.js 20, Fastify 5, TypeScript, Prisma ORM (PostgreSQL 16), Redis 7, JWT auth
- **Frontend**: React 19, Vite, Tailwind CSS v4, Zustand, react-router-dom
- **Infra**: Docker Compose (PostgreSQL, Redis, Backend, Frontend, Worker, Nginx)

## Prerequisites

- Docker + Docker Compose (with Compose V2)

## Quick Start

```bash
# 1. Clone and enter the project
git clone <repo> taskflow && cd taskflow

# 2. Copy environment (defaults work out of the box)
cp .env.example .env

# 3. Launch everything
docker compose up --build -d

# 4. Apply database schema
docker compose exec backend npx prisma db push
# Seed an admin user (optional — register first user normally, then promote)
```

The app is at **http://localhost**.

| Service     | Internal URL                   |
|-------------|--------------------------------|
| Frontend    | http://localhost (port 80)     |
| Backend API | http://localhost/api           |
| PostgreSQL  | localhost:5432                 |
| Redis       | localhost:6379                 |

## Environment Variables

See `.env.example` for defaults:

| Variable              | Default                                        |
|-----------------------|------------------------------------------------|
| `DATABASE_URL`        | `postgresql://taskflow:taskflow@postgres:5432/taskflow` |
| `REDIS_URL`           | `redis://redis:6379`                           |
| `JWT_SECRET`          | (random, change in production)                 |
| `JWT_REFRESH_SECRET`  | (random, change in production)                 |

## API Endpoints

### Auth
- `POST /api/auth/register` — `{ email, username, password }` → `{ accessToken, refreshToken, user }`
- `POST /api/auth/login` — `{ email, password }` → `{ accessToken, refreshToken, user }`
- `POST /api/auth/refresh` — `{ refreshToken }` → `{ accessToken, refreshToken }`
- `POST /api/auth/logout` — `{ refreshToken }`
- `GET /api/auth/me` — Returns current user

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
- `POST /api/habits` — `{ name }`
- `POST /api/habits/:id/check-in` — Check in for today (dedup, recalculates streak)
- `DELETE /api/habits/:id`

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

## Making yourself Admin

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
melenotes/
├── backend/
│   └── src/
│       ├── config/          # Env, Prisma, Redis singletons
│       ├── lib/             # AppError, format helper
│       ├── modules/         # auth, tasks, lists, tags, habits, pomodoro, admin
│       ├── prisma/          # schema.prisma
│       ├── app.ts           # Fastify factory
│       ├── server.ts        # Entry point
│       └── worker.ts        # Cron reminder worker
├── frontend/
│   └── src/
│       ├── api/             # Axios client with 401 interceptor
│       ├── components/      # Reusable UI components
│       ├── store/           # Zustand stores
│       └── views/           # Page-level views (auth, app)
├── nginx/
│   └── nginx.conf           # Reverse proxy config
├── docker-compose.yml
└── .env.example
```

## License

MIT
