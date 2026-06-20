import type { XCRecording } from '../api/xeno-canto';
import type { EBirdObservation } from '../api/ebird';
import { fetchRecordings } from '../api/xeno-canto';

export async function fillRecordingGaps(
  existing: XCRecording[],
  recentObs: EBirdObservation[],
  target: number,
): Promise<XCRecording[]> {
  const coveredSciNames = new Set(existing.map(r => `${r.gen} ${r.sp}`));
  if (coveredSciNames.size >= target) return existing;

  const needed = target - coveredSciNames.size;
  const gapSpecies = recentObs
    .filter(obs => !coveredSciNames.has(obs.sciName))
    .sort((a, b) => (b.howMany ?? 1) - (a.howMany ?? 1))
    .slice(0, needed);

  const results = await Promise.all(
    gapSpecies.map(obs => {
      const [gen, ...rest] = obs.sciName.split(' ');
      return fetchRecordings(`gen:${gen} sp:${rest.join(' ')}`).catch(() => null);
    }),
  );

  const gapRecordings = results
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .flatMap(r => r.recordings);

  return [...existing, ...gapRecordings];
}
