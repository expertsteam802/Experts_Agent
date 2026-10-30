import { NextRequest, NextResponse } from 'next/server';
import { getUserClient, getToken } from '@/lib/supabase-server';

const GH_API = 'https://api.github.com';

interface TreeItem {
  path: string;
  mode: '100644' | '100755' | '040000' | '160000';
  type: 'blob' | 'tree' | 'commit';
  content?: string;
}

const DEPLOY_WORKFLOW = `name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - id: deployment
        uses: actions/deploy-pages@v4
`;

const README = (title: string) => `# ${title}

Generated with Experts Team AI Web Builder — Creator: Chris Expert (M.Chris.T)

## Live URL
Once GitHub Pages is enabled (Settings > Pages > Source: GitHub Actions), your site will be live at:
https://<username>.github.io/<repo>/

## Local Development
Open \`index.html\` in your browser.
`;

async function gh(url: string, token: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status} at ${url}: ${text}`);
  }
  return res;
}

export async function POST(req: NextRequest) {
  try {
    const token = getToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const supabase = getUserClient(token);
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { githubToken, repoName, files, title, appId } = body as {
      githubToken: string;
      repoName: string;
      files: Record<string, string>;
      title: string;
      appId: string;
    };

    if (!githubToken || !repoName || !files || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const userRes = await gh(`${GH_API}/user`, githubToken);
    const user = await userRes.json();
    const owner: string = user.login;

    let repo: { full_name: string; html_url: string; default_branch: string };
    const existingRes = await fetch(`${GH_API}/repos/${owner}/${repoName}`, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (existingRes.status === 404) {
      const createRes = await gh(`${GH_API}/user/repos`, githubToken, {
        method: 'POST',
        body: JSON.stringify({
          name: repoName,
          description: `Generated with Experts Team AI Web Builder`,
          private: false,
          auto_init: false,
        }),
      });
      repo = await createRes.json();
    } else if (existingRes.ok) {
      repo = await existingRes.json();
    } else {
      const t = await existingRes.text();
      throw new Error(`GitHub repo lookup failed: ${t}`);
    }

    const ownerLogin = repo.full_name.split('/')[0];
    const branch = repo.default_branch || 'main';

    let baseSha: string | null = null;
    const refRes = await fetch(`${GH_API}/repos/${repo.full_name}/git/refs/heads/${branch}`, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (refRes.ok) {
      const ref = await refRes.json();
      baseSha = ref.object.sha;
    }

    const allFiles: Record<string, string> = {
      ...files,
      'README.md': README(title),
      '.github/workflows/deploy.yml': DEPLOY_WORKFLOW,
    };

    const treeItems: TreeItem[] = Object.entries(allFiles).map(([path, content]) => ({
      path,
      mode: '100644',
      type: 'blob',
      content,
    }));

    const treeRes = await gh(`${GH_API}/repos/${repo.full_name}/git/trees`, githubToken, {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseSha ?? undefined,
        tree: treeItems,
      }),
    });
    const tree = await treeRes.json();

    const commitRes = await gh(`${GH_API}/repos/${repo.full_name}/git/commits`, githubToken, {
      method: 'POST',
      body: JSON.stringify({
        message: `Initial deploy from Experts Team AI Builder`,
        tree: tree.sha,
        parents: baseSha ? [baseSha] : [],
      }),
    });
    const commit = await commitRes.json();

    if (baseSha) {
      await gh(`${GH_API}/repos/${repo.full_name}/git/refs/heads/${branch}`, githubToken, {
        method: 'PATCH',
        body: JSON.stringify({ sha: commit.sha, force: true }),
      });
    } else {
      await gh(`${GH_API}/repos/${repo.full_name}/git/refs`, githubToken, {
        method: 'POST',
        body: JSON.stringify({
          ref: `refs/heads/${branch}`,
          sha: commit.sha,
        }),
      });
    }

    const pagesUrl = `https://${ownerLogin}.github.io/${repoName}/`;

    if (appId) {
      await supabase
        .from('published_apps')
        .update({
          github_repo: repo.full_name,
          github_url: repo.html_url,
          github_pages_url: pagesUrl,
        })
        .eq('id', appId);
    }

    return NextResponse.json({
      repo_url: repo.html_url,
      repo_full_name: repo.full_name,
      pages_url: pagesUrl,
      owner: ownerLogin,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
