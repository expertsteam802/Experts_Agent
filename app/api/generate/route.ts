import { NextRequest, NextResponse } from 'next/server';
import { getUserClient, getToken } from '@/lib/supabase-server';
import { getSystemPrompt, type AiMode } from '@/lib/constants';
import type { GenerationResult } from '@/lib/types';

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function buildUserPrompt(prompt: string, existingFiles?: Record<string, string>): string {
  if (existingFiles && Object.keys(existingFiles).length > 0) {
    return `The user wants to modify their existing app. Here is the request:

"${prompt}"

Here are the current files:
${Object.entries(existingFiles)
  .map(([name, content]) => `--- FILE: ${name} ---\n${content}`)
  .join('\n\n')}

Return the COMPLETE updated files (all of them, fully rewritten) with the requested changes applied.`;
  }
  return `Build a complete website for this request:

"${prompt}"

Return the complete index.html file.`;
}

async function callGemini(
  mode: AiMode,
  prompt: string,
  existingFiles?: Record<string, string>,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured. Add it to your environment variables.');

  const systemPrompt = getSystemPrompt(mode);
  const userPrompt = buildUserPrompt(prompt, existingFiles);

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        topP: 0.9,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const content: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  if (!content) {
    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason === 'MAX_TOKENS') {
      throw new Error('The AI response was too long and got cut off. Try asking for something simpler, or break your request into smaller steps.');
    }
    throw new Error('The AI returned an empty response. Please try again.');
  }

  return content;
}

function parseResult(raw: string): GenerationResult {
  let cleaned = raw.trim();

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.files && typeof parsed.files === 'object') {
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
    }
  } catch {
    // JSON parse failed — fall through to raw HTML extraction
  }

  const htmlMatch = cleaned.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);
  if (htmlMatch) {
    return {
      summary: 'Generated app',
      files: { 'index.html': htmlMatch[0] },
    };
  }

  if (cleaned.includes('<html') || cleaned.includes('<body') || cleaned.includes('<div')) {
    return {
      summary: 'Generated app',
      files: { 'index.html': cleaned.startsWith('<') ? cleaned : `<!DOCTYPE html><html><head><meta charset="utf-8"><script src="https://cdn.tailwindcss.com"></script></head><body>${cleaned}</body></html>` },
    };
  }

  throw new Error('Could not parse the AI response. Please try again or rephrase your request.');
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
    const { prompt, mode, files } = body as {
      prompt: string;
      mode?: AiMode;
      files?: Record<string, string>;
    };

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const aiMode: AiMode = mode ?? 'agent';

    let raw: string;
    try {
      raw = await callGemini(aiMode, prompt, files);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI generation failed';
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const result = parseResult(raw);

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
