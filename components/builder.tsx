'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase';
import { AI_SYSTEM_PROMPT } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Send,
  Sparkles,
  Monitor,
  Tablet,
  Smartphone,
  Code2,
  Eye,
  Terminal,
  Copy,
  Check,
  Rocket,
  Github,
  Loader2,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import type { ChatMessage, GeneratedFile } from '@/lib/types';

type Device = 'desktop' | 'tablet' | 'mobile';
type ViewTab = 'preview' | 'code' | 'console';

interface ConsoleEntry {
  type: 'error' | 'warn' | 'info' | 'log';
  message: string;
}

const DEVICE_WIDTHS: Record<Device, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

export function Builder() {
  const { user, loading: authLoading } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [files, setFiles] = useState<GeneratedFile>({});
  const [summary, setSummary] = useState('');
  const [generating, setGenerating] = useState(false);
  const [device, setDevice] = useState<Device>('desktop');
  const [view, setView] = useState<ViewTab>('preview');
  const [activeFile, setActiveFile] = useState('index.html');
  const [copied, setCopied] = useState(false);
  const [appId, setAppId] = useState<string | null>(null);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [githubOpen, setGithubOpen] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [repoName, setRepoName] = useState('');
  const [pushing, setPushing] = useState(false);
  const [githubResult, setGithubResult] = useState<{ repo_url: string; pages_url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewKey, setPreviewKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const htmlFile = files['index.html'] ?? '';
  const fileNames = Object.keys(files);

  useEffect(() => {
    if (fileNames.length > 0 && !fileNames.includes(activeFile)) {
      setActiveFile(fileNames[0]);
    }
  }, [fileNames, activeFile]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPreviewHtml(htmlFile);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [htmlFile]);

  const getSession = () => supabase.auth.getSession();

  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return;
    const userMsg: ChatMessage = { role: 'user', content: prompt };
    setMessages((m) => [...m, userMsg]);
    setGenerating(true);
    setError(null);

    try {
      const { data: sessionData } = await getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setError('Please sign in to generate.');
        return;
      }

      const userContent =
        Object.keys(files).length > 0
          ? `The user wants to modify their existing app. Here is the request:\n\n"${prompt}"\n\nHere are the current files:\n${Object.entries(files)
              .map(([name, content]) => `--- FILE: ${name} ---\n${content}`)
              .join('\n\n')}\n\nReturn the COMPLETE updated files with the requested changes applied.`
          : `Build a complete website for this request:\n\n"${prompt}"\n\nReturn the complete index.html file.`;

      const aiRes = await fetch('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai',
          messages: [
            { role: 'system', content: AI_SYSTEM_PROMPT },
            { role: 'user', content: userContent },
          ],
          temperature: 0.7,
          max_tokens: 16000,
        }),
      });

      if (!aiRes.ok) {
        const errBody = await aiRes.json().catch(() => ({}));
        throw new Error(errBody?.error?.message || `AI request failed (${aiRes.status})`);
      }

      const aiData = await aiRes.json();
      const rawContent: string = aiData.choices?.[0]?.message?.content ?? '';

      if (!rawContent) {
        throw new Error('The AI returned an empty response. Please try again.');
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt,
          rawContent,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Generation failed (${res.status})`);
      }

      const data = await res.json();
      setFiles(data.files);
      setSummary(data.summary);
      setPreviewHtml(data.files['index.html'] ?? '');
      setPreviewKey((k) => k + 1);
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: data.summary, summary: data.summary },
      ]);
      setConsoleEntries([]);
      setView('preview');
      setPrompt('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Generation failed';
      setError(msg);
      setMessages((m) => [...m, { role: 'assistant', content: `Error: ${msg}` }]);
    } finally {
      setGenerating(false);
    }
  };

  const handleIframeLoad = () => {
    try {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow) return;
      const win = iframe.contentWindow as (Window & typeof globalThis) & { __errorListener?: boolean };
      if (!win || win.__errorListener) return;
      win.addEventListener('error', (e: ErrorEvent) => {
        setConsoleEntries((c) => [
          ...c,
          { type: 'error', message: e.message || 'Unknown runtime error' },
        ]);
      });
      const origLog = win.console.log;
      const origErr = win.console.error;
      win.console.log = (...args: unknown[]) => {
        setConsoleEntries((c) => [...c, { type: 'log', message: args.join(' ') }]);
        origLog.apply(win.console, args as never);
      };
      win.console.error = (...args: unknown[]) => {
        setConsoleEntries((c) => [...c, { type: 'error', message: args.join(' ') }]);
        origErr.apply(win.console, args as never);
      };
      win.__errorListener = true;
    } catch {
      // cross-origin or not ready
    }
  };

  const copyFile = async () => {
    await navigator.clipboard.writeText(files[activeFile] ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const editFile = (content: string) => {
    setFiles((f) => ({ ...f, [activeFile]: content }));
  };

  const refreshPreview = () => {
    setRefreshing(true);
    setPreviewHtml(htmlFile);
    setPreviewKey((k) => k + 1);
    setConsoleEntries([]);
    setTimeout(() => setRefreshing(false), 500);
  };

  const handlePublish = async () => {
    if (Object.keys(files).length === 0) return;
    setPublishing(true);
    setError(null);
    try {
      const { data: sessionData } = await getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Please sign in to publish.');

      const title = messages.find((m) => m.role === 'user')?.content?.slice(0, 60) || 'My App';
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          summary,
          files,
          appId,
          action: 'publish',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Publish failed');
      }
      const data = await res.json();
      if (data.app?.id) setAppId(data.app.id);
      setPublishedUrl(`${window.location.origin}/apps/${data.app.slug}`);
      setPublishOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  const handleGithubPush = async () => {
    if (!githubToken || !repoName || Object.keys(files).length === 0) return;
    setPushing(true);
    setError(null);
    setGithubResult(null);
    try {
      const { data: sessionData } = await getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Please sign in.');
      const title = messages.find((m) => m.role === 'user')?.content?.slice(0, 60) || 'My App';
      const res = await fetch('/api/github/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          githubToken,
          repoName,
          files,
          title,
          appId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'GitHub push failed');
      }
      const data = await res.json();
      setGithubResult({ repo_url: data.repo_url, pages_url: data.pages_url });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'GitHub push failed');
    } finally {
      setPushing(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-slate-950 text-center px-4">
        <Sparkles className="h-12 w-12 text-emerald-400 mb-4" />
        <h1 className="text-3xl font-bold text-white mb-2">Build apps with AI</h1>
        <p className="text-slate-400 mb-6 max-w-md">
          Experts Team is an AI web builder. Sign in to describe what you want and get a live website instantly.
        </p>
        <div className="flex gap-3">
          <Button asChild className="bg-emerald-600 hover:bg-emerald-500">
            <a href="/signup">Get started</a>
          </Button>
          <Button asChild variant="outline" className="border-slate-700 text-slate-200">
            <a href="/login">Sign in</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-slate-950">
      {/* Chat sidebar */}
      <div className="flex w-[340px] flex-col border-r border-slate-800">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-slate-500 mt-8 px-4">
              <Sparkles className="h-8 w-8 mx-auto mb-3 text-emerald-400" />
              <p className="text-sm">Describe the website you want to build. The AI will generate a complete, working site.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-lg p-3 text-sm ${
                m.role === 'user'
                  ? 'bg-emerald-600/20 border border-emerald-600/30 text-slate-100'
                  : 'bg-slate-900 border border-slate-800 text-slate-300'
              }`}
            >
              {m.content}
            </div>
          ))}
          {generating && (
            <div className="flex items-center gap-2 text-slate-400 text-sm px-3">
              <Loader2 className="h-4 w-4 animate-spin" /> Generating...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="border-t border-slate-800 p-3">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your app or request changes..."
            className="bg-slate-900 border-slate-700 text-white resize-none mb-2"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleGenerate();
              }
            }}
          />
          <Button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-500"
          >
            <Send className="mr-2 h-4 w-4" /> Generate
          </Button>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
          <div className="flex items-center gap-1">
            <Button
              variant={view === 'preview' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('preview')}
              className={view === 'preview' ? 'bg-slate-800 text-white' : 'text-slate-400'}
            >
              <Eye className="mr-2 h-4 w-4" />Preview
            </Button>
            <Button
              variant={view === 'code' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('code')}
              className={view === 'code' ? 'bg-slate-800 text-white' : 'text-slate-400'}
            >
              <Code2 className="mr-2 h-4 w-4" />Code
            </Button>
            <Button
              variant={view === 'console' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('console')}
              className={view === 'console' ? 'bg-slate-800 text-white' : 'text-slate-400'}
            >
              <Terminal className="mr-2 h-4 w-4" />Console
              {consoleEntries.some((e) => e.type === 'error') && (
                <span className="ml-1 h-2 w-2 rounded-full bg-red-500" />
              )}
            </Button>
          </div>

          <div className="flex items-center gap-1">
            {view === 'preview' && (
              <>
                <Button
                  variant={device === 'desktop' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setDevice('desktop')}
                  className={device === 'desktop' ? 'bg-slate-800 text-white' : 'text-slate-400'}
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  variant={device === 'tablet' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setDevice('tablet')}
                  className={device === 'tablet' ? 'bg-slate-800 text-white' : 'text-slate-400'}
                >
                  <Tablet className="h-4 w-4" />
                </Button>
                <Button
                  variant={device === 'mobile' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setDevice('mobile')}
                  className={device === 'mobile' ? 'bg-slate-800 text-white' : 'text-slate-400'}
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
                <div className="mx-2 h-5 w-px bg-slate-800" />
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGithubOpen(true)}
              disabled={Object.keys(files).length === 0}
              className="border-slate-700 text-slate-200 hover:bg-slate-800"
            >
              <Github className="mr-2 h-4 w-4" />Push to GitHub
            </Button>
            <Button
              size="sm"
              onClick={() => setPublishOpen(true)}
              disabled={Object.keys(files).length === 0}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              <Rocket className="mr-2 h-4 w-4" />Publish
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {Object.keys(files).length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-600">
              <div className="text-center">
                <Sparkles className="h-12 w-12 mx-auto mb-4 text-slate-700" />
                <p>Your generated website will appear here.</p>
              </div>
            </div>
          ) : view === 'preview' ? (
            <div className="h-full flex flex-col bg-slate-900">
              <div className="flex items-center justify-center gap-2 border-b border-slate-800 px-4 py-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshPreview}
                  className="text-slate-400 hover:text-white"
                >
                  {refreshing ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1 h-3 w-3" />
                  )}
                  Refresh
                </Button>
                <span className="text-xs text-slate-600">
                  {previewHtml !== htmlFile ? '(unsaved changes)' : ''}
                </span>
              </div>
              <div className="flex-1 flex justify-center p-4 overflow-auto">
                <iframe
                  key={previewKey}
                  ref={iframeRef}
                  srcDoc={previewHtml}
                  onLoad={handleIframeLoad}
                  title="Preview"
                  className="h-full bg-white rounded-lg border border-slate-800 shadow-2xl transition-all"
                  style={{ width: DEVICE_WIDTHS[device], maxWidth: '100%' }}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              </div>
            </div>
          ) : view === 'code' ? (
            <div className="flex h-full">
              <div className="w-48 border-r border-slate-800 overflow-y-auto bg-slate-950">
                {fileNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => setActiveFile(name)}
                    className={`block w-full text-left px-3 py-2 text-sm truncate ${
                      activeFile === name
                        ? 'bg-slate-800 text-emerald-400'
                        : 'text-slate-400 hover:bg-slate-900'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1">
                  <span className="text-sm text-slate-400">{activeFile}</span>
                  <Button variant="ghost" size="sm" onClick={copyFile} className="text-slate-400">
                    {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <textarea
                  value={files[activeFile] ?? ''}
                  onChange={(e) => editFile(e.target.value)}
                  className="flex-1 w-full resize-none bg-slate-950 text-slate-200 p-4 font-mono text-sm outline-none"
                  spellCheck={false}
                />
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto bg-slate-950 p-4 font-mono text-sm">
              {consoleEntries.length === 0 ? (
                <p className="text-slate-600">No console output. Runtime errors will appear here.</p>
              ) : (
                consoleEntries.map((e, i) => (
                  <div
                    key={i}
                    className={`py-1 ${
                      e.type === 'error' ? 'text-red-400' : e.type === 'warn' ? 'text-amber-400' : 'text-slate-300'
                    }`}
                  >
                    <span className="text-slate-600 mr-2">[{e.type}]</span>
                    {e.message}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <Card className="bg-red-950 border-red-800">
            <CardContent className="py-3 px-4 text-sm text-red-200">
              {error}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Publish dialog */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Publish your app</DialogTitle>
            <DialogDescription className="text-slate-400">
              Publish your app to get a public live URL that anyone can view.
            </DialogDescription>
          </DialogHeader>
          {publishedUrl ? (
            <div className="space-y-3">
              <p className="text-emerald-400 text-sm">Your app is live!</p>
              <div className="flex items-center gap-2 rounded-lg bg-slate-800 p-3">
                <Input readOnly value={publishedUrl} className="bg-slate-950 border-slate-700 text-emerald-400" />
                <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-500">
                  <a href={publishedUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Click publish below to make your app live at a shareable URL.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)} className="border-slate-700 text-slate-200">
              Close
            </Button>
            {!publishedUrl && (
              <Button onClick={handlePublish} disabled={publishing} className="bg-emerald-600 hover:bg-emerald-500">
                {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Publish now
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GitHub dialog */}
      <Dialog open={githubOpen} onOpenChange={setGithubOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Push to GitHub</DialogTitle>
            <DialogDescription className="text-slate-400">
              Push your app to a new GitHub repo with a GitHub Pages deploy workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-200">GitHub Personal Access Token</Label>
              <Input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_..."
                className="bg-slate-800 border-slate-700 text-white"
              />
              <p className="text-xs text-slate-500">
                Needs repo scope. Your token is only used for this push and is never stored.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Repository name</Label>
              <Input
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="my-ai-app"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            {githubResult && (
              <div className="space-y-2 rounded-lg bg-slate-800 p-3 text-sm">
                <p className="text-emerald-400">Pushed successfully!</p>
                <a href={githubResult.repo_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sky-400 hover:underline">
                  <Github className="h-4 w-4" /> {githubResult.repo_url}
                </a>
                <p className="text-slate-400 text-xs">
                  Pages URL (enable Pages in repo settings, source: GitHub Actions):
                </p>
                <a href={githubResult.pages_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sky-400 hover:underline">
                  <ExternalLink className="h-4 w-4" /> {githubResult.pages_url}
                </a>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGithubOpen(false)} className="border-slate-700 text-slate-200">
              Close
            </Button>
            <Button onClick={handleGithubPush} disabled={pushing || !githubToken || !repoName} className="bg-emerald-600 hover:bg-emerald-500">
              {pushing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Github className="mr-2 h-4 w-4" />}
              Push to GitHub
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}