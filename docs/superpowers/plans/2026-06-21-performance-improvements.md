# Performance Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the four user-visible performance bottlenecks: 500 un-clustered Leaflet markers that freeze the map on load, per-voice re-renders in SoundscapeGrid that fire up to 8× per playback cycle, a serialized XC fetch waterfall that adds a full round-trip after every pin click, and un-memoized derivations in SpeciesPanel that recompute on every parent state update.

**Findings summary:** Four concrete issues were found. (1) `MapView.tsx` renders all ~500 NPS parks as individual react-leaflet `<Marker>` components with no clustering — at this scale Leaflet must create ~500 DOM elements and event-listener pairs on first render, causing a noticeable freeze on mobile; the standard fix is `leaflet.markercluster`. (2) `SoundscapeGrid` is not wrapped in `React.memo` and `onToggleMute` is not stabilized, so the entire grid re-renders every time any single voice's `isActive` flips (up to 8 times per second during active playback). (3) `fillRecordingGaps` in `soundscape-recordings.ts` runs *after* the initial `Promise.all([notable, recent, xcRes])` resolves, meaning gap-fill XC fetches form a serialized second round trip rather than running alongside the first batch — the soundscape is silent until both laps complete. (4) `SpeciesPanel` calls `deduplicateObs()` and `.sort()` on every render with no `useMemo`, so these O(n) passes repeat whenever any unrelated parent state (e.g. `isLoading`) toggles. Additionally, the `useSoundscape` unmount cleanup only calls `audio.pause()` without clearing `audio.src` and calling `audio.load()`, which can keep audio resources and pending browser decode tasks alive after the component unmounts.

**Tech Stack:** React 19 + TypeScript, Vite 8, Tailwind CSS v4, Vitest, react-leaflet

## Global Constraints

- verbatimModuleSyntax: true — type-only imports must use `import type { ... }` on a separate line
- Hook tests in `src/hooks/` use Vitest globals; run tests: `npm run test`

---

### Task 1: Cluster NPS park markers with leaflet.markercluster

**Files:**
- Modify: `package.json`
- Modify: `src/components/MapView.tsx`

**Problem:** All ~500 park markers are rendered as individual `<Marker>` DOM nodes on every render. On a mid-range mobile device this causes a ~500ms UI freeze as Leaflet creates 500 SVG/DOM nodes and attaches click listeners to each. Marker clustering collapses nearby pins into a single cluster node — typically reducing the initial DOM count to under 30 at zoom level 4.

**Leaflet.markercluster approach:** react-leaflet does not ship a built-in cluster layer, so we use `leaflet.markercluster` directly via Leaflet's layer API inside a custom `useEffect` hook rather than as a JSX child.

- [ ] **Step 1: Install leaflet.markercluster and its types**

  ```bash
  npm install leaflet.markercluster
  npm install --save-dev @types/leaflet.markercluster
  ```

- [ ] **Step 2: Import the plugin and its CSS in MapView.tsx**

  Add these two lines directly below the existing `import 'leaflet/dist/leaflet.css';` line:

  ```typescript
  import 'leaflet.markercluster/dist/MarkerCluster.css';
  import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
  import 'leaflet.markercluster';
  ```

  Note: `leaflet.markercluster` extends `L` with `.markerClusterGroup()` as a side-effect import; no named export is needed.

- [ ] **Step 3: Replace the JSX park markers with a useEffect cluster layer**

  Remove the JSX fragment:
  ```tsx
  {parks.map(park => (
    <Marker
      key={park.parkCode}
      position={[parseFloat(park.latitude), parseFloat(park.longitude)]}
      icon={parkIcon}
      eventHandlers={{ click: () => handlePin({ lat: parseFloat(park.latitude), lng: parseFloat(park.longitude) }) }}
    >
      <Popup>{park.fullName}</Popup>
    </Marker>
  ))}
  ```

  Add a `mapRef` to capture the Leaflet map instance. In MapView, add:
  ```typescript
  import type { Map as LeafletMap } from 'leaflet';
  ```
  and a ref:
  ```typescript
  const mapRef = useRef<LeafletMap | null>(null);
  ```

  Create a helper component that captures the map instance using `useMapEvents` (already imported):
  ```tsx
  function MapRefCapture({ onReady }: { onReady: (map: LeafletMap) => void }) {
    const map = useMapEvents({});
    useEffect(() => { onReady(map); }, [map, onReady]);
    return null;
  }
  ```

  Add a `useEffect` that builds and tears down the cluster layer whenever `parks` or `handlePin` changes:
  ```typescript
  useEffect(() => {
    const map = mapRef.current;
    if (!map || parks.length === 0) return;

    const cluster = L.markerClusterGroup({ chunkedLoading: true });
    for (const park of parks) {
      const lat = parseFloat(park.latitude);
      const lng = parseFloat(park.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
      const marker = L.marker([lat, lng], { icon: parkIcon });
      marker.bindPopup(park.fullName);
      marker.on('click', () => handlePin({ lat, lng }));
      cluster.addLayer(marker);
    }
    map.addLayer(cluster);
    return () => { map.removeLayer(cluster); };
  }, [parks, handlePin]);
  ```

  Inside `<MapContainer>`, add `<MapRefCapture onReady={useCallback(m => { mapRef.current = m; }, [])} />` alongside `<PinHandler>`.

