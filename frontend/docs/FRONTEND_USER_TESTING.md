# Frontend User Testing Guide

## Goal

This guide defines a repeatable manual user-testing pass for the main frontend workflows. It is intended for demos, regression checks, and acceptance testing before submission or release.

## Test Environment

- Frontend running locally
- Backend running locally
- Valid test user account
- Seeded player data available in the backend database

## Pre-Test Checklist

- Confirm the frontend loads without console-breaking errors.
- Confirm the backend health endpoint is available.
- Confirm the tester can sign in successfully.
- Confirm at least one known player exists for search and chat prompts.

## Test Scenarios

### 1. Authentication

Steps:

1. Open the frontend while logged out.
2. Confirm protected pages redirect to login.
3. Sign in with the configured login method.
4. Refresh the page and confirm the session remains active.

Expected result:

- Login succeeds.
- Protected pages become accessible.
- Invalid or expired tokens redirect back to login.

### 2. Navbar and Profile Menu

Steps:

1. Open the profile menu from the navbar.
2. Select `View Profile`.
3. Open the profile menu again.
4. Select `Cost Dashboard`.
5. Open the profile menu again.
6. Select `Logout`.

Expected result:

- Each menu action navigates to the correct route.
- Logout clears the session and returns to login.

### 3. Search and Player Details

Steps:

1. Search for a known player.
2. Open the player details page.
3. Confirm charts and key statistics render.
4. Trigger report generation if backend support is available.

Expected result:

- Search returns results.
- Player details render without layout issues.
- Report generation succeeds or shows a meaningful error.

### 4. Chat

Steps:

1. Ask a plain text question about a known player.
2. Ask for a chart using explicit metrics.
3. Reset the chat.
4. Ask a follow-up question after selecting a player context again.

Expected result:

- Assistant text renders correctly.
- Charts render only when explicitly requested.
- Reset clears the visible conversation.

### 5. Cost Dashboard

Steps:

1. Open the cost dashboard.
2. Change the date range from `2 Weeks` to `1 Month`.
3. Confirm summary cards update.
4. Confirm empty states render cleanly when no provider usage exists.

Expected result:

- Usage data loads.
- Range changes trigger a refresh.
- Empty states are readable and stable.

## Pass/Fail Recording

For each scenario, record:

- tester name
- date
- browser
- steps completed
- observed result
- pass/fail
- screenshots or notes for failures

## Recommended Browsers

- Chrome
- Safari
- Firefox

## Known Risk Areas

- expired token handling
- chat session persistence
- backend-dependent chart rendering
- cost dashboard data freshness
