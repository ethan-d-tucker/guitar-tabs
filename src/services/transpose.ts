import { transpose as chordTranspose } from 'chord-transposer';

const CHORD_TAG_REGEX = /\[ch\](.*?)\[\/ch\]/g;

export function transposeSong(rawContent: string, semitones: number): string {
  if (semitones === 0) return rawContent;

  return rawContent.replace(CHORD_TAG_REGEX, (_match, chord: string) => {
    try {
      const transposed = chordTranspose(chord).up(semitones).toString();
      return `[ch]${transposed}[/ch]`;
    } catch {
      // If transposition fails for this chord, keep original
      return `[ch]${chord}[/ch]`;
    }
  });
}

export function getTransposedKey(originalKey: string, semitones: number): string {
  if (!originalKey || semitones === 0) return originalKey;
  try {
    return chordTranspose(originalKey).up(semitones).toString();
  } catch {
    return originalKey;
  }
}
