# Frontend Overview

The frontend is a Create React App application for the CerebroChat interface. It manages authentication, navigation, player exploration, streamed chat, player reports, and the usage dashboard.

## Main Pages

- `Home`
- `Search`
- `PlayerDetails`
- `Chat`
- `Profile`
- `CostDashboard`
- `Login`

## Environment and Startup

Install dependencies:

```bash
cd frontend
npm install
```

Start the development server:

```bash
cd frontend
npm start
```

The app runs on `http://localhost:3000`.

### Optional Environment Variables

- `REACT_APP_API_URL`: backend API base URL. If omitted, the app defaults to `http://localhost:5001/api`.
- `REACT_APP_GOOGLE_CLIENT_ID`: Google Sign-In client ID used by the login page.

## Testing

Run the frontend test suite:

```bash
cd frontend
CI=true npm test -- --watch=false
```

Build the production bundle:

```bash
cd frontend
npm run build
```

## What The Automated Tests Cover

- protected-route auth gating
- navbar profile menu navigation and logout
- chat send/render/auth-failure behavior
- chart rendering only when `chartSpec` is returned
- usage dashboard loading and empty states

## Documentation

- Architecture notes: [docs/FRONTEND_ARCHITECTURE.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/frontend/docs/FRONTEND_ARCHITECTURE.md)
- Manual user testing guide: [docs/FRONTEND_USER_TESTING.md](/Users/user/pgrm/github/team-collegiate-csce482-capstone/frontend/docs/FRONTEND_USER_TESTING.md)
