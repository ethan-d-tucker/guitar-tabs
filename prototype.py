"""
Guitar Repertoire Builder — Python Prototype
Tests scraping, parsing, transposing, and PDF generation
before porting to the mobile app.
"""

import json
import os
import re
import sys
import webbrowser
from datetime import datetime
from html import escape as html_escape
from dataclasses import dataclass, field, asdict
from typing import Optional

import requests
import cloudscraper
from bs4 import BeautifulSoup

# ─── Models ───

@dataclass
class Song:
    title: str
    artist: str
    song_type: str  # 'chords', 'tab', 'both'
    raw_content: str
    source_url: Optional[str] = None
    transpose_offset: int = 0
    capo: int = 0
    tuning: str = "Standard"
    layout: str = "auto"  # 'auto', 'normal', 'columns'

# ─── Scraper ───

def scrape_ultimate_guitar(url: str) -> Song:
    """Fetch a UG page and extract song data from the js-store JSON."""
    scraper = cloudscraper.create_scraper(
        browser={"browser": "chrome", "platform": "windows", "desktop": True}
    )
    resp = scraper.get(url, timeout=15)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    js_store = soup.select_one(".js-store")
    if not js_store or not js_store.get("data-content"):
        raise ValueError("Could not find tab data on this page.")

    store = json.loads(js_store["data-content"])
    page_data = store.get("store", {}).get("page", {}).get("data", {})
    tab_view = page_data.get("tab_view", {})
    tab_meta = page_data.get("tab", {})

    wiki = tab_view.get("wiki_tab", {})
    raw_content = wiki.get("content")
    if not raw_content:
        raise ValueError("No tab content found.")

    title = tab_meta.get("song_name", "Unknown Title")
    artist = tab_meta.get("artist_name", "Unknown Artist")
    type_name = (tab_meta.get("type_name", "Chords")).lower()

    song_type = "chords"
    if "tab" in type_name:
        song_type = "tab"
    if "[ch]" in raw_content and "[tab]" in raw_content:
        song_type = "both"

    capo = (tab_view.get("meta") or {}).get("capo", 0) or 0
    tuning_obj = (tab_view.get("meta") or {}).get("tuning") or {}
    tuning = tuning_obj.get("value", "Standard") if isinstance(tuning_obj, dict) else "Standard"

    return Song(
        title=title,
        artist=artist,
        song_type=song_type,
        raw_content=raw_content,
        source_url=url,
        capo=capo,
        tuning=tuning,
    )

# ─── Chord/Tab Parser ───

SECTION_RE = re.compile(r"^\[([A-Za-z0-9 ]+)\]$")
CHORD_TAG_RE = re.compile(r"\[ch\](.*?)\[/ch\]")
TAB_LINE_RE = re.compile(r"^[eEBGDAb|]\|[-\d\s|hpbr/\\^~x().]*\|?\s*$")


def extract_chords(line: str):
    """Extract chord names and their character positions from a [ch]-tagged line."""
    chords = []
    plain = ""
    last_end = 0
    for m in CHORD_TAG_RE.finditer(line):
        plain += line[last_end:m.start()]
        chords.append({"chord": m.group(1), "position": len(plain)})
        plain += m.group(1)
        last_end = m.end()
    return chords


def build_chord_line(chords) -> str:
    """Build a string with chords placed at their positions using spaces."""
    line = ""
    for c in chords:
        while len(line) < c["position"]:
            line += " "
        line += c["chord"]
    return line


