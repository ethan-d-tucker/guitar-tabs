import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { PDF_CSS } from './pdf-styles';
import { parseContent, buildChordLine } from '../utils/chord-parser';
import { transposeSong } from './transpose';
import type { Song } from '../models/Song';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generateSongHtml(song: Song, index: number, includeAnnotations: boolean = true): string {
  const content = song.transposeOffset !== 0
    ? transposeSong(song.rawContent, song.transposeOffset)
    : song.rawContent;

  const parsed = parseContent(content);
  let bodyHtml = '';

  if (includeAnnotations && song.annotations?.['_song']) {
    bodyHtml += `<div class="annotation-block">${escapeHtml(song.annotations['_song'])}</div>\n`;
  }

  for (const line of parsed) {
    switch (line.type) {
      case 'section':
        bodyHtml += `<div class="section-header">${escapeHtml(line.name)}</div>\n`;
        if (includeAnnotations && song.annotations?.[line.name]) {
          bodyHtml += `<div class="annotation-block">${escapeHtml(song.annotations[line.name])}</div>\n`;
        }
        break;
      case 'chord-lyric':
        if (line.chords.length > 0) {
          const chordStr = buildChordLine(line.chords);
          bodyHtml += `<div class="chord-line">${escapeHtml(chordStr)}</div>\n`;
        }
        if (line.lyrics) {
          bodyHtml += `<div class="lyric-line">${escapeHtml(line.lyrics)}</div>\n`;
        }
        break;
      case 'tab':
        bodyHtml += `<div class="tab-block">${line.lines.map(l => escapeHtml(l)).join('\n')}</div>\n`;
        break;
      case 'empty':
        bodyHtml += `<div class="empty-line"></div>\n`;
        break;
    }
  }

  const metaParts: string[] = [];
  if (song.capo > 0) metaParts.push(`Capo ${song.capo}`);
  if (song.tuning && song.tuning !== 'Standard') metaParts.push(song.tuning);
  if (song.transposeOffset !== 0) {
    const sign = song.transposeOffset > 0 ? '+' : '';
    metaParts.push(`Transposed ${sign}${song.transposeOffset}`);
  }

  return `
    <div class="song-page" id="song-${index}">
      <div class="song-header">
        <h1 class="song-title">${escapeHtml(song.title)}</h1>
        <p class="song-artist">${escapeHtml(song.artist)}</p>
        ${metaParts.length > 0 ? `<p class="song-meta">${escapeHtml(metaParts.join(' | '))}</p>` : ''}
      </div>
      ${bodyHtml}
    </div>
  `;
}

function generateCoverPage(title: string): string {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
    <div class="cover-page">
      <div class="cover-title">${escapeHtml(title)}</div>
      <div class="cover-subtitle">Guitar Setlist</div>
      <div class="cover-date">${date}</div>
    </div>
  `;
}

function generateTOC(songs: Song[]): string {
  const entries = songs.map((song, i) => `
    <div class="toc-entry">
      <div>
        <span class="toc-song-title">${escapeHtml(song.title)}</span>
        <span class="toc-artist"> — ${escapeHtml(song.artist)}</span>
      </div>
      <span class="toc-page-num">${i + 1}</span>
    </div>
  `).join('');

  return `
    <div class="toc-page">
      <div class="toc-title">Table of Contents</div>
      ${entries}
    </div>
  `;
}

function generateFullHtml(songs: Song[], title: string, includeAnnotations: boolean = true): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${PDF_CSS}</style>
</head>
<body>
  ${generateCoverPage(title)}
  ${generateTOC(songs)}
  ${songs.map((song, i) => generateSongHtml(song, i, includeAnnotations)).join('')}
</body>
</html>`;
}

export async function generatePDF(songs: Song[], title: string = 'All Songs', includeAnnotations: boolean = true): Promise<string> {
  const html = generateFullHtml(songs, title, includeAnnotations);

  const { uri } = await Print.printToFileAsync({
    html,
    width: 612,
    height: 792,
  });

  return uri;
}

export async function generateAndSharePDF(songs: Song[], title: string = 'All Songs', includeAnnotations: boolean = true): Promise<void> {
  const uri = await generatePDF(songs, title, includeAnnotations);
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Export Setlist',
  });
}

export function generateSingleSongHtml(song: Song, includeAnnotations: boolean = true): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${PDF_CSS}</style>
</head>
<body>
  ${generateSongHtml(song, 0, includeAnnotations)}
</body>
</html>`;
}
