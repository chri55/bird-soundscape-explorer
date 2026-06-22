import { readBlocklist, addToBlocklist } from './xc-blocklist';

beforeEach(() => { localStorage.clear(); });

describe('xc-blocklist', () => {
  it('readBlocklist returns empty set when storage is empty', () => {
    expect(readBlocklist().size).toBe(0);
  });

  it('addToBlocklist adds a sciName; readBlocklist includes it', () => {
    addToBlocklist('Turdus migratorius');
    expect(readBlocklist().has('Turdus migratorius')).toBe(true);
  });

  it('readBlocklist excludes entries older than 24h', () => {
    const old = Date.now() - 25 * 60 * 60 * 1000;
    localStorage.setItem('xc_no_recording_v1', JSON.stringify([
      { sciName: 'Turdus migratorius', blockedAt: old },
    ]));
    expect(readBlocklist().has('Turdus migratorius')).toBe(false);
  });

  it('readBlocklist prunes expired entries from storage', () => {
    const old = Date.now() - 25 * 60 * 60 * 1000;
    localStorage.setItem('xc_no_recording_v1', JSON.stringify([
      { sciName: 'Turdus migratorius', blockedAt: old },
    ]));
    readBlocklist();
    expect(
      JSON.parse(localStorage.getItem('xc_no_recording_v1') ?? '[]') as unknown[],
    ).toHaveLength(0);
  });

  it('readBlocklist includes entries younger than 24h', () => {
    const fresh = Date.now() - 1 * 60 * 60 * 1000;
    localStorage.setItem('xc_no_recording_v1', JSON.stringify([
      { sciName: 'Parus major', blockedAt: fresh },
    ]));
    expect(readBlocklist().has('Parus major')).toBe(true);
  });

  it('addToBlocklist replaces duplicate sciName rather than appending', () => {
    addToBlocklist('Turdus migratorius');
    addToBlocklist('Turdus migratorius');
    const entries = JSON.parse(
      localStorage.getItem('xc_no_recording_v1') ?? '[]',
    ) as unknown[];
    expect(entries).toHaveLength(1);
  });
});