def parse_content(raw_content: str):
    """Parse UG raw content into structured lines (sections, chord-lyrics, tabs, empties)."""
    # Strip inline [tab]/[/tab] wrappers (UG uses them as generic content wrappers,
    # not just for guitar tablature). Keep standalone ones for actual tab block detection.
    raw_lines = raw_content.split("\n")
    lines = []
    for ln in raw_lines:
        stripped = ln.strip()
        if stripped == "[tab]" or stripped == "[/tab]":
            lines.append(ln)
        else:
            lines.append(ln.replace("[/tab]", "").replace("[tab]", ""))
    result = []
    i = 0

    while i < len(lines):
        line = lines[i]

        # [tab] block
        if line.strip() == "[tab]":
            tab_lines = []
            i += 1
            while i < len(lines) and lines[i].strip() != "[/tab]":
                tab_lines.append(lines[i])
                i += 1
            if tab_lines:
                result.append({"type": "tab", "lines": tab_lines})
            i += 1  # skip [/tab]
            continue

        # Standalone tab lines
        if TAB_LINE_RE.match(line.strip()) and "|" in line:
            tab_lines = [line]
            i += 1
            while i < len(lines) and TAB_LINE_RE.match(lines[i].strip()) and "|" in lines[i]:
                tab_lines.append(lines[i])
                i += 1
            result.append({"type": "tab", "lines": tab_lines})
            continue

        # Section header [Verse 1], [Chorus], etc.
        section_match = SECTION_RE.match(line.strip())
        if section_match and "[ch]" not in line:
            result.append({"type": "section", "name": section_match.group(1)})
            i += 1
            continue

        # Empty line
        if line.strip() == "":
            result.append({"type": "empty"})
            i += 1
            continue

        # Line with chords
        if "[ch]" in line:
            chords = extract_chords(line)
            next_line = lines[i + 1] if i + 1 < len(lines) else ""
            next_has_chords = "[ch]" in next_line
            next_is_empty = next_line.strip() == ""
            next_is_section = bool(SECTION_RE.match(next_line.strip()))
            next_is_tab = next_line.strip() == "[tab]"

            if not next_has_chords and not next_is_empty and not next_is_section and not next_is_tab:
                result.append({"type": "chord-lyric", "chords": chords, "lyrics": next_line})
                i += 2
            else:
                result.append({"type": "chord-lyric", "chords": chords, "lyrics": ""})
                i += 1
            continue

        # Plain lyrics
        result.append({"type": "chord-lyric", "chords": [], "lyrics": line})
        i += 1

    # Strip leading "Chords Used" reference block and "Capo N Key of X" lines.
    # These are UG metadata, not part of the song itself.
    CHORD_REF_RE = re.compile(r"^[A-G][#b]?m?\d*\w*:\s+[x\d]{5,6}$")
    CAPO_KEY_RE = re.compile(r"^Capo\s+\d+\s+Key\s+of\s+", re.IGNORECASE)
    cleaned = []
    skipping_header = True
    for item in result:
        if skipping_header:
            if item["type"] == "empty":
                continue  # skip leading empties
            if item["type"] == "chord-lyric" and not item["chords"] and item["lyrics"]:
                lyric = item["lyrics"].strip()
                if lyric.startswith("Chords Used"):
                    continue
                if CHORD_REF_RE.match(lyric):
                    continue
                if CAPO_KEY_RE.match(lyric):
                    continue
            # Once we hit a section header or chord-lyric with chords, stop skipping
            if item["type"] == "section" or (item["type"] == "chord-lyric" and item["chords"]):
                skipping_header = False
        cleaned.append(item)

    return cleaned

# ─── Transpose ───

CHROMATIC_SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
CHROMATIC_FLATS  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

# Map every note name to its semitone index
NOTE_TO_INDEX = {}
for idx, name in enumerate(CHROMATIC_SHARPS):
    NOTE_TO_INDEX[name] = idx
for idx, name in enumerate(CHROMATIC_FLATS):
    NOTE_TO_INDEX[name] = idx

CHORD_ROOT_RE = re.compile(r"^([A-G][#b]?)(.*)")


def transpose_chord(chord: str, semitones: int) -> str:
    """Transpose a single chord name by N semitones."""
    # Handle slash chords like Dm/F
    if "/" in chord:
        parts = chord.split("/", 1)
        return transpose_chord(parts[0], semitones) + "/" + transpose_chord(parts[1], semitones)

    m = CHORD_ROOT_RE.match(chord)
    if not m:
        return chord  # Can't parse, return as-is

    root = m.group(1)
    quality = m.group(2)

    idx = NOTE_TO_INDEX.get(root)
    if idx is None:
        return chord

    new_idx = (idx + semitones) % 12
    # Use sharps by default, flats if original used a flat
    if "b" in root and root != "B":
        new_root = CHROMATIC_FLATS[new_idx]
    else:
        new_root = CHROMATIC_SHARPS[new_idx]

    return new_root + quality


