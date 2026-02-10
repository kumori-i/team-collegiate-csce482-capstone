# 🚀 Quick Start Guide

## Your Backend is Ready!

The backend has been migrated from MongoDB to Supabase and now includes player search functionality similar to my-app.

---

## 🎯 Available API Endpoints

### 🏀 Player Search
```
GET  /api/players/search?query=john&limit=50
GET  /api/players/:id
POST /api/scouting/generate
```

### 👤 Authentication (Already Working)
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/google
GET  /api/auth/profile
DELETE /api/auth/account
```

### 💬 Chat (Already Working)
```
POST /api/chat
```

---

## ⚡ Quick Test

### 1. Start the backend
```bash
cd backend
npm run dev
```

### 2. Test player search
```bash
# Search for players
curl "http://localhost:5001/api/players/search?query=lebron"

# Get player by ID (replace with actual ID from search results)
curl "http://localhost:5001/api/players/YOUR_PLAYER_ID"
```

### 3. Test AI scouting report
```bash
curl -X POST http://localhost:5001/api/scouting/generate \
  -H "Content-Type: application/json" \
  -d '{
    "name": "LeBron James",
    "team": "Lakers",
    "position": "Forward",
    "pts_g": 25.7,
    "reb_g": 7.3,
    "ast_g": 8.3
  }'
```

---

## 📝 What You Need to Do

### ✅ Step 1: Create Supabase Users Table
1. Go to your Supabase dashboard
2. Open SQL Editor
3. Run the SQL from `SUPABASE_SETUP.sql`

### ✅ Step 2: Verify Your `.env`
Make sure these variables are set:
```env
NEXT_PUBLIC_SUPABASE_URL=https://eofnuhzxwbfdylhwysqc.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_QldAzENSZzOcqCJzulDPhA_Id-piaqm
GEMINI_API_KEY=AIzaSyAVXhQLv4qSh4pL8SGizNyvHpS5gFoiduc
GEMINI_CHAT_MODEL=gemini-2.5-flash
```
*(These are already in your .env)*

### ✅ Step 3: Start Backend
```bash
npm run dev
```

You should see:
```
Backend running on port 5001
Health check: http://localhost:5001/health
Using Supabase for database
```

---

## 📱 Frontend Integration (Later)

When you're ready to connect the frontend, you'll make API calls like this:

```javascript
// Search players
const response = await fetch('http://localhost:5001/api/players/search?query=john');
const { players, count } = await response.json();

// Get player details
const response = await fetch('http://localhost:5001/api/players/player-123');
const { player } = await response.json();

// Generate AI report
const response = await fetch('http://localhost:5001/api/scouting/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: player.name_split,
    team: player.team,
    position: player.position,
    pts_g: player.pts_g,
    // ... other stats
  })
});
const { description } = await response.json();
```

---

## 📚 Documentation Files

- **API_DOCUMENTATION.md** - Complete API reference with examples
- **MIGRATION_SUMMARY.md** - What changed and why
- **QUICK_START.md** - This file

---

## 🎉 Summary

✅ Backend migrated from MongoDB → Supabase
✅ Player search API implemented
✅ AI scouting report generation added
✅ All endpoints documented
✅ Ready for frontend integration

**Next:** Start your backend and test the endpoints, then integrate them into your frontend when ready!
