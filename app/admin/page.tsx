'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Shield, Trash2, ExternalLink, Github, Eye } from 'lucide-react';
import type { PublishedApp } from '@/lib/types';

export default function AdminPage() {
  const { user, loading: authLoading, isAdminUser } = useAuth();
  const router = useRouter();
  const [apps, setApps] = useState<PublishedApp[]>([]);
  const [totalGenerations, setTotalGenerations] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isAdminUser)) {
      router.replace('/');
    }
  }, [authLoading, user, isAdminUser, router]);

  useEffect(() => {
    if (!user || !isAdminUser) return;
    const fetchData = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const res = await fetch('/api/admin', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setApps(data.apps ?? []);
      setTotalGenerations(data.totalGenerations ?? 0);
      setLoading(false);
    };
    fetchData();
  }, [user, isAdminUser]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch('/api/admin', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ appId: id }),
    });
    if (res.ok) {
      setApps((a) => a.filter((app) => app.id !== id));
    }
    setDeleting(null);
  };

  if (authLoading || (!user && !isAdminUser)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-7 w-7 text-amber-400" />
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mb-8">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <p className="text-sm text-slate-400">Total Published Apps</p>
              <p className="text-3xl font-bold text-white mt-1">{loading ? '...' : apps.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <p className="text-sm text-slate-400">Total AI Generations</p>
              <p className="text-3xl font-bold text-white mt-1">{loading ? '...' : totalGenerations}</p>
            </CardContent>
          </Card>
        </div>

        <h2 className="text-lg font-semibold text-white mb-4">All Published Apps</h2>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40 bg-slate-800" />
            ))}
          </div>
        ) : apps.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="py-12 text-center text-slate-400">No apps published yet.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => (
              <Card key={app.id} className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-white truncate">{app.title}</h3>
                    {app.is_published ? (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">Live</span>
                    ) : (
                      <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">Draft</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-3 truncate">/{app.slug}</p>
                  <p className="text-sm text-slate-400 mb-3 line-clamp-2">{app.summary ?? 'No description'}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {app.is_published && (
                      <Button asChild size="sm" variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-800">
                        <a href={`/apps/${app.slug}`} target="_blank" rel="noreferrer"><Eye className="mr-1 h-3 w-3" />View</a>
                      </Button>
                    )}
                    {app.github_url && (
                      <Button asChild size="sm" variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-800">
                        <a href={app.github_url} target="_blank" rel="noreferrer"><Github className="mr-1 h-3 w-3" /></a>
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