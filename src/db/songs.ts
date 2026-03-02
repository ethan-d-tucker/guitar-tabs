import { Platform } from 'react-native';
import type { Song, NewSong, SongAnnotations, Setlist, SetlistSong } from '../models/Song';
import { getDatabase } from './native-db';

// On native, use SQLite. On web, use localStorage fallback.
const isWeb = Platform.OS === 'web';

// ─── Web (localStorage) storage ───

const STORAGE_KEY = 'guitar-tabs-songs';
const SETLISTS_STORAGE_KEY = 'guitar-tabs-setlists';
const SETLIST_SONGS_STORAGE_KEY = 'guitar-tabs-setlist-songs';

function getWebSongs(): Song[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWebSongs(songs: Song[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
}

function getWebSetlists(): Setlist[] {
  try {
    const raw = localStorage.getItem(SETLISTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWebSetlists(setlists: Setlist[]): void {
  localStorage.setItem(SETLISTS_STORAGE_KEY, JSON.stringify(setlists));
}

function getWebSetlistSongs(): SetlistSong[] {
  try {
    const raw = localStorage.getItem(SETLIST_SONGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWebSetlistSongs(entries: SetlistSong[]): void {
  localStorage.setItem(SETLIST_SONGS_STORAGE_KEY, JSON.stringify(entries));
}

let nextWebId = 1;
function initWebId(songs: Song[]) {
  if (songs.length > 0) {
    nextWebId = Math.max(...songs.map(s => s.id)) + 1;
  }
}

let nextWebSetlistId = 1;
function initWebSetlistId(setlists: Setlist[]) {
  if (setlists.length > 0) {
    nextWebSetlistId = Math.max(...setlists.map(s => s.id)) + 1;
  }
}

// ─── SQLite storage (native only, via ./native-db) ───

function mapRow(row: any): Song {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    type: row.type,
    sourceUrl: row.source_url,
    rawContent: row.raw_content,
    transposeOffset: row.transpose_offset,
    capo: row.capo,
    tuning: row.tuning,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    annotations: row.annotations ? JSON.parse(row.annotations) : {},
  };
}

// ─── Public API ───

export async function getAllSongs(): Promise<Song[]> {
  if (isWeb) {
    const songs = getWebSongs();
    initWebId(songs);
    return songs;
  }
  const database = await getDatabase();
  const rows: any[] = await database.getAllAsync('SELECT * FROM songs ORDER BY sort_order ASC');
  return rows.map(mapRow);
}

export async function getSongById(id: number): Promise<Song | null> {
  if (isWeb) {
    return getWebSongs().find(s => s.id === id) ?? null;
  }
  const database = await getDatabase();
  const row: any = await database.getFirstAsync('SELECT * FROM songs WHERE id = ?', [id]);
  return row ? mapRow(row) : null;
}

export async function addSong(song: NewSong): Promise<number> {
  if (isWeb) {
    const songs = getWebSongs();
    initWebId(songs);
    const newSong: Song = {
      id: nextWebId++,
      title: song.title,
      artist: song.artist,
      type: song.type,
      sourceUrl: song.sourceUrl,
      rawContent: song.rawContent,
      transposeOffset: 0,
      capo: song.capo,
      tuning: song.tuning,
      sortOrder: songs.length + 1,
      createdAt: new Date().toISOString(),
      annotations: {},
    };
    songs.push(newSong);
    saveWebSongs(songs);
    return newSong.id;
  }

  const database = await getDatabase();
  const maxOrder: any = await database.getFirstAsync(
    'SELECT COALESCE(MAX(sort_order), 0) as max_order FROM songs'
  );
  const nextOrder = (maxOrder?.max_order ?? 0) + 1;
  const result = await database.runAsync(
    `INSERT INTO songs (title, artist, type, source_url, raw_content, capo, tuning, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [song.title, song.artist, song.type, song.sourceUrl, song.rawContent, song.capo, song.tuning, nextOrder]
  );
  return result.lastInsertRowId;
}

export async function updateTranspose(id: number, offset: number): Promise<void> {
  if (isWeb) {
    const songs = getWebSongs();
    const song = songs.find(s => s.id === id);
    if (song) {
      song.transposeOffset = offset;
      saveWebSongs(songs);
    }
    return;
  }
  const database = await getDatabase();
  await database.runAsync('UPDATE songs SET transpose_offset = ? WHERE id = ?', [offset, id]);
}

export async function updateAnnotations(id: number, annotations: SongAnnotations): Promise<void> {
  if (isWeb) {
    const songs = getWebSongs();
    const song = songs.find(s => s.id === id);
    if (song) {
      song.annotations = annotations;
      saveWebSongs(songs);
    }
    return;
  }
  const database = await getDatabase();
  await database.runAsync('UPDATE songs SET annotations = ? WHERE id = ?', [JSON.stringify(annotations), id]);
}

export async function deleteSong(id: number): Promise<void> {
  if (isWeb) {
    const songs = getWebSongs().filter(s => s.id !== id);
    saveWebSongs(songs);
    // Clean up setlist memberships
    const entries = getWebSetlistSongs().filter(e => e.songId !== id);
    saveWebSetlistSongs(entries);
    return;
  }
  const database = await getDatabase();
  // CASCADE handles setlist_songs cleanup automatically
  await database.runAsync('DELETE FROM songs WHERE id = ?', [id]);
}

export async function reorderSongs(orderedIds: number[]): Promise<void> {
  if (isWeb) {
    const songs = getWebSongs();
    const reordered = orderedIds.map((id, i) => {
      const song = songs.find(s => s.id === id)!;
      return { ...song, sortOrder: i + 1 };
    });
    saveWebSongs(reordered);
    return;
  }
  const database = await getDatabase();
  for (let i = 0; i < orderedIds.length; i++) {
    await database.runAsync('UPDATE songs SET sort_order = ? WHERE id = ?', [i + 1, orderedIds[i]]);
  }
}

// ─── Setlist API ───

function mapSetlistRow(row: any): Setlist {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  };
}

export async function getAllSetlists(): Promise<Setlist[]> {
  if (isWeb) {
    const setlists = getWebSetlists();
    initWebSetlistId(setlists);
    return setlists;
  }
  const database = await getDatabase();
  const rows: any[] = await database.getAllAsync('SELECT * FROM setlists ORDER BY created_at ASC');
  return rows.map(mapSetlistRow);
}

export async function createSetlist(name: string): Promise<number> {
  if (isWeb) {
    const setlists = getWebSetlists();
    initWebSetlistId(setlists);
    const newSetlist: Setlist = {
      id: nextWebSetlistId++,
      name,
      createdAt: new Date().toISOString(),
    };
    setlists.push(newSetlist);
    saveWebSetlists(setlists);
    return newSetlist.id;
  }
  const database = await getDatabase();
  const result = await database.runAsync('INSERT INTO setlists (name) VALUES (?)', [name]);
  return result.lastInsertRowId;
}

export async function renameSetlist(id: number, newName: string): Promise<void> {
  if (isWeb) {
    const setlists = getWebSetlists();
    const setlist = setlists.find(s => s.id === id);
    if (setlist) {
      setlist.name = newName;
      saveWebSetlists(setlists);
    }
    return;
  }
  const database = await getDatabase();
  await database.runAsync('UPDATE setlists SET name = ? WHERE id = ?', [newName, id]);
}

export async function deleteSetlist(id: number): Promise<void> {
  if (isWeb) {
    const setlists = getWebSetlists().filter(s => s.id !== id);
    saveWebSetlists(setlists);
    const entries = getWebSetlistSongs().filter(e => e.setlistId !== id);
    saveWebSetlistSongs(entries);
    return;
  }
  const database = await getDatabase();
  // CASCADE handles setlist_songs cleanup
  await database.runAsync('DELETE FROM setlists WHERE id = ?', [id]);
}

export async function getSongsInSetlist(setlistId: number): Promise<Song[]> {
  if (isWeb) {
    const entries = getWebSetlistSongs()
      .filter(e => e.setlistId === setlistId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const songs = getWebSongs();
    return entries
      .map(e => songs.find(s => s.id === e.songId))
      .filter((s): s is Song => s !== undefined);
  }
  const database = await getDatabase();
  const rows: any[] = await database.getAllAsync(
    `SELECT s.* FROM songs s
     JOIN setlist_songs ss ON s.id = ss.song_id
     WHERE ss.setlist_id = ?
     ORDER BY ss.sort_order ASC`,
    [setlistId]
  );
  return rows.map(mapRow);
}

export async function addSongToSetlist(setlistId: number, songId: number): Promise<void> {
  if (isWeb) {
    const entries = getWebSetlistSongs();
    if (entries.some(e => e.setlistId === setlistId && e.songId === songId)) return;
    const maxOrder = entries
      .filter(e => e.setlistId === setlistId)
      .reduce((max, e) => Math.max(max, e.sortOrder), 0);
    entries.push({ setlistId, songId, sortOrder: maxOrder + 1 });
    saveWebSetlistSongs(entries);
    return;
  }
  const database = await getDatabase();
  const existing = await database.getFirstAsync(
    'SELECT 1 FROM setlist_songs WHERE setlist_id = ? AND song_id = ?',
    [setlistId, songId]
  );
  if (existing) return;
  const maxRow: any = await database.getFirstAsync(
    'SELECT COALESCE(MAX(sort_order), 0) as max_order FROM setlist_songs WHERE setlist_id = ?',
    [setlistId]
  );
  const nextOrder = (maxRow?.max_order ?? 0) + 1;
  await database.runAsync(
    'INSERT INTO setlist_songs (setlist_id, song_id, sort_order) VALUES (?, ?, ?)',
    [setlistId, songId, nextOrder]
  );
}

export async function removeSongFromSetlist(setlistId: number, songId: number): Promise<void> {
  if (isWeb) {
    const entries = getWebSetlistSongs().filter(
      e => !(e.setlistId === setlistId && e.songId === songId)
    );
    saveWebSetlistSongs(entries);
    return;
  }
  const database = await getDatabase();
  await database.runAsync(
    'DELETE FROM setlist_songs WHERE setlist_id = ? AND song_id = ?',
    [setlistId, songId]
  );
}

export async function reorderSetlistSongs(setlistId: number, orderedSongIds: number[]): Promise<void> {
  if (isWeb) {
    const entries = getWebSetlistSongs();
    const others = entries.filter(e => e.setlistId !== setlistId);
    const updated = orderedSongIds.map((songId, i) => ({
      setlistId,
      songId,
      sortOrder: i + 1,
    }));
    saveWebSetlistSongs([...others, ...updated]);
    return;
  }
  const database = await getDatabase();
  for (let i = 0; i < orderedSongIds.length; i++) {
    await database.runAsync(
      'UPDATE setlist_songs SET sort_order = ? WHERE setlist_id = ? AND song_id = ?',
      [i + 1, setlistId, orderedSongIds[i]]
    );
  }
}

export async function getSetlistsForSong(songId: number): Promise<Setlist[]> {
  if (isWeb) {
    const entries = getWebSetlistSongs().filter(e => e.songId === songId);
    const setlists = getWebSetlists();
    return entries
      .map(e => setlists.find(s => s.id === e.setlistId))
      .filter((s): s is Setlist => s !== undefined);
  }
  const database = await getDatabase();
  const rows: any[] = await database.getAllAsync(
    `SELECT sl.* FROM setlists sl
     JOIN setlist_songs ss ON sl.id = ss.setlist_id
     WHERE ss.song_id = ?`,
    [songId]
  );
  return rows.map(mapSetlistRow);
}

export async function setSongSetlists(songId: number, setlistIds: number[]): Promise<void> {
  if (isWeb) {
    const entries = getWebSetlistSongs().filter(e => e.songId !== songId);
    for (const setlistId of setlistIds) {
      const maxOrder = entries
        .filter(e => e.setlistId === setlistId)
        .reduce((max, e) => Math.max(max, e.sortOrder), 0);
      entries.push({ setlistId, songId, sortOrder: maxOrder + 1 });
    }
    saveWebSetlistSongs(entries);
    return;
  }
  const database = await getDatabase();
  await database.runAsync('DELETE FROM setlist_songs WHERE song_id = ?', [songId]);
  for (const setlistId of setlistIds) {
    const maxRow: any = await database.getFirstAsync(
      'SELECT COALESCE(MAX(sort_order), 0) as max_order FROM setlist_songs WHERE setlist_id = ?',
      [setlistId]
    );
    const nextOrder = (maxRow?.max_order ?? 0) + 1;
    await database.runAsync(
      'INSERT INTO setlist_songs (setlist_id, song_id, sort_order) VALUES (?, ?, ?)',
      [setlistId, songId, nextOrder]
    );
  }
}
