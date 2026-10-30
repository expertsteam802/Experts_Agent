import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

let _serverClient: SupabaseClient | null = null;

/**
 * Returns a Supabase client using the anon key. Used for server-side reads
 * that respect RLS (e.g. the public /apps/[slug] page reading published apps).
 */
export function getSupabaseServer(): SupabaseClient {
  if (_serverClient) return _serverClient;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  }
  _serverClient = createClient(supabaseUrl, supabaseAnonKey);
  return _serverClient;
}

/**
 * Returns a Supabase client scoped to the authenticated user (via their JWT).
 * All queries run under RLS as that user, so ownership checks are enforced
 * by the database. No service role key needed.
 */
export function getUserClient(accessToken: string): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase env vars');
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/** Extracts and validates the Bearer token from a request. Returns null if absent. */
export function getToken(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return token || null;
}
