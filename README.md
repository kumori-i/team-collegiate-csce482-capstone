# team-collegiate-csce482-capstone

TEAM: Ethan Rendell, Harrison Ko, Joshua George, Robert Stacks

## Stack Overview

- Frontend: React (`frontend/`)
- Backend: Express + Supabase (`backend/`)
- Auth: JWT + Google OAuth
- AI: Provider-driven generation via `LLM_PROVIDER` (`tamu`, `gemini`, or `ollama`)

## Current AI Architecture

The project no longer uses RAG/vector indexing. AI routes call the configured LLM provider directly and rely on runtime data/agent logic instead of embeddings.

## Backend Setup

1. Go to backend:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Configure `backend/.env`:
```env
PORT=5001
JWT_SECRET=your_random_secret

NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_key

LLM_PROVIDER=tamu
TAMU_API_KEY=your_tamu_key
TAMU_BASE_URL=https://chat-api.tamu.ai
TAMU_CHAT_MODELS=protected.gpt-4o,protected.gpt-4.1,protected.o3-mini
```

4. Run backend:
```bash
npm run dev
```

## Frontend Setup

1. Go to frontend:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Optional env:
```env
REACT_APP_API_URL=http://localhost:5001/api
```

4. Run frontend:
```bash
npm start
```

## API Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/google`
- `GET /api/auth/profile`
- `DELETE /api/auth/account`
- `GET /api/players/search`
- `GET /api/players/:id`
- `POST /api/players/report`
- `POST /api/scouting/generate`
- `POST /api/chat`
- `GET /health`
