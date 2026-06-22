import type { EBirdObservation } from '../api/ebird';
import type { XCRecording } from '../api/xeno-canto';
import { qualityRank, typeScore } from './recording-quality';

export interface DeduplicatedObs extends EBirdObservation {
  firstObsDt: string;
}

export function deduplicateObs(obs: EBirdObservation[]): DeduplicatedObs[] {
  const seen = new Map<string, DeduplicatedObs>();
  for (const o of obs) {
    const existing = seen.get(o.sciName);
    if (!existing) {
      seen.set(o.sciName, { ...o, firstObsDt: o.obsDt });
    } else {
      const isLater = o.obsDt.slice(0, 10) > existing.obsDt.slice(0, 10);
      const isEarlier = o.obsDt.slice(0, 10) < existing.firstObsDt.slice(0, 10);
      seen.set(o.sciName, {
        ...existing,
        howMany: (existing.howMany ?? 0) + (o.howMany ?? 0),
        obsDt: isLater ? o.obsDt : existing.obsDt,
        firstObsDt: isEarlier ? o.obsDt : existing.firstObsDt,
      });
    }
  }
  return [...seen.values()];
}

export function bestRecording(sciName: string, recordings: XCRecording[]): XCRecording | null {
  const parts = sciName.toLowerCase().split(' ');
  const genus = parts[0] ?? '';
  const species = parts[1] ?? '';

  const matches = recordings.filter(
    r => r.gen.toLowerCase() === genus && r.sp.toLowerCase() === species,
  );

  if (matches.length === 0) return null;

  return [...matches].sort((a, b) => {
    const qDiff = (qualityRank[a.q] ?? 5) - (qualityRank[b.q] ?? 5);
    return qDiff !== 0 ? qDiff : typeScore(a.type) - typeScore(b.type);
  })[0];
}