def transpose_song(raw_content: str, semitones: int) -> str:
    """Transpose all [ch]...[/ch] chords in raw content by N semitones."""
    if semitones == 0:
        return raw_content

    def replace_chord(m):
        original = m.group(1)
        return f"[ch]{transpose_chord(original, semitones)}[/ch]"

    return CHORD_TAG_RE.sub(replace_chord, raw_content)

# ─── PDF Generation ───

PDF_CSS = """
* { margin: 0; padding: 0; box-sizing: border-box; }

@page {
    size: letter;
    margin: 0.4in 0.35in;
}

body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 10pt;
    color: #1a1a1a;
    line-height: 1.4;
}

.cover-page {
    page-break-after: always;
    text-align: center;
    padding-top: 250px;
}
.cover-title {
    font-size: 32pt;
    font-weight: bold;
    color: #1a1a2e;
    margin-bottom: 12px;
}
.cover-subtitle {
    font-size: 14pt;
    color: #666;
}
.cover-date {
    font-size: 11pt;
    color: #999;
    margin-top: 40px;
}

.toc-page { }
.toc-title {
    font-size: 20pt;
    font-weight: bold;
    color: #1a1a2e;
    margin-bottom: 20px;
    border-bottom: 2px solid #B22222;
    padding-bottom: 8px;
}
.toc-entry {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 6px 0;
    border-bottom: 1px dotted #ddd;
    font-size: 11pt;
}
.toc-song-title { font-weight: 600; color: #1a1a1a; }
.toc-artist { color: #666; font-style: italic; margin-left: 8px; }

.song-page { page-break-before: always; }
.song-header {
    border-bottom: 2px solid #333;
    margin-bottom: 14px;
    padding-bottom: 8px;
}
.song-title {
    font-size: 18pt;
    font-weight: bold;
    color: #1a1a2e;
    margin: 0;
}
.song-artist {
    font-size: 12pt;
    color: #555;
    margin: 2px 0 0 0;
}
.song-meta {
    font-size: 9pt;
    color: #888;
    margin-top: 4px;
    font-style: italic;
}

.section-header {
    font-size: 10pt;
    font-weight: bold;
    color: #444;
    margin: 14px 0 4px 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.chord-line {
    font-family: 'Courier New', Courier, monospace;
    font-size: 9pt;
    font-weight: bold;
    color: #B22222;
    white-space: pre;
    margin: 0;
    padding: 0;
    line-height: 1.3;
}
.lyric-line {
    font-family: 'Courier New', Courier, monospace;
    font-size: 9pt;
    color: #1a1a1a;
    white-space: pre;
    margin: 0 0 4px 0;
    padding: 0;
    line-height: 1.3;
}

.tab-block {
    font-family: 'Courier New', Courier, monospace;
    font-size: 8pt;
    white-space: pre;
    color: #1a1a1a;
    background: #f7f7f7;
    border-left: 3px solid #B22222;
    padding: 6px 10px;
    margin: 8px 0;
    line-height: 1.35;
}

.empty-line { height: 8px; }

/* ─── Two-Column Layout ─── */
.song-page-columns {
    page-break-before: always;
    margin: -0.1in;
}
.song-page-columns .song-header {
    border-bottom: 2px solid #333;
    margin-bottom: 12px;
    padding-bottom: 6px;
}
.song-page-columns .song-title {
    font-size: 15pt;
    font-weight: bold;
    color: #1a1a2e;
    margin: 0;
}
.song-page-columns .song-artist {
    font-size: 10pt;
    color: #555;
    margin: 2px 0 0 0;
}
.song-page-columns .song-meta {
    font-size: 8pt;
    color: #888;
    margin-top: 2px;
    font-style: italic;
}
.col-table {
    width: 100%;
    border-spacing: 0;
    table-layout: fixed;
}
.col-table td {
    vertical-align: top;
    width: 50%;
    overflow: hidden;
}
.col-table td:first-child {
    border-right: 1px solid #ccc;
    padding: 0 12px 0 0;
}
.col-table td:last-child {
    padding: 0 0 0 12px;
}
.col-table .chord-line {
    font-family: 'Courier New', Courier, monospace;
    font-size: 8.5pt;
    font-weight: bold;
    color: #B22222;
    white-space: pre;
    margin: 0;
    padding: 0;
    line-height: 1.3;
}
.col-table .lyric-line {
    font-family: 'Courier New', Courier, monospace;
    font-size: 8.5pt;
    color: #1a1a1a;
    white-space: pre;
    margin: 0 0 2px 0;
    padding: 0;
    line-height: 1.3;
}
.col-table .tab-block {
    font-family: 'Courier New', Courier, monospace;
    font-size: 7.5pt;
    white-space: pre;
    color: #1a1a1a;
    background: #f7f7f7;
    border-left: 2px solid #B22222;
    padding: 4px 6px;
    margin: 4px 0;
    line-height: 1.25;
}
.col-table .section-header {
    font-size: 9pt;
    font-weight: bold;
    color: #444;
    margin: 10px 0 3px 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.col-table .empty-line { height: 6px; }

/* ─── Compact Single-Column Layout ─── */
.song-page-compact {
    page-break-before: always;
}
.song-page-compact .song-header-line {
    border-bottom: 2px solid #333;
    margin-bottom: 6px;
    padding-bottom: 4px;
}
.song-page-compact .song-title-inline {
    font-size: 13pt;
    font-weight: bold;
    color: #1a1a2e;
}
.song-page-compact .song-artist-inline {
    font-size: 10pt;
    color: #555;
    margin-left: 6px;
}
.song-page-compact .song-meta-inline {
    font-size: 8pt;
    color: #888;
    font-style: italic;
    margin-left: 8px;
}
.song-page-compact .section-header {
    font-size: 8.5pt;
    font-weight: bold;
    color: #444;
    margin: 6px 0 1px 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.song-page-compact .chord-line {
    font-family: 'Courier New', Courier, monospace;
    font-size: 7.5pt;
    font-weight: bold;
    color: #B22222;
    white-space: pre;
    margin: 0;
    padding: 0;
    line-height: 1.15;
}
.song-page-compact .lyric-line {
    font-family: 'Courier New', Courier, monospace;
    font-size: 7.5pt;
    color: #1a1a1a;
    white-space: pre;
    margin: 0 0 1px 0;
    padding: 0;
    line-height: 1.15;
}
.song-page-compact .tab-block {
    font-family: 'Courier New', Courier, monospace;
    font-size: 7.5pt;
    white-space: pre;
    color: #1a1a1a;
    background: #f7f7f7;
    border-left: 3px solid #B22222;
    padding: 3px 8px;
    margin: 4px 0;
    line-height: 1.2;
}
.song-page-compact .empty-line { height: 3px; }
"""


