# Frontend Overview

This frontend is a Create React App application for the CerebroChat basketball analytics interface. It handles authenticated navigation, dataset chat, player detail views, and the model cost dashboard.

## Core Responsibilities

- Authenticate users through the backend-issued JWT flow.
- Route users between home, search, chat, player details, profile, and cost dashboard pages.
- Render chat responses, including chart responses when the backend returns a `chartSpec`.
- Display per-user cost and usage summaries from the backend usage API.

## Project Structure

```text
frontend/
  public/                  Static CRA assets
  src/
    components/            Shared UI components
    pages/                 Route-level screens
    api.js                 Backend API client helpers
    auth.js                JWT parsing and expiry helpers
    App.js                 Top-level router and auth shell
    setupTests.js          Jest / Testing Library setup
  docs/
    FRONTEND_ARCHITECTURE.md
    FRONTEND_USER_TESTING.md
```

## Main Pages

- `Home`: landing page after login.
- `Search`: player lookup and navigation to player detail pages.
- `Chat`: dataset-grounded chat with optional chart rendering.
- `PlayerDetails`: player metrics, charts, and report generation.
- `Profile`: user profile data and account deletion.
- `CostDashboard`: usage, token, and estimated cost charts.

## Environment and Startup

Install dependencies:

```bash
cd frontend
npm install
```

Start the development server:

```bash
npm start
```

By default, the frontend runs on `http://localhost:3000` and proxies API requests to `http://localhost:5001`.

### Optional Environment Variables

- `REACT_APP_API_URL`: explicit backend API base URL. If omitted, the CRA proxy is used.
- `REACT_APP_GOOGLE_CLIENT_ID`: Google Sign-In client ID used by the login page.

## Testing

Run the frontend unit/component tests:

```bash
cd frontend
CI=true npm test -- --watch=false
```

Build the production bundle:

```bash
cd frontend
npm run build
```

## Documentation

- Architecture notes: [docs/FRONTEND_ARCHITECTURE.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/frontend/docs/FRONTEND_ARCHITECTURE.md)
- Manual user testing guide: [docs/FRONTEND_USER_TESTING.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/frontend/docs/FRONTEND_USER_TESTING.md)

## Current Testing Focus

Automated tests currently prioritize high-risk user-facing flows:

- auth gating for protected routes
- profile menu navigation and logout actions
- chat message send/render behavior
- chart rendering only when the backend explicitly requests it
- cost dashboard loading and empty-state behavior
