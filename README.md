# Team Collegiate Capstone

TEAM: Ethan Rendell, Harrison Ko, Joshua George, Robert Stacks

This repository contains a React frontend and Express backend for basketball player search, dataset-grounded chat, player reports, chart generation, and per-user model usage tracking.

## Stack

- Frontend: React in [frontend/](/Users/user/pgrm/github/team-collegiate-csce482-capstone/frontend)
- Backend: Express in [backend/](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend)
- Data: Supabase
- Auth: JWT with Google login support
- AI providers: Gemini, TAMU-protected models, or Ollama

## Recommended Setup Path

For a new user receiving this repo, the recommended documented setup is Gemini.

Use:

- Supabase for data
- Gemini for AI generation

TAMU and Ollama remain supported, but Gemini is the easiest handoff path because it only requires a Gemini API key instead of access to a protected TAMU deployment.

## Repository Layout

```text
.
├── backend/
│   ├── README.md
│   └── docs/
├── frontend/
│   ├── README.md
│   └── docs/
└── docs/
```

## Backend Setup

1. Install backend dependencies:

```bash
cd backend
npm install
```

2. Create `backend/.env`:

```env
PORT=5001
JWT_SECRET=replace_with_a_random_secret

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_publishable_key

LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_CHAT_MODEL=gemini-2.5-flash
```

Optional provider alternatives:

```env
LLM_PROVIDER=tamu
TAMU_API_KEY=your_tamu_key
TAMU_BASE_URL=https://chat.tamu.ai
TAMU_CHAT_MODELS=protected.gpt-4o,protected.gpt-4.1,protected.o3-mini
```

or

```env
LLM_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

3. Run the Supabase SQL setup:

- [backend/docs/supabase/SUPABASE_SETUP.sql](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/docs/supabase/SUPABASE_SETUP.sql)

4. Start the backend:

```bash
cd backend
npm run dev
```

## Frontend Setup

1. Install frontend dependencies:

```bash
cd frontend
npm install
```

2. Optional frontend env:

```env
REACT_APP_API_URL=http://localhost:5001/api
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
```

3. Start the frontend:

```bash
cd frontend
npm start
```

## API and Docs

- Swagger docs: `http://localhost:5001/api/docs`
- Backend docs index: [backend/README.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/README.md)
- Frontend docs index: [frontend/README.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/frontend/README.md)

## Testing

Backend:

```bash
cd backend
npm test
```

Frontend:

```bash
cd frontend
CI=true npm test -- --watch=false
npm run build
```

## Additional Project Documents

- Backend validation plan: [backend/docs/TEST_VALIDATION_PLAN.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/docs/TEST_VALIDATION_PLAN.md)
- Frontend architecture: [frontend/docs/FRONTEND_ARCHITECTURE.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/frontend/docs/FRONTEND_ARCHITECTURE.md)
- Frontend user testing: [frontend/docs/FRONTEND_USER_TESTING.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/frontend/docs/FRONTEND_USER_TESTING.md)
