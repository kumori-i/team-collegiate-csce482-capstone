# Frontend Architecture

## Purpose

The frontend provides an authenticated interface for basketball analytics workflows. It consumes backend APIs for search, chat, player reports, and usage analytics, while keeping most client-side state intentionally lightweight.

## Routing Model

Routing lives in `src/App.js`.

Protected routes:

- `/`
- `/search`
- `/players/:id`
- `/chat`
- `/profile`
- `/cost-dashboard`

Unauthenticated route:

- `/login`

`ProtectedRoute` checks for a valid non-expired JWT before rendering a protected page. Expired tokens are removed from local storage and the user is redirected back to login.

## Authentication Flow

Client auth utilities live in `src/auth.js`.

Key rules:

- JWTs are stored in `localStorage` under `token`.
- `getValidStoredToken()` removes expired tokens before API usage.
- API helpers send the token through the `Authorization` header.
- Pages that receive `401` or `403` from protected backend endpoints call the shared logout flow.

## API Layer

`src/api.js` contains the frontend-facing API contract.

Main helpers:

- `chatWithAgent`
- `resetAgentSession`
- `searchPlayers`
- `getPlayer`
- `getSimilarPlayers`
- `generatePlayerReport`
- `getUserProfile`
- `deleteAccount`
- `getUsageDashboard`

This keeps route pages focused on UI state instead of request formatting.

## Chat Page Behavior

`src/pages/Chat.js` manages:

- session persistence via `agentSessionId`
- per-session message persistence in local storage
- conversion of UI messages into limited backend history
- assistant response rendering
- conditional chart rendering through `ChatMetricChart`

Important constraint:

- A chart should only render when the backend response contains `chartSpec`.

## Cost Dashboard Behavior

`src/pages/CostDashboard.js` manages:

- range selection for `14`, `30`, and `180` day windows
- summary cards for requests, tokens, and estimated cost
- a daily usage chart
- provider-specific bar charts for Gemini and TAMU model usage

The dashboard is intentionally read-only and backend-driven.

## Testing Strategy

The frontend test suite is designed around user-visible risk, not raw line coverage.

Automated tests should cover:

- auth gating and expired token handling
- navigation from the profile menu
- chat send/render/error behavior
- chart rendering conditions
- cost dashboard data loading and fallback states

Manual testing should cover:

- end-to-end login behavior
- cross-page navigation
- chart download actions
- chat follow-up behavior
- mobile/responsive layout checks
