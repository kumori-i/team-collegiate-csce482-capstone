# 🚀 Quick Start Guide

## Your Backend is Ready!

The backend now uses Supabase for player/user data and provider-based LLM calls for chat/report generation.

---

## 🎯 API Reference

Use Swagger UI for the up-to-date API reference:

`http://localhost:5001/api/docs`

---

## ⚡ Quick Test

### 1. Start the backend
```bash
cd backend
npm run dev
```

### 2. Open API docs
```bash
open http://localhost:5001/api/docs
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
LLM_PROVIDER=tamu
TAMU_API_KEY=your_api_key
TAMU_BASE_URL=https://chat-api.tamu.ai
TAMU_CHAT_MODELS=protected.gpt-4o,protected.gpt-4.1,protected.o3-mini
```
Use `LLM_PROVIDER=gemini` or `LLM_PROVIDER=ollama` if you want a different model provider.

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

Use the endpoint definitions and example payloads in Swagger UI:

`http://localhost:5001/api/docs`

---

## 📚 Documentation Files

- **API_DOCUMENTATION.md** - Short pointer to Swagger docs
- **Swagger UI (`/api/docs`)** - Live API reference and request/response schemas
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
