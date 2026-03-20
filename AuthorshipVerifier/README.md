# AuthorshipVerifier

A full-stack web application skeleton with:
- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL + Prisma
- Authentication: JWT

## Project Structure

```text
AuthorshipVerifier/
  frontend/
  backend/
```

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop (recommended) or PostgreSQL 14+

## Database Setup (Docker)

1. Start PostgreSQL container:
```bash
docker compose up -d
```

2. Confirm container health:
```bash
docker compose ps
```

## Backend Setup

1. Install dependencies:
```bash
cd backend
npm install
```

2. Copy environment template:
```bash
cp .env.example .env
```

3. Update `DATABASE_URL`, `JWT_SECRET`, and `CLIENT_URL` in `.env` if needed.

4. Generate Prisma client and run migrations:
```bash
npm run prisma:generate
npm run prisma:migrate
```

5. Start backend:
```bash
npm run dev
```

Backend default: `http://localhost:5000`

## Frontend Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Copy environment template:
```bash
cp .env.example .env
```

3. Start frontend:
```bash
npm run dev
```

Frontend default: `http://localhost:5173`

## API Endpoints

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/documents` (protected)
- `POST /api/documents` (protected)

## Notes

- This is a starter skeleton meant for extension.
- Passwords are hashed with bcrypt.
- JWT is used for stateless auth.
- Default Docker DB URL uses `localhost:5433`.