- [ ] **Step 4: Verify**

  Run `npm run build` (TypeScript must pass) then `npm run dev` and confirm ~500 markers collapse into clusters at zoom 4; individual markers appear as you zoom in.

---

### Task 2: Memoize SoundscapeGrid to eliminate per-voice re-renders

**Files:**
- Modify: `src/components/SoundscapeGrid.tsx`
- Modify: `src/components/MapView.tsx`

**Problem:** Every time any voice's `isActive` flips (which happens on every audio `play` and `ended` event), `useSoundscape` calls `setVoices(...)`, which triggers a MapView re-render, which re-creates the `soundscape.toggleMute` reference and re-renders `SoundscapeGrid` in full — all 8 voice cards including the 7 that did not change. During active playback this can fire 2–4 times per second.

- [ ] **Step 1: Wrap SoundscapeGrid in React.memo**

  In `src/components/SoundscapeGrid.tsx`, change the export line:

  ```typescript
  import { memo } from 'react';
  ```

  Wrap the component:
  ```typescript
  export const SoundscapeGrid = memo(function SoundscapeGrid({ voices, onToggleMute }: SoundscapeGridProps) {
    // ... existing body unchanged
  });
  ```

  Because `voices` is a new array reference on every `setVoices` call, memoizing the grid alone is not sufficient — we also need stable item identity (see Step 2).

