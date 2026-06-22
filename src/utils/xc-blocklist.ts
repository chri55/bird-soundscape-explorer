const STORAGE_KEY = 'xc_no_recording_v1';
const TTL_MS = 24 * 60 * 60 * 1000;

interface BlocklistEntry {
  sciName: string;
  blockedAt: number;
}

export function readBlocklist(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const entries = JSON.parse(raw) as BlocklistEntry[];
    const now = Date.now();
    const live = entries.filter(e => now - e.blockedAt < TTL_MS);
    if (live.length !== entries.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(live));
    }
    return new Set(live.map(e => e.sciName));
  } catch {
    return new Set();
  }
}

export function addToBlocklist(sciName: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const entries: BlocklistEntry[] = raw ? JSON.parse(raw) as BlocklistEntry[] : [];
    const now = Date.now();
    const pruned = entries.filter(e => now - e.blockedAt < TTL_MS && e.sciName !== sciName);
    pruned.push({ sciName, blockedAt: now });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
  } catch {
    // localStorage unavailable — silently no-op
  }
}
