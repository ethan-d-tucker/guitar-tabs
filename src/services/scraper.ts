import { Platform } from 'react-native';
import type { ScrapedSong } from '../models/Song';

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)));
}

export async function scrapeUltimateGuitar(url: string): Promise<ScrapedSong> {
  // On web, browsers block cross-origin requests (CORS).
  // Use a CORS proxy to fetch the page.
  const fetchUrl = Platform.OS === 'web'
    ? `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
    : url;

  const response = await fetch(fetchUrl, {
    headers: Platform.OS === 'web' ? {} : {
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page (${response.status}). Try pasting the content manually.`);
  }

  const html = await response.text();
  return parseUGHtml(html);
}

export function parseUGHtml(html: string): ScrapedSong {
  // UG stores tab data in a div.js-store data-content attribute as JSON.
  // Extract the data-content attribute from the .js-store element using regex.
  const match = html.match(/class="js-store"[^>]*data-content="([^"]+)"/);
  const jsStoreData = match ? decodeHtmlEntities(match[1]) : null;
  if (!jsStoreData) {
    throw new Error('Could not find tab data on this page. Try pasting the content manually.');
  }

  let store: any;
  try {
    store = JSON.parse(jsStoreData);
  } catch {
    throw new Error('Failed to parse tab data. Try pasting the content manually.');
  }

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
