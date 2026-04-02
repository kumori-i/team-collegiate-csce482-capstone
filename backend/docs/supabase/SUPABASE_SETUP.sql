-- SQL script to create the users table in Supabase
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Add a constraint to ensure either password_hash or google_id is present
ALTER TABLE users ADD CONSTRAINT check_auth_method
  CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL);

CREATE TABLE IF NOT EXISTS model_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  route TEXT,
  feature TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12, 6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_usage_events_user_id
  ON model_usage_events(user_id);

CREATE INDEX IF NOT EXISTS idx_model_usage_events_created_at
  ON model_usage_events(created_at);

CREATE INDEX IF NOT EXISTS idx_model_usage_events_provider_model
  ON model_usage_events(provider, model);
