export const PDF_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }

  @page {
    size: letter;
    margin: 0.6in;
  }

  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 10pt;
    color: #1a1a1a;
    line-height: 1.4;
  }

  .cover-page {
    page-break-after: always;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    text-align: center;
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

  .toc-page {
    page-break-after: always;
  }

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

  .toc-song-title {
    font-weight: 600;
    color: #1a1a1a;
  }

  .toc-artist {
    color: #666;
    font-style: italic;
    margin-left: 8px;
  }

  .toc-page-num {
    color: #999;
    min-width: 30px;
    text-align: right;
  }

  .song-page {
    page-break-before: always;
  }

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

  .empty-line {
    height: 8px;
  }

  .annotation-block {
    background: #FFF9E6;
    border-left: 3px solid #F0C040;
    padding: 4px 8px;
    margin: 2px 0 6px 0;
    font-size: 8.5pt;
    font-style: italic;
    color: #666;
    border-radius: 2px;
  }
`;