def _render_parsed_lines(parsed: list, max_chars: int = 0) -> str:
    """Render a list of parsed lines into HTML.
    If max_chars > 0, truncate lines to fit within that character width."""
    def _trunc(text: str, is_chord: bool = False) -> str:
        if max_chars <= 0 or len(text) <= max_chars:
            return text
        if is_chord:
            # For chord lines, just hard-cut (spacing matters)
            return text[:max_chars]
        # For lyrics, cut at last word boundary
        cut = text[:max_chars]
        last_space = cut.rfind(" ")
        if last_space > max_chars * 0.6:
            return cut[:last_space]
        return cut

    body = ""
    for line in parsed:
        t = line["type"]
        if t == "section":
            body += f'<div class="section-header">{html_escape(line["name"])}</div>\n'
        elif t == "chord-lyric":
            if line["chords"]:
                chord_str = build_chord_line(line["chords"])
                body += f'<div class="chord-line">{html_escape(_trunc(chord_str, is_chord=True))}</div>\n'
            if line["lyrics"]:
                body += f'<div class="lyric-line">{html_escape(_trunc(line["lyrics"]))}</div>\n'
        elif t == "tab":
            tab_text = "\n".join(html_escape(_trunc(l)) for l in line["lines"])
            body += f'<div class="tab-block">{tab_text}</div>\n'
        elif t == "empty":
            body += '<div class="empty-line"></div>\n'
    return body


