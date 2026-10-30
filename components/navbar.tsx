'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Sparkles, LayoutDashboard, LogOut, Shield } from 'lucide-react';

export function Navbar() {
  const { user, loading, isAdminUser, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-white">
          <Sparkles className="h-5 w-5 text-emerald-400" />
          <span className="font-semibold">Experts Team</span>
        </Link>
        <nav className="flex items-center gap-2">
          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded bg-slate-800" />
          ) : user ? (
            <>
              <Button asChild variant="ghost" size="sm" className="text-slate-300 hover:text-white">
                <Link href="/dashboard"><LayoutDashboard className="mr-2 h-4 w-4" />My Apps</Link>
              </Button>
              {isAdminUser && (
                <Button asChild variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300">
                  <Link href="/admin"><Shield className="mr-2 h-4 w-4" />Admin</Link>
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={signOut} className="text-slate-300 hover:text-white">
                <LogOut className="mr-2 h-4 w-4" />Sign out
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="text-slate-300 hover:text-white">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-500">
                <Link href="/signup">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}