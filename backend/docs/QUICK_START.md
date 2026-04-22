# Backend Quick Start

This backend needs three things for the full project flow:

1. Company API credentials for player data
2. A JWT secret for local auth
3. One LLM provider for chat and reports

Supabase is recommended for persistent auth and usage storage, but the backend can fall back to `backend/.data/app-db.json` when Supabase is not configured.

## 1. Install Dependencies

```bash
cd backend
npm install
```

## 2. Configure `backend/.env`

Minimum working config:

```env
PORT=5001
JWT_SECRET=replace_with_a_random_secret

COMPANY_AUTH_URL=https://hasura-auth-api-960327267159.us-east4.run.app
COMPANY_GRAPHQL_URL=https://hasura-graphql-engine-960327267159.us-east4.run.app/v1/graphql
COMPANY_API_EMAIL=your_company_api_email
COMPANY_API_PASSWORD=your_company_api_password

LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_CHAT_MODEL=gemini-2.5-flash
```

Optional additions:

```env
GOOGLE_CLIENT_ID=your_google_client_id
FRONTEND_URL=http://localhost:3000

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Alternative LLM providers:

- `LLM_PROVIDER=tamu` with `TAMU_API_KEY`, `TAMU_BASE_URL`, and `TAMU_CHAT_MODELS`
- `LLM_PROVIDER=ollama` with `OLLAMA_URL` and `OLLAMA_MODEL`

If you want local overrides without editing the shared env file, create `backend/.env.local`. It is loaded after `backend/.env`.

## 3. Optional Supabase Setup

For persistent auth and usage storage, run:

- [supabase/SUPABASE_SETUP.sql](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/docs/supabase/SUPABASE_SETUP.sql)

Without Supabase, auth users and usage events are stored locally in `.data/app-db.json`.

## 4. Start the Backend

```bash
cd backend
npm run dev
```

Expected local URLs:

- Health check: `http://localhost:5001/health`
- Swagger UI: `http://localhost:5001/api/docs`
- OpenAPI JSON: `http://localhost:5001/api/openapi.json`

## 5. Verify the Service

```bash
curl http://localhost:5001/health
```

```bash
cd backend
npm test
```

## Related Docs

- API reference pointer: [API_DOCUMENTATION.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/docs/API_DOCUMENTATION.md)
- Validation plan: [TEST_VALIDATION_PLAN.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/docs/TEST_VALIDATION_PLAN.md)
- Migration notes: [MIGRATION_SUMMARY.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/docs/MIGRATION_SUMMARY.md)
