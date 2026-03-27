# Davomat Tizimi - Attendance Management System

## Overview

Full-stack attendance management web application (PWA) with 3 user roles: superadmin, admin, and employee. Built with Node.js + Express + PostgreSQL backend and React + Vite frontend.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Auth**: Session-based (express-session + bcryptjs)
- **Charts**: Recharts
- **PWA**: manifest.json + PWA meta tags

## User Roles

| Role | Access |
|------|--------|
| **superadmin** | Full control - manage all users, departments, shifts, attendance, reports |
| **admin** | Manage employees, attendance, approve/reject leaves, view reports |
| **employee** | View own attendance, check in/out, submit leave requests |

## Default Credentials (after seeding)

| Role | Username | Password |
|------|----------|----------|
| superadmin | superadmin | superadmin123 |
| admin | admin | admin123 |
| employee | alisher | emp123 |
| employee | zulfiya | emp123 |
| employee | bobur | emp123 |

## Seed Data

Run `POST /api/seed` once to populate initial users, departments, and shifts.

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/           # Express API server
│   └── davomat/              # React PWA frontend
├── lib/
│   ├── api-spec/             # OpenAPI spec + Orval codegen config
│   ├── api-client-react/     # Generated React Query hooks
│   ├── api-zod/              # Generated Zod schemas from OpenAPI
│   └── db/                   # Drizzle ORM schema + DB connection
├── scripts/                  # Utility scripts
└── ...
```

## Database Schema

- **users** - All users (superadmin/admin/employee) with role, department, shift
- **departments** - Organizational departments
- **shifts** - Work shifts with start/end times, late threshold, work days
- **attendance** - Daily attendance records with check-in/out times, status, work hours
- **leave_requests** - Leave/vacation requests with approval workflow

## API Routes

- `POST /api/auth/login` — Login
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Get current user
- `GET/POST /api/users` — User management
- `GET/POST /api/departments` — Department management
- `GET/POST /api/shifts` — Shift management
- `GET/POST /api/attendance` — Attendance records
- `POST /api/attendance/checkin` — Employee check-in
- `POST /api/attendance/checkout` — Employee check-out
- `GET /api/attendance/today` — Today's status for current user
- `GET/POST /api/leave` — Leave requests
- `GET /api/reports/summary` — Summary report
- `GET /api/reports/employee/:id` — Employee report
- `GET /api/reports/daily` — Daily report
- `GET /api/stats/dashboard` — Dashboard statistics

## Frontend Pages

- `/login` — Login page
- `/` — Dashboard with stats and charts
- `/attendance` — Attendance records list with filters
- `/attendance/checkin` — Check-in/out page
- `/employees` — Employee list (admin+)
- `/departments` — Department management (superadmin)
- `/shifts` — Shift management (superadmin)
- `/leave` — Leave requests
- `/reports` — Reports with date range, export
- `/profile` — User profile + change password

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json`. Run `pnpm run typecheck` from root.

## Running

- API: `pnpm --filter @workspace/api-server run dev`
- Frontend: `pnpm --filter @workspace/davomat run dev`
- DB push: `pnpm --filter @workspace/db run push`
- Seed: `curl -X POST http://localhost:80/api/seed`
