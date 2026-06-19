# Spec: Bird Soundscape Audio Player

**Date:** 2026-06-19
**Scope:** Audio playback engine + visual bird-card grid + control bar

---

## Summary

When a user drops a pin, up to 8 species voices play their Xeno-canto recordings in a staggered loop. More common species cry more frequently; rarer ones cry less often. A grid of bird photos floats over the bottom of the map — each card lights up when that bird is actively calling, and dims when it is silent. A Teams-style control bar sits at the bottom of the screen.

---

## Architecture

Three new units, one modified:

| Unit | Type | Responsibility |
|---|---|---|
| `src/hooks/useSoundscape.ts` | Hook | Voice selection, scheduling, per-voice `isActive` state |
| `src/components/SoundscapeGrid.tsx` | Component | Floating photo strip over map bottom; active/dim visual |
| `src/components/SoundscapeControls.tsx` | Component | Full-width bottom bar: play/pause button + status label |
| `src/components/MapView.tsx` | Modified | Compose the above; position map container as `relative` |

---

## Hook: `useSoundscape`

### Signature

```typescript
interface SoundscapeVoice {
  recording: XCRecording;
  sciName: string;
  howMany: number;
  intervalMs: number;
  isActive: boolean;
  photo: BirdPhoto | null;
}

interface UseSoundscapeResult {
  voices: SoundscapeVoice[];
  isPlaying: boolean;
  toggle: () => void;
}

function useSoundscape(
  recordings: XCRecording[],
  recentObs: EBirdObservation[],
): UseSoundscapeResult
```

### Voice Selection

1. Build `Map<sciName, howMany>` from `recentObs` (sciName = `obs.sciName`).
2. For each unique species in `recordings`, pick the single best recording using the same ranking as `bestRecording` in `useFeaturedBird`: quality A > B > C > D > E, then song > call > other.
3. Sort candidates by `howMany` descending. Take `N = Math.min(8, candidates.length)` voices, with a minimum of whatever is available (no artificial floor — if only 3 species have recordings, use 3).
4. Species with no matching `recentObs` entry get `howMany = 1` (present but uncounted).

### Interval Formula

```
MIN_INTERVAL_MS = 5_000   // most common species: ~5s gap
MAX_INTERVAL_MS = 90_000  // least common species: ~90s gap
JITTER_FACTOR   = 0.25    // ±25% random jitter per cycle
```

Given the selected voices sorted by `howMany`:
- Normalize each: `ratio = (howMany - minHowMany) / (maxHowMany - minHowMany)` (clamp to [0,1]; if all equal, ratio = 0.5 for all)
- `baseInterval = MAX_INTERVAL_MS - ratio * (MAX_INTERVAL_MS - MIN_INTERVAL_MS)`
- Each cycle: `actualInterval = baseInterval * (1 + (Math.random() * 2 - 1) * JITTER_FACTOR)`

### Scheduling

- Uses one `HTMLAudioElement` per voice (created once, reused across cycles).
- `isActive` flips `true` on `audio.play()`, `false` on the `ended` event.
- On play start, voices are staggered with random initial offsets in `[0, 3000]` ms so they don't all fire at once.
- On `ended`: schedule next play via `setTimeout(play, actualInterval)`.
- On `toggle()` to stop: call `audio.pause(); audio.currentTime = 0` on all voices, clear all pending timeouts, set all `isActive` to `false`.
- On `toggle()` to play: restart scheduling from the staggered initial offsets.
- When `recordings` or `recentObs` changes (new pin): stop current playback, rebuild voices, do NOT auto-play (user must press play again).

### Photos

Fetch `fetchBirdPhoto(sciName)` for each voice in parallel after voice selection. The session-level cache in `inat.ts` prevents re-fetching species seen in earlier pin drops. Store result in `SoundscapeVoice.photo` (null if fetch fails or returns null).

---

## Component: `SoundscapeGrid`

```typescript
interface SoundscapeGridProps {
  voices: SoundscapeVoice[];
}
```

- Rendered absolutely inside the map container: `position: absolute; bottom: 0; left: 0; z-index: 20; padding: 8px`
- Hidden (render nothing) when `voices.length === 0`.
- Horizontal flex row of cards, each ~90×110px.
- **Inactive card**: hero image at 50% brightness (`filter: brightness(0.5)`), species common name below in small white text, semi-transparent dark background (`bg-black/60`).
- **Active card**: full brightness, `ring-2 ring-green-400` glow, species name fully opaque. Smooth transition: `transition-all duration-300`.
- Hero image: `SoundscapeVoice.photo.photoUrl` if available, else `recording.sono.small` spectrogram as fallback, else a dark placeholder.
- Common name: derive from `recording.en` (XC English name field).
- No click interaction on these cards — display only.

---

## Component: `SoundscapeControls`

```typescript
interface SoundscapeControlsProps {
  isPlaying: boolean;
  voiceCount: number;
  onToggle: () => void;
}
```

- Full-width bar at the bottom of the screen (`shrink-0` in the flex column layout).
- Hidden when `voiceCount === 0`.
- Dark background (`bg-gray-900`), centered content.
- **Play/pause button**: large circular button, green when playing, white when paused. Icon: ▶ (play) or ⏸ (pause).
- **Status label**: `"5 birds playing"` when playing; `"5 birds ready"` when paused.

---

## Layout (MapView changes)

```
┌────────────────────────────────────────────────────┐
│  Header                                            │
├────────────────────────────────────────┬───────────┤
│  Map (position: relative)              │ Featured  │
│                                        │ Bird Card │
│  ┌──────────────────────────────────┐  │           │
│  │ [card] [card] [card] [card] ...  │  │           │
│  └──────────────────────────────────┘  │           │
├────────────────────────────────────────┴───────────┤
│  SoundscapeControls (full-width bottom bar)        │
└────────────────────────────────────────────────────┘
```

- Map container: add `relative` so the `SoundscapeGrid` positions inside it.
- `SoundscapeControls`: new last child of the outermost `flex flex-col h-screen` div.
- `SoundscapeGrid`: child of the map container div (not MapContainer itself), rendered after `<MapContainer>`.

---

## Files

| File | Action |
|---|---|
| `src/hooks/useSoundscape.ts` | Create |
| `src/hooks/useSoundscape.test.ts` | Create |
| `src/components/SoundscapeGrid.tsx` | Create |
| `src/components/SoundscapeGrid.test.tsx` | Create |
| `src/components/SoundscapeControls.tsx` | Create |
| `src/components/SoundscapeControls.test.tsx` | Create |
| `src/components/MapView.tsx` | Modify |

---

## Testing

- **`useSoundscape`**: mock `fetchBirdPhoto`, mock `HTMLAudioElement`, test voice selection (top N by howMany), interval formula (most common gets shorter interval), `isActive` toggling, voices reset when recordings change.
- **`SoundscapeGrid`**: renders nothing when `voices = []`; active card has ring class; inactive card has brightness class; photo fallback to spectrogram.
- **`SoundscapeControls`**: hidden when `voiceCount = 0`; shows correct label; calls `onToggle`.

---

## Definition of Done

- `useSoundscape` selects correct voices and computes intervals per formula
- `isActive` per voice correctly tracks audio play/ended lifecycle
- Visual cards light up and dim in sync with audio activity
- Play/pause button starts and stops all voices
- New pin drop stops playback and rebuilds voice set
- `npm run build` clean, `npm test` passes
