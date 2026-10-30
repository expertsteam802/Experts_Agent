'use client';

import { useEffect, useState } from 'react';
import { Navbar } from '@/components/navbar';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { ExternalLink, Github, Trash2, Eye, Loader2 } from 'lucide-react';
import type { PublishedApp } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function DashboardPage() {
  const { toast } = useToast();
  const [apps, setApps] = useState<PublishedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('published_apps')
      .select('*')
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          toast({ title: 'Error loading apps', description: error.message, variant: 'destructive' });
        } else {
          setApps((data as PublishedApp[]) ?? []);
        }
        setLoading(false);
      });
  }, [toast]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from('published_apps').delete().eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    } else {
      setApps((a) => a.filter((app) => app.id !== id));
      toast({ title: 'App deleted' });
    }
    setDeleting(null);
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">My Apps</h1>
            <p className="text-slate-400 text-sm mt-1">Your generated and published projects.</p>
          </div>
          <Button asChild className="bg-emerald-600 hover:bg-emerald-500">
            <Link href="/">New app</Link>
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40 bg-slate-800" />
            ))}
          </div>
        ) : apps.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-slate-400 mb-4">No apps yet. Build your first app with AI.</p>
              <Button asChild className="bg-emerald-600 hover:bg-emerald-500">
                <Link href="/">Start building</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => (
              <Card key={app.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-white truncate">{app.title}</h3>
                    {app.is_published ? (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">Live</span>
                    ) : (
                      <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">Draft</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 mb-3 line-clamp-2">{app.summary ?? 'No description'}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {app.is_published && (
                      <Button asChild size="sm" variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-800">
                        <a href={`/apps/${app.slug}`} target="_blank" rel="noreferrer">
                          <Eye className="mr-1 h-3 w-3" />View
                        </a>
                      </Button>
                    )}
                    {app.github_url && (
                      <Button asChild size="sm" variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-800">
                        <a href={app.github_url} target="_blank" rel="noreferrer">
                          <Github className="mr-1 h-3 w-3" />Repo
                        </a>
                      </Button>
                    )}
                    {app.github_pages_url && (
                      <Button asChild size="sm" variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-800">
                        <a href={app.github_pages_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1 h-3 w-3" />Pages
                        </a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(app.id)}
                      disabled={deleting === app.id}
                      className="text-red-400 hover:bg-red-950 hover:text-red-300"
                    >
                      {deleting === app.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}