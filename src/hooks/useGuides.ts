import { useState, useEffect } from 'react';
import guidesIndex from '../data/guides-index.json';

export interface GuideMeta {
  slug: string;
  title: string;
  game: string;
  tags: string[];
  created: string;
  externalUrl?: string;
}

export interface GuideContent {
  meta: GuideMeta;
  body: string;
}

async function parseFrontmatter(raw: string): Promise<{ meta: GuideMeta; body: string }> {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { meta: { slug: '', title: '', game: '', tags: [], created: '' }, body: raw };
  }
  const fm = match[1];
  const body = match[2];
  const meta: Record<string, unknown> = {};
  for (const line of fm.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let val: unknown = line.slice(colonIdx + 1).trim();
    if (Array.isArray(val) || typeof val === 'object') {
      meta[key] = val;
    } else {
      const str = String(val);
      if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
        val = str.slice(1, -1);
      }
      if (str.startsWith('[') && str.endsWith(']')) {
        const inner = str.slice(1, -1);
        val = inner
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''));
      }
      meta[key] = val;
    }
  }
  return {
    meta: {
      slug: '',
      title: String(meta.title ?? ''),
      game: String(meta.game ?? ''),
      tags: (Array.isArray(meta.tags) ? meta.tags : []) as string[],
      created: String(meta.created ?? ''),
    },
    body,
  };
}

async function loadGuideList(): Promise<GuideMeta[]> {
  return guidesIndex as GuideMeta[];
}

async function loadGuideContent(slug: string): Promise<GuideContent> {
  const res = await fetch(`/guides/${slug}.md`);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('攻略文件不存在（404）');
    }
    throw new Error(`加载失败（${res.status}）`);
  }
  const raw = await res.text();
  const parsed = await parseFrontmatter(raw);
  parsed.meta.slug = slug;
  return { meta: parsed.meta, body: parsed.body };
}

export function useGuideList() {
  const [guides, setGuides] = useState<GuideMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGuideList()
      .then((data) => {
        setGuides(data);
        setError(null);
      })
      .catch((e) => {
        setGuides([]);
        setError(e instanceof Error ? e.message : '加载攻略列表失败');
      })
      .finally(() => setLoading(false));
  }, []);

  return { guides, loading, error };
}

export function useGuide(slug: string) {
  const [guide, setGuide] = useState<GuideContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setGuide(null);

    loadGuideContent(slug)
      .then((data) => {
        setGuide(data);
        setError(null);
      })
      .catch((e) => {
        setGuide(null);
        if (e instanceof TypeError && e.message === 'Failed to fetch') {
          setError('网络连接失败，请检查网络后重试');
        } else {
          setError(e instanceof Error ? e.message : '攻略加载失败');
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  return { guide, loading, error };
}
