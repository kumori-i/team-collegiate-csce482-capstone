# Backend Quick Start

This backend uses Supabase for data storage and supports multiple LLM providers. The recommended documented setup path for a new handoff is Gemini.

## 1. Install Dependencies

```bash
cd backend
npm install
```

## 2. Configure Environment Variables

Create `backend/.env` with:

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

- `LLM_PROVIDER=tamu` with `TAMU_API_KEY`, `TAMU_BASE_URL`, and `TAMU_CHAT_MODELS`
- `LLM_PROVIDER=ollama` with a local Ollama instance

## 3. Run Supabase Setup SQL

Open your Supabase SQL editor and run:

- [supabase/SUPABASE_SETUP.sql](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/docs/supabase/SUPABASE_SETUP.sql)

This creates:

- `users`
- `model_usage_events`

The player table `ncaa_players_d1_male` is expected to already exist in your Supabase project.

## 4. Start the Backend

```bash
cd backend
npm run dev
```

Expected startup signals:

```text
Backend running on port 5001
Health check: http://localhost:5001/health
Swagger docs: http://localhost:5001/api/docs
Using Supabase for database
```

## 5. Verify the Service

Health check:

```bash
curl http://localhost:5001/health
```

Swagger docs:

- `http://localhost:5001/api/docs`

## Related Docs

- API reference pointer: [API_DOCUMENTATION.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/docs/API_DOCUMENTATION.md)
- Validation plan: [TEST_VALIDATION_PLAN.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/docs/TEST_VALIDATION_PLAN.md)
- Migration notes: [MIGRATION_SUMMARY.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/backend/docs/MIGRATION_SUMMARY.md)
