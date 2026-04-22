# Team Collegiate Capstone

Team: Ethan Rendell, Harrison Ko, Joshua George, Robert Stacks

This repository contains the final React frontend and Express backend for player search, scouting reports, dataset-grounded chat, chart rendering, and per-user usage tracking.

## Stack

- Frontend: React in [frontend](/Users/user/pgrm/github/team-collegiate-csce482-capstone/frontend)
- Backend: Express in [backend](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend)
- Player data: Company GraphQL API
- Auth: JWT with email/password and Google sign-in
- AI providers: Gemini, TAMU protected models, or Ollama
- Persistence: Supabase when configured, otherwise local JSON fallback for auth and usage data

## Recommended Handoff Setup

The simplest handoff path is:

1. Company GraphQL API credentials for player data
2. Gemini for AI generation
3. Optional Supabase for persistent auth and usage storage

Gemini is the recommended default because it only requires a Gemini API key. TAMU and Ollama remain supported.

## Quick Start

1. Install dependencies:

```bash
cd backend && npm install
cd ../frontend && npm install
```

2. Create `backend/.env`:

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

Optional backend additions:

```env
GOOGLE_CLIENT_ID=your_google_client_id
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
FRONTEND_URL=http://localhost:3000
```

3. Optional frontend env in `frontend/.env`:

```env
REACT_APP_API_URL=http://localhost:5001/api
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
```

4. Start the apps:

```bash
cd backend
npm run dev
```

```bash
cd frontend
npm start
```

## Verification Commands

These are the commands used for final verification:

```bash
cd backend
npm test
```

```bash
cd frontend
CI=true npm test -- --watch=false
npm run build
```

## Documentation Map

- Backend overview: [backend/README.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/README.md)
- Frontend overview: [frontend/README.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/frontend/README.md)
- Backend quick start: [backend/docs/QUICK_START.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/docs/QUICK_START.md)
- Swagger UI: `http://localhost:5001/api/docs`
- Backend validation plan: [backend/docs/TEST_VALIDATION_PLAN.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/docs/TEST_VALIDATION_PLAN.md)
- Frontend architecture: [frontend/docs/FRONTEND_ARCHITECTURE.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/frontend/docs/FRONTEND_ARCHITECTURE.md)
- Frontend user testing: [frontend/docs/FRONTEND_USER_TESTING.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/frontend/docs/FRONTEND_USER_TESTING.md)
