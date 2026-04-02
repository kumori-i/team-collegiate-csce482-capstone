# Backend Overview

This backend is an Express service backed by Supabase for application data and a configurable LLM provider for chat and report generation.

## Core Responsibilities

- user authentication and JWT issuance
- player search and player detail APIs
- agent-driven chat and report orchestration
- model usage and cost tracking
- Swagger API documentation

## Documentation

- Quick start: [docs/QUICK_START.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/docs/QUICK_START.md)
- API docs note: [docs/API_DOCUMENTATION.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/docs/API_DOCUMENTATION.md)
- Validation plan: [docs/TEST_VALIDATION_PLAN.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/docs/TEST_VALIDATION_PLAN.md)
- Migration summary: [docs/MIGRATION_SUMMARY.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/docs/MIGRATION_SUMMARY.md)
- Supabase setup: [docs/supabase/SUPABASE_SETUP.sql](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/docs/supabase/SUPABASE_SETUP.sql)

## Local Development

```bash
cd backend
npm install
npm run dev
```

Swagger UI is available at `http://localhost:5001/api/docs`.
