# Backend Evaluation Metrics and Test & Validation Plan

## 0) How to Run This Validation Process

From project root:

1. Start backend:
```bash
cd backend
npm run dev
```

2. In a second terminal, run smoke tests:
```bash
cd backend
./scripts/api-smoke-tests.sh quick
```

3. Optional fuller run:
```bash
cd backend
./scripts/api-smoke-tests.sh full
```

4. Optional automated route tests:
```bash
cd backend
npm test -- --runInBand
```

Use the command outputs as evidence in your report/demonstration.

## 1) What to Measure (Evaluation Metrics)

Use these as capstone-ready, reportable metrics.

### Functional correctness
- API endpoint pass rate: `% of test cases passing`.
- Required contract compliance: `% responses matching expected status + required fields`.
- Validation enforcement rate: `% invalid requests correctly rejected (4xx)`.

### Reliability and stability
- Health uptime during test window: `% successful /health checks`.
- Error handling quality: `% server errors with structured `{ error: string }` payload`.
- Repeatability: variance in repeated runs of same smoke tests.

### Performance (lightweight)
- P50 and P95 latency for critical endpoints (health, auth login, players search).
- Timeout/failure rate under small burst load (e.g., 20 requests).

### Security and auth behavior
- Unauthorized access rejection rate for protected routes.
- Token handling correctness (missing/invalid token returns 401/403 as designed).

### AI/report endpoint quality (practical rubric)
- Response completion rate: `% requests returning non-empty report/reply`.
- Response format adherence: `% outputs that satisfy expected structure`.
- Human scoring rubric (1-5) for usefulness, factuality, and actionability.

## 2) Validation Scope

### In scope
- Route availability and status codes.
- Request validation behavior.
- Basic auth guard behavior.
- OpenAPI/docs availability.
- Basic end-to-end flow where dependencies are configured.

### Out of scope (or best-effort)
- Full external provider reliability (Google OAuth, TAMU/Gemini/Ollama uptime).
- Deep database correctness beyond API contract checks.
- Deterministic AI content correctness (evaluate with rubric instead).

## 3) Test Levels

### Level A: Smoke tests (always runnable)
- No special data setup required.
- Confirms server boots and key routes respond with expected basic behavior.

### Level B: Integration tests (requires env + Supabase + optional LLM)
- Register/login/profile flow.
- Players search/detail against real dataset.
- AI generation endpoints with configured provider keys.

### Level C: Regression tests (CI/local before demo)
- Run Jest/Supertest route tests.
- Run smoke script.
- Capture results snapshot (pass/fail + timings).

## 4) Acceptance Criteria (suggested)

- Smoke pass rate: `>= 95%` (target 100%).
- Integration pass rate: `>= 85%` in dev env with configured dependencies.
- Unauthorized checks: `100%` correct rejection.
- Contract checks: `>= 95%` endpoints return expected schema keys.
- P95 latency:
  - `/health` < 200 ms
  - non-AI CRUD/auth endpoints < 800 ms
  - AI endpoints: track separately due provider variability

## 5) Evidence to Include in Final Report

- Test run logs from smoke script.
- Jest test summary output.
- Table of endpoint coverage and status.
- Latency summary (P50/P95) for selected endpoints.
- AI rubric results on 5-10 representative prompts.

## 6) Minimal Test Case Matrix

- `GET /health` -> 200 and `status=ok`.
- `GET /api/openapi.json` -> 200 and OpenAPI JSON.
- `GET /api/docs` -> 200 HTML.
- `POST /api/auth/register` invalid body -> 400.
- `POST /api/auth/google` missing token -> 400.
- `GET /api/auth/profile` no token -> 401.
- `POST /api/chat` missing message -> 400.
- `POST /api/agent/chat` missing message -> 400.
- `POST /api/agent/report` missing all inputs -> 400.
- `POST /api/players/report` missing player payload -> 400.
- `POST /api/scouting/generate` missing required fields -> 400.

Optional integration checks:
- `POST /api/auth/register` valid payload -> 201.
- `POST /api/auth/login` valid credentials -> 200 + token.
- `GET /api/players/search?query=<name>` -> 200 + players array.
- `GET /api/players/:id` valid id -> 200 + player object.