- [ ] **Step 2: Memoize individual voice cards with a VoiceCard sub-component**

  Extract each card into a memoized `VoiceCard` component inside `SoundscapeGrid.tsx`:

  ```typescript
  import { memo, useCallback } from 'react';
  import type { SoundscapeVoice } from '../hooks/useSoundscape';
  import { Skeleton } from './Skeleton';
  import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
  import { faVolumeHigh, faVolumeXmark } from '@fortawesome/free-solid-svg-icons';

  interface VoiceCardProps {
    voice: SoundscapeVoice;
    index: number;
    onToggleMute: (index: number) => void;
  }

  const VoiceCard = memo(function VoiceCard({ voice, index, onToggleMute }: VoiceCardProps) {
    const handleMute = useCallback(
      (e: React.MouseEvent) => { e.stopPropagation(); onToggleMute(index); },
      [onToggleMute, index],
    );
    // ... render the card JSX (move existing per-voice div here)
    return (
      <div
        key={voice.recording.id}
        className={`relative group rounded-lg ring-2 transition-all duration-300 ${
          voice.isActive ? 'ring-green-400' : 'ring-transparent'
        }`}
      >
        {/* Hover card */}
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-48 bg-gray-900 rounded-lg overflow-hidden shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150 pointer-events-none">
          <div className="aspect-video bg-gray-800">
            {voice.photo ? (
              <img aria-hidden="true" src={voice.photo.largeUrl} alt={voice.recording.en} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-white text-xs text-center px-2">{voice.recording.en}</span>
              </div>
            )}
          </div>
          <div className="p-2 space-y-0.5">
            <p className="text-white text-xs font-semibold truncate">{voice.recording.en}</p>
            <p className="text-gray-400 text-xs italic truncate">{voice.sciName}</p>
            {voice.photo && <p className="text-gray-500 text-xs truncate">{voice.photo.attribution}</p>}
            <p className="text-gray-500 text-xs truncate">Rec: {voice.recording.rec}</p>
          </div>
        </div>
        {/* Mute button */}
        <button
          onClick={handleMute}
          aria-label={voice.isMuted ? 'Unmute bird' : 'Mute bird'}
          className={`absolute top-1 right-1 z-20 w-6 h-6 flex items-center justify-center rounded text-white bg-black/50 hover:bg-black/70 transition-opacity duration-150 ${
            voice.isMuted ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <FontAwesomeIcon icon={voice.isMuted ? faVolumeXmark : faVolumeHigh} className="text-xs" />
        </button>
        {/* Card content */}
        <div className={`relative w-full h-[110px] rounded-lg overflow-hidden bg-black/60 transition-all duration-300 ${
          (!voice.isActive || voice.isMuted) ? 'brightness-50' : ''
        }`}>
          {voice.isLoading ? (
            <Skeleton className="w-full h-full rounded-none" />
          ) : voice.photo ? (
            <img src={voice.photo.photoUrl} alt={voice.recording.en} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center px-1">
              <p className="text-white text-xs text-center leading-tight">{voice.recording.en}</p>
            </div>
          )}
          {!voice.isLoading && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
              <p className={`text-xs text-white truncate transition-opacity duration-300 ${voice.isActive ? 'opacity-100' : 'opacity-60'}`}>
                {voice.recording.en}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  });
  ```

  Update the `SoundscapeGrid` body to use `<VoiceCard>`:
  ```tsx
  export const SoundscapeGrid = memo(function SoundscapeGrid({ voices, onToggleMute }: SoundscapeGridProps) {
    if (voices.length === 0) return null;
    return (
      <div className="grid grid-cols-8 gap-2 p-1 w-full">
        {voices.map((voice, i) => {
          if (voice.isFailed) return null;
          return <VoiceCard key={voice.recording.id} voice={voice} index={i} onToggleMute={onToggleMute} />;
        })}
      </div>
    );
  });
  ```

- [ ] **Step 3: Stabilize onToggleMute in MapView**

  `soundscape.toggleMute` is already a `useCallback` inside `useSoundscape`, so it is stable. No change needed in MapView — just ensure the prop is passed directly:
  ```tsx
  <SoundscapeGrid voices={soundscape.voices} onToggleMute={soundscape.toggleMute} />
  ```
  (This is already the case. The memo boundary in Step 1 is now effective because `onToggleMute` is stable.)

- [ ] **Step 4: Verify**

  Run `npm run test`. In the browser with React DevTools Profiler, trigger playback and confirm that only the card whose `isActive` changed re-renders, not all 8.

---

### Task 3: Memoize SpeciesPanel's derived lists

**Files:**
- Modify: `src/components/SpeciesPanel.tsx`

**Problem:** `SpeciesPanel` calls `deduplicateObs(notableObs)`, `deduplicateObs(recentObs)`, and `.sort(...)` on every render. MapView re-renders whenever any state changes (e.g. `isLoading`, `pin`, `recordings`), so these O(n) passes run more often than the input data changes.

- [ ] **Step 1: Add useMemo imports**

  In `src/components/SpeciesPanel.tsx`, change the import line:
  ```typescript
  import { useState } from 'react';
  ```
  to:
  ```typescript
  import { useState, useMemo } from 'react';
  ```

- [ ] **Step 2: Memoize dedupedNotable**

  Replace:
  ```typescript
  const dedupedNotable = deduplicateObs(notableObs);
  ```
  with:
  ```typescript
  const dedupedNotable = useMemo(() => deduplicateObs(notableObs), [notableObs]);
  ```

- [ ] **Step 3: Memoize dedupedRecent**

  Replace:
  ```typescript
  const dedupedRecent = [...deduplicateObs(recentObs)].sort(
    (a, b) => (b.howMany ?? 0) - (a.howMany ?? 0),
  );
  ```
  with:
  ```typescript
  const dedupedRecent = useMemo(
    () => [...deduplicateObs(recentObs)].sort((a, b) => (b.howMany ?? 0) - (a.howMany ?? 0)),
    [recentObs],
  );
  ```

- [ ] **Step 4: Move isEmpty into a useMemo**

  The `isEmpty` line uses `dedupedNotable` and `dedupedRecent`, which are now memoized, so it is naturally cheap. No further change needed; leave as-is.

- [ ] **Step 5: Verify**

  Run `npm run test`. Confirm no snapshot/output changes in `SpeciesPanel.test.tsx`.

---

### Task 4: Parallelize fillRecordingGaps with the initial fetch

**Files:**
- Modify: `src/components/MapView.tsx`
- Modify: `src/utils/soundscape-recordings.ts`

**Problem:** In `MapView.fetchForPin`, the call sequence is:
1. `await Promise.all([notable, recent, xcRes])` — ~600ms
2. `await fillRecordingGaps(xcRes.recordings, recent, ...)` — which fires N additional XC fetches *serially after* step 1.

This means the soundscape is silent for the duration of both steps combined. The gap-fill fetches can begin as soon as `recentObs` is available (after step 1), but since the XC box query and eBird queries resolve around the same time, we cannot fully parallelize without restructuring. What we *can* do is:
- Start gap-fill XC fetches in parallel with the notable-obs fetch (they only need `recentObs` + the box results).
- Accept the first batch of recordings immediately and let gap fills stream in separately.

The cleanest approach that avoids a large restructure is to set recordings from the box query first (eliminating the gap-fill waterfall for the common case) and then fire gap-fill fetches as a background update.

- [ ] **Step 1: Change fillRecordingGaps to return a Promise that resolves in two stages**

  Rename `fillRecordingGaps` to `fillRecordingGapsAsync` and export a new version that calls back with incremental results:

  In `src/utils/soundscape-recordings.ts`, add an `onUpdate` callback parameter:

  ```typescript
  export async function fillRecordingGaps(
    existing: XCRecording[],
    recentObs: EBirdObservation[],
    target: number,
    onUpdate?: (updated: XCRecording[]) => void,
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

    const combined = [...existing, ...gapRecordings];
    onUpdate?.(combined);
    return combined;
  }
  ```

- [ ] **Step 2: Update fetchForPin in MapView to use two-phase loading**

  Replace the current `fetchForPin` body:

  ```typescript
  const fetchForPin = useCallback(async (pos: LatLng) => {
    if (lastFetchRef.current && haversineKm(pos, lastFetchRef.current) < FETCH_RADIUS_KM) return;
    lastFetchRef.current = pos;

    setIsLoading(true);
    const month = new Date().getMonth() + 1;
    try {
      const [notable, recent, xcRes] = await Promise.all([
        fetchNearbyNotable(pos.lat, pos.lng),
        fetchRecentNearby(pos.lat, pos.lng),
        fetchRecordingsByBox(
          pos.lat - XC_BOX_DEG,
          pos.lat + XC_BOX_DEG,
          pos.lng - XC_BOX_DEG,
          pos.lng + XC_BOX_DEG,
          month,
        ),
      ]);
      setNotableObs(notable);
      setRecentObs(recent);
      // Set initial recordings immediately so soundscape can begin loading
      setRecordings(xcRes.recordings);
      setIsLoading(false);
      // Fire gap-fill in background — updates recordings state when done
      void fillRecordingGaps(
        xcRes.recordings,
        recent,
        MAX_VOICES + SPARE_VOICES,
        updated => setRecordings(updated),
      );
    } catch {
      setIsLoading(false);
    }
  }, []);
  ```

  Note: remove the `finally { setIsLoading(false); }` block and inline `setIsLoading(false)` before gap-fill so the loading spinner clears as soon as the first batch arrives.

- [ ] **Step 3: Verify**

  Run `npm run test`. Manually verify that after clicking a pin, bird cards appear and begin loading within ~600ms (box query round-trip), and a second wave of cards may appear shortly after if gap-fills find additional species.

---

### Task 5: Fix audio resource leak in useSoundscape unmount cleanup

**Files:**
- Modify: `src/hooks/useSoundscape.ts`

**Problem:** The unmount `useEffect` at line 341–346 only calls `audio.pause()` on each `HTMLAudioElement`. It does not set `audio.src = ''` and call `audio.load()`. This means the browser keeps the audio resource referenced (preventing GC), and any pending network requests or decode tasks for the MP3 continue running after the component unmounts. Over a session with many pin clicks, this accumulates stale `Audio` objects. The data-change `useEffect` cleanup calls `stopAll()` which does clear `src`, so the gap is only in the *unmount* path.

- [ ] **Step 1: Update the unmount cleanup effect**

  In `src/hooks/useSoundscape.ts`, replace the unmount cleanup effect (lines 341–346):

  ```typescript
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
      audioRefs.current.forEach(a => a.pause());
    };
  }, []);
  ```

  with:

  ```typescript
  // Cleanup on unmount — clear src to release network/decode resources
  useEffect(() => {
    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
      audioRefs.current.forEach(a => {
        a.pause();
        a.src = '';
        a.load();
      });
      audioRefs.current = [];
      timersRef.current = [];
    };
  }, []);
  ```

- [ ] **Step 2: Verify**

  Run `npm run test`. Confirm `useSoundscape.test.ts` still passes. In the browser, navigate away from the map and back several times while audio is playing — confirm no audio bleeds through after navigation.
