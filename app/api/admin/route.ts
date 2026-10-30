import { NextRequest, NextResponse } from 'next/server';
import { getUserClient, getToken } from '@/lib/supabase-server';
import { isAdmin } from '@/lib/constants';

export async function GET(req: NextRequest) {
  try {
    const token = getToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = getUserClient(token);
    const { data: userData, error } = await supabase.auth.getUser(token);
    if (error || !userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!isAdmin(userData.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Admin needs to see ALL apps and generations, not just their own.
    // RLS will only return the admin's own rows via the user client.
    // We need a separate approach: query via the anon client won't work either.
    // Instead, we query published apps (anon can read published ones) plus
    // the admin's own apps, and count generations by querying with a filter.
    // For a proper admin view we'd need the service role key. As a fallback,
    // we show all PUBLISHED apps (readable by anon) plus the admin's own drafts.
    const { getSupabaseServer } = await import('@/lib/supabase-server');
    const anonClient = getSupabaseServer();

    const [publishedRes, ownAppsRes, ownGenRes] = await Promise.all([
      anonClient.from('published_apps').select('*').eq('is_published', true).order('created_at', { ascending: false }),
      supabase.from('published_apps').select('*').order('created_at', { ascending: false }),
      supabase.from('ai_generations').select('id, created_at').order('created_at', { ascending: false }),
    ]);

    // Merge: all published apps + admin's own (including drafts), deduplicated by id
    const allApps = [...(publishedRes.data ?? [])];
    for (const app of ownAppsRes.data ?? []) {
      if (!allApps.find((a) => a.id === app.id)) {
        allApps.push(app);
      }
    }

    return NextResponse.json({
      apps: allApps,
      totalGenerations: ownGenRes.data?.length ?? 0,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = getToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = getUserClient(token);
    const { data: userData, error } = await supabase.auth.getUser(token);
    if (error || !userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!isAdmin(userData.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { appId } = await req.json();
    if (!appId) return NextResponse.json({ error: 'Missing appId' }, { status: 400 });

    // Admin can delete any app — but RLS only allows deleting own rows.
    // Unpublish first (update is_published=false which is also RLS-scoped to owner),
    // then attempt delete. If the admin doesn't own the app, we need the anon client
    // which can only read published apps. This is a limitation without service role key.
    // For now: try delete via user client (works for admin's own apps).
    const { error: delError } = await supabase.from('published_apps').delete().eq('id', appId);
    if (delError) {
      return NextResponse.json({ error: `Delete failed (admin can only delete own apps without service role key): ${delError.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
