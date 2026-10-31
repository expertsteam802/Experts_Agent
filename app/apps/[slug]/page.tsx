import { getSupabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps) {
  const supabaseServer = getSupabaseServer();
  const { data } = await supabaseServer
    .from('published_apps')
    .select('title, summary')
    .eq('slug', params.slug)
    .eq('is_published', true)
    .maybeSingle();
  if (!data) return { title: 'App not found — Experts Team' };
  return { title: `${data.title} — Experts Team`, description: data.summary ?? undefined };
}

export default async function PublicAppPage({ params }: PageProps) {
  const supabaseServer = getSupabaseServer();
  const { data } = await supabaseServer
    .from('published_apps')
    .select('files, title')
    .eq('slug', params.slug)
    .eq('is_published', true)
    .maybeSingle();

  if (!data) notFound();

  const html = (data.files as Record<string, string>)['index.html'] ?? '';

  return (
    <iframe
      srcDoc={html}
      title={data.title}
      className="fixed inset-0 w-full h-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-popups-to-escape-sandbox"
    />
  );
}
