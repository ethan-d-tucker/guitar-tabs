export type SongAnnotations = Record<string, string>;

export interface Song {
  id: number;
  title: string;
  artist: string;
  type: 'chords' | 'tab' | 'both';
  sourceUrl: string | null;
  rawContent: string;
  transposeOffset: number;
  capo: number;
  tuning: string;
  sortOrder: number;
  createdAt: string;
  annotations: SongAnnotations;
}

export interface NewSong {
  title: string;
  artist: string;
  type: 'chords' | 'tab' | 'both';
  sourceUrl: string | null;
  rawContent: string;
  capo: number;
  tuning: string;
}

export interface ScrapedSong {
  title: string;
  artist: string;
  type: string;
  rawContent: string;
  capo: number;
  tuning: string;
}

export interface Setlist {
  id: number;
  name: string;
  createdAt: string;
}

export interface SetlistSong {
  setlistId: number;
  songId: number;
  sortOrder: number;
}
