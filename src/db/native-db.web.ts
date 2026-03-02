export async function getDatabase(): Promise<any> {
  throw new Error('SQLite is not available on web');
}
