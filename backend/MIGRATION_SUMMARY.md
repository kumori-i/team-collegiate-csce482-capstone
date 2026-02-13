# Backend Migration Summary

## ✅ What Changed

### 1. Database Migration: MongoDB → Supabase
- **Removed**: MongoDB/Mongoose dependencies
- **Added**: Supabase client (`@supabase/supabase-js`)
- **Updated**: All routes now use Supabase for data storage

### 2. New Player Search API
Implemented comprehensive player search functionality similar to my-app:

#### New Endpoints:
- `GET /api/players/search` - Search players by name
- `GET /api/players/:id` - Get detailed player stats
- `POST /api/scouting/generate` - Generate AI scouting reports

#### Features:
- ✅ Case-insensitive search
- ✅ Configurable result limits
- ✅ Full player statistics
- ✅ AI-powered scouting reports using configurable providers (`LLM_PROVIDER`)

---

## 🗂️ File Changes

### Created:
- `backend/supabase.js` - Supabase client initialization
- `backend/routes/scouting.js` - AI scouting report generation
- `backend/SUPABASE_SETUP.sql` - Database schema for users table
- `backend/API_DOCUMENTATION.md` - Complete API documentation
- `backend/MIGRATION_SUMMARY.md` - This file

### Modified:
- `backend/routes/auth.js` - Updated to use Supabase instead of Mongoose
- `backend/routes/players.js` - Complete rewrite to use Supabase
- `backend/index.js` - Removed MongoDB connection, added scouting routes
- `backend/package.json` - Removed mongoose, added @supabase/supabase-js

### Deleted:
- `backend/db.js` - MongoDB connection file (no longer needed)
- `backend/models/User.js` - Mongoose model (no longer needed)

---

## 📊 Database Schema

### Supabase Tables Required:

#### 1. `users` table (for authentication)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. `ncaa_players_d1_male` table (for player data)
This should already exist in your Supabase (same as my-app).

**Required columns:**
- `unique_id` - Primary key
- `name_split` - Player name
- `team` - Team name
- `position` - Player position
- `league` - Conference/league
- `class` - Year (Freshman, Sophomore, etc.)
- All stat columns: `pts_g`, `reb_g`, `ast_g`, `fg`, `c_3pt`, `ft`, etc.

---

## 🚀 Setup Instructions

### 1. Run SQL Setup
Open Supabase SQL Editor and run:
```bash
backend/SUPABASE_SETUP.sql
```

### 2. Verify Environment Variables
Make sure `.env` has:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_key_here
GEMINI_API_KEY=your_gemini_key
GEMINI_CHAT_MODEL=gemini-2.5-flash
```

### 3. Start Backend
```bash
cd backend
npm install  # Already done
npm run dev
```

### 4. Test Endpoints
```bash
# Test health check
curl http://localhost:5001/health

# Test player search
curl "http://localhost:5001/api/players/search?query=john&limit=5"
```

---

## 📖 API Documentation

Use Swagger UI as the source of truth:

- `http://localhost:5001/api/docs` (local)
- `<your-backend-url>/api/docs` (deployed)

---

## 🔄 Next Steps for Frontend Integration

1. **Update your frontend to call these backend endpoints** instead of directly calling Supabase
2. **Advantages of this approach:**
   - Better security (Supabase credentials stay on backend)
   - Easier to add caching, rate limiting, and analytics
   - Can add authentication middleware
   - Centralized business logic

3. **Use `/api/docs` to generate frontend calls** from the live request/response schemas.

---

## 🧪 Testing

All existing tests have been updated to mock Supabase instead of Mongoose:
```bash
cd backend
npm test
```

---

## 💡 Benefits

1. **Security**: Database credentials never exposed to frontend
2. **Consistency**: Single source of truth for data access
3. **Flexibility**: Easy to switch databases or add caching
4. **Maintainability**: Business logic centralized in backend
5. **Scalability**: Can add rate limiting, authentication, etc.

---

## 🐛 Troubleshooting

### Issue: "Missing Supabase credentials"
- Check that `.env` has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`

### Issue: "Player not found"
- Verify the `ncaa_players_d1_male` table exists in Supabase
- Check that the `unique_id` column exists

### Issue: "Failed to generate scouting report"
- Verify provider-specific keys are set in `.env` (for example `TAMU_API_KEY` when `LLM_PROVIDER=tamu`)
- Check that your selected model in `TAMU_CHAT_MODELS` (or provider equivalent) is available

### Issue: CORS errors from frontend
- The backend allows all origins in development mode
- In production, set `FRONTEND_URL` environment variable