def _estimate_visual_lines(parsed: list) -> float:
    """Estimate how many visual lines a parsed song occupies."""
    count = 0.0
    for item in parsed:
        t = item["type"]
        if t == "section":
            count += 2  # header text + top margin space
        elif t == "chord-lyric":
            if item["chords"]:
                count += 1
            if item["lyrics"]:
                count += 1
        elif t == "tab":
            count += len(item["lines"]) + 1  # lines + margin
        elif t == "empty":
            count += 0.5
    return count


# Auto-layout thresholds (visual lines)
MAX_NORMAL_LINES = 50   # fits at 9pt single-column
MAX_COMPACT_LINES = 70  # fits at 8pt single-column with tight spacing


def _split_for_columns(parsed: list) -> tuple[list, list]:
    """Split parsed content into two roughly equal halves at a logical breakpoint.
    Prefers splitting at section headers or empty lines near the midpoint."""
    # Weight each element: sections/empties = 1, chord-lyric = 1-2, tab = line count
    weights = []
    for item in parsed:
        t = item["type"]
        if t == "empty":
            weights.append(1)
        elif t == "section":
            weights.append(1)
        elif t == "chord-lyric":
            w = 1
            if item["chords"]:
                w += 1
            weights.append(w)
        elif t == "tab":
            weights.append(len(item["lines"]))
        else:
            weights.append(1)

    total = sum(weights)
    half = total / 2.0

    # Find the best split point near the midpoint
    running = 0
    best_idx = len(parsed) // 2
    best_diff = float("inf")

    for i in range(1, len(parsed)):
        running += weights[i - 1]
        diff = abs(running - half)
        # Prefer splitting at section headers or empty lines
        is_good_break = parsed[i]["type"] in ("section", "empty")
        adjusted_diff = diff - (2 if is_good_break else 0)
        if adjusted_diff < best_diff:
            best_diff = adjusted_diff
            best_idx = i

    return parsed[:best_idx], parsed[best_idx:]


def _build_meta_html(song: Song) -> str:
    meta_parts = []
    if song.capo:
        meta_parts.append(f"Capo {song.capo}")
    if song.tuning and song.tuning != "Standard":
        meta_parts.append(song.tuning)
    if song.transpose_offset != 0:
        sign = "+" if song.transpose_offset > 0 else ""
        meta_parts.append(f"Transposed {sign}{song.transpose_offset}")
    if meta_parts:
        return f'<p class="song-meta">{html_escape(" | ".join(meta_parts))}</p>'
    return ""


def generate_song_html(song: Song, index: int) -> str:
    content = transpose_song(song.raw_content, song.transpose_offset)
    parsed = parse_content(content)
    meta_html = _build_meta_html(song)

    # Determine effective layout
    layout = song.layout
    if layout == "auto":
        vlines = _estimate_visual_lines(parsed)
        if vlines <= MAX_NORMAL_LINES:
            layout = "normal"
        elif vlines <= MAX_COMPACT_LINES:
            layout = "compact"
        else:
            layout = "columns"

    if layout == "columns":
        left, right = _split_for_columns(parsed)
        col_chars = 52  # max characters per column at 8.5pt Courier
        left_html = _render_parsed_lines(left, max_chars=col_chars)
        right_html = _render_parsed_lines(right, max_chars=col_chars)

        return f"""
    <div class="song-page-columns" id="song-{index}">
      <div class="song-header">
        <h1 class="song-title">{html_escape(song.title)}</h1>
        <p class="song-artist">{html_escape(song.artist)}</p>
        {meta_html}
      </div>
      <table class="col-table"><tr>
        <td>{left_html}</td>
        <td>{right_html}</td>
      </tr></table>
    </div>
    """

    if layout == "compact":
        body = _render_parsed_lines(parsed)
        # Build inline meta (capo, tuning, transpose) for the header line
        inline_meta = ""
        meta_parts = []
        if song.capo:
            meta_parts.append(f"Capo {song.capo}")
        if song.tuning and song.tuning != "Standard":
            meta_parts.append(song.tuning)
        if song.transpose_offset != 0:
            sign = "+" if song.transpose_offset > 0 else ""
            meta_parts.append(f"Transposed {sign}{song.transpose_offset}")
        if meta_parts:
            inline_meta = f'<span class="song-meta-inline">| {html_escape(" | ".join(meta_parts))}</span>'

        return f"""
    <div class="song-page-compact" id="song-{index}">
      <div class="song-header-line">
        <span class="song-title-inline">{html_escape(song.title)}</span>
        <span class="song-artist-inline">-- {html_escape(song.artist)}</span>
        {inline_meta}
      </div>
      {body}
    </div>
    """

    # Normal single-column layout
    body = _render_parsed_lines(parsed)
    return f"""
    <div class="song-page" id="song-{index}">
      <div class="song-header">
        <h1 class="song-title">{html_escape(song.title)}</h1>
        <p class="song-artist">{html_escape(song.artist)}</p>
        {meta_html}
      </div>
      {body}
    </div>
    """


