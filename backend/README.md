# Backend Overview

The backend is an Express API that handles authentication, player data access, chat/report orchestration, and usage tracking.

## What It Depends On

- Company GraphQL API for player search, detail, similarity, and history
- One LLM provider for chat and report generation: Gemini, TAMU, or Ollama
- Supabase for persistent auth and usage storage, or the built-in `.data/app-db.json` fallback when Supabase is not configured

## Main Routes

- `/api/auth` for registration, login, Google sign-in, profile, and account deletion
- `/api/players` for search, detail, history, similar players, and reports
- `/api/agent` for streamed chat, reports, session reset, and suggestions
- `/api/usage` for the authenticated usage dashboard
- `/api/docs` and `/api/openapi.json` for Swagger documentation

## Local Development

The server loads `backend/.env` and then `backend/.env.local` if present.

```bash
cd backend
npm install
npm run dev
```

Run tests:

```bash
cd backend
npm test
```

Swagger UI is available at `http://localhost:5001/api/docs`.

## Documentation

- Quick start: [docs/QUICK_START.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/docs/QUICK_START.md)
- API docs note: [docs/API_DOCUMENTATION.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/docs/API_DOCUMENTATION.md)
- Validation plan: [docs/TEST_VALIDATION_PLAN.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/docs/TEST_VALIDATION_PLAN.md)
- Migration summary: [docs/MIGRATION_SUMMARY.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/docs/MIGRATION_SUMMARY.md)
- Supabase setup SQL: [docs/supabase/SUPABASE_SETUP.sql](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/docs/supabase/SUPABASE_SETUP.sql)
