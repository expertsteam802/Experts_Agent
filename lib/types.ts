export interface GeneratedFile {
  [filename: string]: string;
}

export interface GenerationResult {
  summary: string;
  files: GeneratedFile;
}

export interface PublishedApp {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  files: GeneratedFile;
  user_id: string;
  is_published: boolean;
  generation_count: number;
  github_repo: string | null;
  github_url: string | null;
  github_pages_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiGeneration {
  id: string;
  user_id: string;
  app_id: string | null;
  prompt: string;
  summary: string | null;
  file_count: number;
  created_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  summary?: string;
}