def generate_cover_page(title: str) -> str:
    date_str = datetime.now().strftime("%B %d, %Y")
    return f"""
    <div class="cover-page">
      <div class="cover-title">{html_escape(title)}</div>
      <div class="cover-subtitle">Guitar Repertoire</div>
      <div class="cover-date">{date_str}</div>
    </div>
    """


def generate_toc(songs: list[Song]) -> str:
    entries = ""
    for i, song in enumerate(songs):
        entries += f"""
        <div class="toc-entry">
          <div>
            <span class="toc-song-title">{html_escape(song.title)}</span>
            <span class="toc-artist"> — {html_escape(song.artist)}</span>
          </div>
        </div>
        """
    return f"""
    <div class="toc-page">
      <div class="toc-title">Table of Contents</div>
      {entries}
    </div>
    """


def generate_full_html(songs: list[Song], title: str = "My Repertoire") -> str:
    songs_html = "".join(generate_song_html(s, i) for i, s in enumerate(songs))
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>{PDF_CSS}</style>
</head>
<body>
  {generate_cover_page(title)}
  {generate_toc(songs)}
  {songs_html}
</body>
</html>"""


def generate_pdf(songs: list[Song], output_path: str, title: str = "My Repertoire"):
    """Generate a PDF file from the song list using xhtml2pdf."""
    from xhtml2pdf import pisa
    html_str = generate_full_html(songs, title)
    with open(output_path, "wb") as f:
        result = pisa.CreatePDF(html_str, dest=f)
    if result.err:
        raise RuntimeError(f"PDF generation failed with {result.err} error(s)")
    print(f"PDF saved to: {output_path}")

# ─── Persistence (JSON file) ───

REPERTOIRE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "repertoire.json")


def load_repertoire() -> list[Song]:
    if not os.path.exists(REPERTOIRE_FILE):
        return []
    with open(REPERTOIRE_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return [Song(**d) for d in data]


def save_repertoire(songs: list[Song]):
    with open(REPERTOIRE_FILE, "w", encoding="utf-8") as f:
        json.dump([asdict(s) for s in songs], f, indent=2, ensure_ascii=False)

# ─── CLI ───

def cli():
    songs = load_repertoire()
    print("\n=== Guitar Repertoire Builder (Prototype) ===\n")

    while True:
        print(f"\nYou have {len(songs)} song(s) in your repertoire.\n")
        print("  1. Add song from Ultimate Guitar URL")
        print("  2. List songs")
        print("  3. Transpose a song")
        print("  4. Toggle layout (normal / two-column)")
        print("  5. Generate PDF")
        print("  6. Quit")

        choice = input("\nChoice: ").strip()

        if choice == "1":
            url = input("Paste UG URL: ").strip()
            if not url:
                continue
            try:
                print("Fetching...")
                song = scrape_ultimate_guitar(url)
                songs.append(song)
                save_repertoire(songs)
                print(f"  Added: {song.title} — {song.artist} ({song.song_type})")
                if song.capo:
                    print(f"  Capo: {song.capo}")
            except Exception as e:
                print(f"  Error: {e}")

        elif choice == "2":
            if not songs:
                print("  (empty)")
            for i, s in enumerate(songs):
                trans = f" [transpose {s.transpose_offset:+d}]" if s.transpose_offset else ""
                print(f"  {i + 1}. {s.title} — {s.artist} ({s.song_type}){trans}")

        elif choice == "3":
            if not songs:
                print("  No songs to transpose.")
                continue
            for i, s in enumerate(songs):
                print(f"  {i + 1}. {s.title} — {s.artist}")
            try:
                idx = int(input("Song number: ").strip()) - 1
                semi = int(input("Semitones (+/-): ").strip())
                songs[idx].transpose_offset += semi
                save_repertoire(songs)
                print(f"  {songs[idx].title} now transposed {songs[idx].transpose_offset:+d}")
            except (ValueError, IndexError):
                print("  Invalid input.")

        elif choice == "4":
            if not songs:
                print("  No songs to change layout.")
                continue
            for i, s in enumerate(songs):
                print(f"  {i + 1}. {s.title} — {s.artist}  [{s.layout}]")
            try:
                idx = int(input("Song number: ").strip()) - 1
                cycle = {"auto": "normal", "normal": "columns", "columns": "auto"}
                current = songs[idx].layout
                new_layout = cycle.get(current, "auto")
                songs[idx].layout = new_layout
                save_repertoire(songs)
                print(f"  {songs[idx].title} → {new_layout}")
            except (ValueError, IndexError):
                print("  Invalid input.")

        elif choice == "5":
            if not songs:
                print("  No songs — add some first!")
                continue
            output = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Guitar_Repertoire.pdf")
            try:
                generate_pdf(songs, output)
                webbrowser.open(output)
            except Exception as e:
                print(f"  Error generating PDF: {e}")

        elif choice == "6":
            print("Bye!")
            break


# ─── Quick Test Mode ───

def quick_test(url: str):
    """Run a quick automated test: scrape, parse, transpose, generate PDF."""
    print(f"\n--- SCRAPING: {url} ---")
    song = scrape_ultimate_guitar(url)
    print(f"Title:  {song.title}")
    print(f"Artist: {song.artist}")
    print(f"Type:   {song.song_type}")
    print(f"Capo:   {song.capo}")
    print(f"Tuning: {song.tuning}")

    print(f"\n--- PARSING (first 10 elements) ---")
    parsed = parse_content(song.raw_content)
    for item in parsed[:10]:
        t = item["type"]
        if t == "section":
            print(f"  [{item['name']}]")
        elif t == "chord-lyric":
            if item["chords"]:
                print(f"  CHORDS: {build_chord_line(item['chords'])}")
            if item["lyrics"]:
                print(f"  LYRICS: {item['lyrics']}")
        elif t == "tab":
            print(f"  TAB ({len(item['lines'])} lines)")
        elif t == "empty":
            print(f"  (empty)")

    print(f"\n--- TRANSPOSE +2 (first 5 chord lines) ---")
    transposed = transpose_song(song.raw_content, 2)
    parsed_t = parse_content(transposed)
    count = 0
    for item in parsed_t:
        if item["type"] == "chord-lyric" and item["chords"]:
            original_parsed = parse_content(song.raw_content)
            print(f"  {build_chord_line(item['chords'])}")
            count += 1
            if count >= 5:
                break

    print(f"\n--- GENERATING PDF (auto layout) ---")
    output_dir = os.path.dirname(os.path.abspath(__file__))

    vlines = _estimate_visual_lines(parsed)
    print(f"  Visual lines: {vlines:.0f} -> ", end="")
    if vlines <= MAX_NORMAL_LINES:
        print("normal single-column")
    elif vlines <= MAX_COMPACT_LINES:
        print("compact single-column")
    else:
        print("two-column")

    song.layout = "auto"
    output = os.path.join(output_dir, "Guitar_Repertoire.pdf")
    generate_pdf([song], output)
    webbrowser.open(output)
    print("Done! PDF should open.")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        url = sys.argv[2] if len(sys.argv) > 2 else "https://tabs.ultimate-guitar.com/tab/jason-isbell/crimson-and-clay-chords-5700230"
        quick_test(url)
    else:
        cli()
