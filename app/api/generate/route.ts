import { NextRequest, NextResponse } from 'next/server';
import { getUserClient, getToken } from '@/lib/supabase-server';
import type { GenerationResult } from '@/lib/types';

function parseResult(raw: string): GenerationResult {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed.files || typeof parsed.files !== 'object') {
      throw new Error('Missing "files" object in AI response');
    }
    if (!parsed.files['index.html']) {
      const keys = Object.keys(parsed.files);
      const htmlKey = keys.find((k) => k.endsWith('.html')) ?? keys[0];
      if (htmlKey && htmlKey !== 'index.html') {
        parsed.files['index.html'] = parsed.files[htmlKey];
        delete parsed.files[htmlKey];
      }
    }
    return {
      summary: parsed.summary ?? 'Generated app',
      files: parsed.files,
    };
  } catch (e) {
    throw new Error('Failed to parse AI response as JSON: ' + (e as Error).message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = getUserClient(token);
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const { prompt, rawContent } = body as { prompt: string; rawContent: string };

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (!rawContent || typeof rawContent !== 'string') {
      return NextResponse.json({ error: 'AI content is required' }, { status: 400 });
    }

    const result = parseResult(rawContent);

    const { error: insertError } = await supabase.from('ai_generations').insert({
      user_id: userId,
      prompt,
      summary: result.summary,
      file_count: Object.keys(result.files).length,
    });

    if (insertError) {
      console.error('Failed to log generation:', insertError.message);
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
