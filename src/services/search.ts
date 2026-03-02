import { fetchUGPage, extractJsStoreData } from './scraper';
import type { SearchResult } from '../models/Song';

const ALLOWED_TYPES = new Set(['Chords', 'Tab', 'Tabs', 'Ukulele Chords', 'Bass Tabs']);

export async function searchUltimateGuitar(query: string): Promise<SearchResult[]> {
  const searchUrl = `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(query)}`;

  let html: string;
  try {
    // Desktop UA is required — mobile site loads search results client-side
    html = await fetchUGPage(searchUrl, { desktop: true });
  } catch {
    throw new Error('Could not reach Ultimate Guitar. Check your connection and try again.');
  }

  let store: any;
  try {
    store = extractJsStoreData(html);
  } catch {
    throw new Error('Could not parse search results. Ultimate Guitar may be temporarily unavailable. Try using the URL or manual paste instead.');
  }

  const data = store?.store?.page?.data;
  const results = data?.results;

  if (!Array.isArray(results) || results.length === 0) {
    return [];
  }

  return results
    .filter((r: any) => {
      // Skip "official" / "TabPro" marketing entries (they link to UG Pro, not free tabs)
      if (r.marketing_type === 'official' || r.marketing_type === 'TabPro') return false;
      const typeName = r.type || '';
      return ALLOWED_TYPES.has(typeName);
    })
    .map((r: any): SearchResult => ({
      title: r.song_name || 'Unknown',
      artist: r.artist_name || 'Unknown',
      url: r.tab_url || '',
      type: r.type || 'Chords',
      rating: r.rating ?? 0,
      votes: r.votes ?? 0,
    }))
    .filter((r: SearchResult) => r.url)
    .sort((a: SearchResult, b: SearchResult) => b.rating - a.rating);
}
