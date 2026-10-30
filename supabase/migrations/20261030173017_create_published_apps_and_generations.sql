/*
# Create core tables for the in-app AI web builder

## Overview
Adds three tables that power the Experts Team AI web builder:
- `published_apps` — every website a user generates and publishes. Identified by a unique slug for public live URLs at /apps/<slug>.
- `ai_generations` — a log of every AI generation request (for admin analytics and per-user history).

## 1. New Tables

### published_apps
- `id` (uuid, primary key)
- `slug` (text, unique, not null) — URL slug for the public live page
- `title` (text, not null) — app title
- `summary` (text) — AI-generated summary of the app
- `files` (jsonb, not null) — full bundle: Record<filename, fileContents>
- `user_id` (uuid, not null, default auth.uid()) — owner
- `is_published` (boolean, default false) — whether it's publicly live
- `generation_count` (integer, default 0) — number of AI iterations on this app
- `github_repo` (text) — full_name of pushed GitHub repo, if any
- `github_url` (text) — repo html url, if any
- `github_pages_url` (text) — pages url, if any
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### ai_generations
- `id` (uuid, primary key)
- `user_id` (uuid, not null, default auth.uid()) — owner
- `app_id` (uuid references published_apps(id) on delete set null) — optional link to the app
- `prompt` (text, not null) — the user's prompt
- `summary` (text) — AI summary returned
- `file_count` (integer, default 0) — number of files in the response
- `created_at` (timestamptz, default now())

## 2. Security

### published_apps
- RLS enabled.
- CRUD granted to `authenticated` only (this app requires sign-in).
- Owner-scoped policies: users can SELECT/INSERT/UPDATE/DELETE only their own rows.
- Public reads: anyone (anon) can SELECT a published app (so /apps/<slug> works without login). Restricted via `is_published = true`.
- service_role granted for server-side edge functions if needed.

### ai_generations
- RLS enabled.
- CRUD granted to `authenticated` only.
- Owner-scoped: a user can only read/insert their own generation logs.
- service_role granted so the generate API can insert logs server-side.

## 3. Notes
- `user_id` defaults to auth.uid() so client inserts that omit user_id still satisfy WITH CHECK.
- Public /apps/<slug> page reads via the anon key, so an anon SELECT policy (is_published=true only) is mandatory.
*/

-- published_apps
CREATE TABLE IF NOT EXISTS published_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  summary text,
  files jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  is_published boolean NOT NULL DEFAULT false,
  generation_count integer NOT NULL DEFAULT 0,
  github_repo text,
  github_url text,
  github_pages_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE published_apps ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON published_apps TO authenticated;
GRANT SELECT ON published_apps TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON published_apps TO service_role;

-- anon can read published apps (public live URLs)
DROP POLICY IF EXISTS "anon_read_published" ON published_apps;
CREATE POLICY "anon_read_published"
  ON published_apps FOR SELECT
  TO anon USING (is_published = true);

-- owner CRUD
DROP POLICY IF EXISTS "select_own_apps" ON published_apps;
CREATE POLICY "select_own_apps"
  ON published_apps FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_apps" ON published_apps;
CREATE POLICY "insert_own_apps"
  ON published_apps FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_apps" ON published_apps;
CREATE POLICY "update_own_apps"
  ON published_apps FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_apps" ON published_apps;
CREATE POLICY "delete_own_apps"
  ON published_apps FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS published_apps_touch ON published_apps;
CREATE TRIGGER published_apps_touch BEFORE UPDATE ON published_apps
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ai_generations
CREATE TABLE IF NOT EXISTS ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id uuid REFERENCES published_apps(id) ON DELETE SET NULL,
  prompt text NOT NULL,
  summary text,
  file_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON ai_generations TO authenticated;
GRANT SELECT, INSERT ON ai_generations TO service_role;

DROP POLICY IF EXISTS "select_own_generations" ON ai_generations;
CREATE POLICY "select_own_generations"
  ON ai_generations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_generations" ON ai_generations;
CREATE POLICY "insert_own_generations"
  ON ai_generations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_generations" ON ai_generations;
CREATE POLICY "delete_own_generations"
  ON ai_generations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- admin: allow service_role to read all (for admin analytics)
DROP POLICY IF EXISTS "service_role_all_generations" ON ai_generations;
CREATE POLICY "service_role_all_generations"
  ON ai_generations FOR SELECT
  TO service_role USING (true);

-- index for user lookups
CREATE INDEX IF NOT EXISTS idx_published_apps_user_id ON published_apps(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_generations_user_id ON ai_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_generations_app_id ON ai_generations(app_id);
