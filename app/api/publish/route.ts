import { NextRequest, NextResponse } from 'next/server';
import { getUserClient, getToken } from '@/lib/supabase-server';
import { makeSlug } from '@/lib/constants';

export async function POST(req: NextRequest) {
  try {
    const token = getToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = getUserClient(token);
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, summary, files, appId, action } = body as {
      title: string;
      summary?: string;
      files: Record<string, string>;
      appId?: string;
      action: 'publish' | 'unpublish';
    };

    if (!title || !files) {
      return NextResponse.json({ error: 'Missing title or files' }, { status: 400 });
    }

    const isPublished = action === 'publish';

    if (appId) {
      const { data: updated, error } = await supabase
        .from('published_apps')
        .update({
          title,
          summary: summary ?? null,
          files,
          is_published: isPublished,
        })
        .eq('id', appId)
        .select()
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json({ app: updated });
    }

    const slug = makeSlug(title);
    const { data: created, error } = await supabase
      .from('published_apps')
      .insert({
        title,
        summary: summary ?? null,
        files,
        slug,
        is_published: isPublished,
      })
      .select()
      .maybeSingle();
    if (error) throw error;

    return NextResponse.json({ app: created });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
