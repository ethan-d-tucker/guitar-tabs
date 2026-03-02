export interface ChordPosition {
  chord: string;
  position: number;
}

export interface ChordLyricPair {
  type: 'chord-lyric';
  chords: ChordPosition[];
  lyrics: string;
}

export interface TabBlock {
  type: 'tab';
  lines: string[];
}

export interface SectionHeader {
  type: 'section';
  name: string;
}

export interface EmptyLine {
  type: 'empty';
}

export type SongLine = ChordLyricPair | TabBlock | SectionHeader | EmptyLine;

const CHORD_REGEX = /\[ch\](.*?)\[\/ch\]/g;
const SECTION_REGEX = /^\[([A-Za-z0-9\s]+)\]$/;
const TAB_LINE_REGEX = /^[eEBGDAb|]\|[-\d\s|hpbr/\\^~x().]*\|?\s*$/;

export function parseContent(rawContent: string): SongLine[] {
  const lines = rawContent.split('\n');
  const result: SongLine[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check for [tab] blocks (handles inline tags like `[tab]content` or `content[/tab]`)
    if (line.trim().startsWith('[tab]')) {
      const tabLines: string[] = [];
      const afterTag = line.trim().slice('[tab]'.length);

      // Single-line: [tab]content[/tab]
      if (afterTag.includes('[/tab]')) {
        const content = afterTag.replace('[/tab]', '').trimEnd();
        if (content) tabLines.push(content);
        if (tabLines.length > 0) {
          result.push({ type: 'tab', lines: tabLines });
        }
        i++;
        continue;
      }

      // Content after [tab] on opening line
      if (afterTag.trim()) tabLines.push(afterTag);
      i++;

      // Collect lines until [/tab]
      while (i < lines.length) {
        const cur = lines[i];
        if (cur.trim() === '[/tab]') {
          i++;
          break;
        }
        if (cur.includes('[/tab]')) {
          const before = cur.replace('[/tab]', '').trimEnd();
          if (before.trim()) tabLines.push(before);
          i++;
          break;
        }
        tabLines.push(cur.replace(/\[tab\]/g, '').replace(/\[\/tab\]/g, ''));
        i++;
      }
      if (tabLines.length > 0) {
        result.push({ type: 'tab', lines: tabLines });
      }
      continue;
    }

    // Check for standalone tab lines (without [tab] wrapper)
    if (TAB_LINE_REGEX.test(line.trim()) && line.includes('|')) {
      const tabLines: string[] = [line];
      i++;
      while (i < lines.length && TAB_LINE_REGEX.test(lines[i].trim()) && lines[i].includes('|')) {
        tabLines.push(lines[i]);
        i++;
      }
      result.push({ type: 'tab', lines: tabLines });
      continue;
    }

    // Check for section header like [Verse 1], [Chorus]
    const sectionMatch = line.trim().match(SECTION_REGEX);
    if (sectionMatch && !line.includes('[ch]') && !line.includes('[/ch]')) {
      result.push({ type: 'section', name: sectionMatch[1] });
      i++;
      continue;
    }

    // Check for empty line
    if (line.trim() === '') {
      result.push({ type: 'empty' });
      i++;
      continue;
    }

    // Check if this line has chords
    if (line.includes('[ch]')) {
      const chords = extractChords(line);
      // Next line might be lyrics
      const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
      const nextHasChords = nextLine.includes('[ch]');
      const nextIsEmpty = nextLine.trim() === '';
      const nextIsSection = SECTION_REGEX.test(nextLine.trim());

      const nextIsTab = nextLine.trim().startsWith('[tab]');
      if (!nextHasChords && !nextIsEmpty && !nextIsSection && !nextIsTab) {
        // Pair chord line with lyric line
        result.push({
          type: 'chord-lyric',
          chords,
          lyrics: nextLine,
        });
        i += 2;
      } else {
        // Chord-only line (no lyrics below)
        result.push({
          type: 'chord-lyric',
          chords,
          lyrics: '',
        });
        i++;
      }
      continue;
    }

    // Plain text line (lyrics without chords above)
    result.push({
      type: 'chord-lyric',
      chords: [],
      lyrics: line,
    });
    i++;
  }

  return result;
}

function extractChords(line: string): ChordPosition[] {
  const chords: ChordPosition[] = [];
  let plainText = '';
  let lastIndex = 0;

  const regex = /\[ch\](.*?)\[\/ch\]/g;
  let match;

  while ((match = regex.exec(line)) !== null) {
    // Add the text between the last match and this one
    plainText += line.slice(lastIndex, match.index);
    chords.push({
      chord: match[1],
      position: plainText.length,
    });
    plainText += match[1];
    lastIndex = match.index + match[0].length;
  }

  return chords;
}

export function stripChordTags(text: string): string {
  return text.replace(/\[ch\](.*?)\[\/ch\]/g, '$1');
}

export function buildChordLine(chords: ChordPosition[], totalWidth: number = 80): string {
  let line = '';
  for (const { chord, position } of chords) {
    while (line.length < position) {
      line += ' ';
    }
    line += chord;
  }
  return line;
}
