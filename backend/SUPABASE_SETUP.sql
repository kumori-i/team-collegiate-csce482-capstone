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
