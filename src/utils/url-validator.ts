export function isValidUGUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'tabs.ultimate-guitar.com' ||
      host === 'www.ultimate-guitar.com' ||
      host === 'ultimate-guitar.com'
    );
  } catch {
    return false;
  }
}
