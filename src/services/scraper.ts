import { Platform } from 'react-native';
import type { ScrapedSong } from '../models/Song';

// ─── Shared helpers (used by scraper + search) ───

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)));
}

export async function fetchUGPage(url: string, options?: { desktop?: boolean }): Promise<string> {
  const fetchUrl = Platform.OS === 'web'
    ? `/api/ug-proxy?url=${encodeURIComponent(url)}`
    : url;

  const userAgent = options?.desktop
    ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    : 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

  const response = await fetch(fetchUrl, {
    headers: Platform.OS === 'web' ? {} : {
      'User-Agent': userAgent,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page (${response.status}). Try pasting the content manually.`);
  }

  return response.text();
}

export function extractJsStoreData(html: string): any {
  const match = html.match(/class="js-store"[^>]*data-content="([^"]+)"/);
  const jsStoreData = match ? decodeHtmlEntities(match[1]) : null;
  if (!jsStoreData) {
    throw new Error('Could not find data on this page.');
  }

  try {
    return JSON.parse(jsStoreData);
  } catch {
    throw new Error('Failed to parse page data.');
  }
}

// ─── Tab scraper ───

export async function scrapeUltimateGuitar(url: string): Promise<ScrapedSong> {
  const html = await fetchUGPage(url);
  return parseUGHtml(html);
}

export function parseUGHtml(html: string): ScrapedSong {
  const store = extractJsStoreData(html);

  const pageData = store?.store?.page?.data;
  if (!pageData) {
    throw new Error('Unexpected page structure. Try pasting the content manually.');
  }

  const tabView = pageData.tab_view;
  const tabMeta = pageData.tab;

  if (!tabView?.wiki_tab?.content) {
    throw new Error('No tab content found. Make sure this is a chords or tab page.');
  }

  const rawContent = tabView.wiki_tab.content;
  const title = tabMeta?.song_name || 'Unknown Title';
  const artist = tabMeta?.artist_name || 'Unknown Artist';
  const typeName = (tabMeta?.type_name || 'Chords').toLowerCase();

  let type: 'chords' | 'tab' | 'both' = 'chords';
  if (typeName.includes('tab')) {
    type = 'tab';
  }
  if (rawContent.includes('[ch]') && rawContent.includes('[tab]')) {
    type = 'both';
  }

  const capo = tabView.meta?.capo ?? 0;
  const tuning = tabView.meta?.tuning?.value ?? 'Standard';

  return { title, artist, type, rawContent, capo, tuning };
}
