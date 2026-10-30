/*
# Fix database security issues

## Overview
Two security issues found by the advisor:
1. `anon` role was over-granted INSERT/UPDATE/DELETE on both `published_apps` and `ai_generations`. The anon role should only have SELECT on `published_apps` (for reading published apps at public URLs). This is a privilege escalation risk — the anon key is public in the browser, so any user could write/delete data without authentication.
2. The `touch_updated_at()` trigger function had a mutable `search_path`, which is a security risk (search path hijacking).

## Changes
1. Revoke all `anon` privileges on `ai_generations` (anon should never touch this table).
2. Revoke INSERT/UPDATE/DELETE on `published_apps` from `anon`, keep SELECT only (for public published apps).
3. Recreate `touch_updated_at()` with an explicit, empty `search_path = ''` to prevent search path hijacking.

## Security
- `anon` role: SELECT only on `published_apps` (restricted by RLS to `is_published = true`), no access to `ai_generations`.
- `authenticated` role: unchanged (owner-scoped CRUD on both tables).
*/

-- Fix 1: Revoke over-granted anon privileges
REVOKE INSERT, UPDATE, DELETE ON published_apps FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON ai_generations FROM anon;

-- Fix 2: Recreate touch_updated_at with secure search_path
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
