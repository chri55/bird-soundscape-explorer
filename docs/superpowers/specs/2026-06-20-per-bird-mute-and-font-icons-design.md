# Per-Bird Mute Button + Font Awesome Icons Design

## Goal

Add a mute button to each bird card in the now-playing bar. Muting a bird stops its playback until the button is clicked again or the master play button is pressed. Replace existing emoji play/pause icons with Font Awesome icons and add mute/unmute icons to each bird card.

---

## Font Awesome Setup

Install three packages:

```
@fortawesome/fontawesome-svg-core
@fortawesome/free-solid-svg-icons
@fortawesome/react-fontawesome
```

Icons used:
- Master button: `faPlay`, `faPause`
- Per-bird muted: `faVolumeXmark`
- Per-bird unmuted: `faVolumeHigh`

---

## Audio Engine (`src/hooks/useSoundscape.ts`)

### New state: `isMuted` on `SoundscapeVoice`

```typescript
export interface SoundscapeVoice {
  // existing fields...
  isMuted: boolean;   // new
}
```

Initialized to `false` on rebuild.

### New ref: `isMutedRef`

```typescript
const isMutedRef = useRef<boolean[]>([]);
```

Mirrors `isMuted` state for use inside closures (same pattern as `pendingEndedRef`). Reset to `[]` on rebuild alongside other refs.

### New export: `toggleMute(index: number)`

Added to `UseSoundscapeResult` and returned from the hook.

**Mute (unmuted → muted):**
1. `isMutedRef.current[index] = true`
2. `audio.pause(); audio.currentTime = 0`
3. `setVoices(...)` → `isMuted: true, isActive: false` for that voice

**Unmute (muted → unmuted):**
1. `isMutedRef.current[index] = false`
2. `setVoices(...)` → `isMuted: false` for that voice
3. If `isPlayingRef.current`, call `startVoice(index)` to resume immediately

### Changes to `startVoice(index)`

Add one early-return guard:

```typescript
if (!audio || !isPlayingRef.current || isMutedRef.current[index]) return;
```

Stagger timers that fire while a voice is muted are silently skipped.

### Changes to the `ended` handler

Inside the `ended` listener, before scheduling the next cycle timer:

```typescript
if (!isPlayingRef.current || isMutedRef.current[index]) return;
```

A muted voice that finishes its current audio clip does not restart.

### Changes to `toggle()` (master play, paused → playing)

Before scheduling stagger timers, clear all mutes:

```typescript
const count = audioRefs.current.length;
isMutedRef.current = new Array(count).fill(false);
setVoices(v => v.map(voice => ({ ...voice, isMuted: false })));
```

This is the "master play clears all mutes" behavior.

---

## Components

### `SoundscapeControls` (`src/components/SoundscapeControls.tsx`)

Replace emoji with Font Awesome icons:
- `▶` → `<FontAwesomeIcon icon={faPlay} />`
- `⏸` → `<FontAwesomeIcon icon={faPause} />`

No other changes.

### `SoundscapeGrid` (`src/components/SoundscapeGrid.tsx`)

New prop: `onToggleMute: (index: number) => void`.

Per-card mute button rules:
- Rendered as a small `<button>` overlaid in the **top-right corner** of each card.
- If `voice.isMuted`: show `faVolumeXmark` — **always visible** (user must be able to unmute without hovering).
- If not muted: show `faVolumeHigh` — **hover only** (`opacity-0 group-hover:opacity-100 transition-opacity`).
- Muted cards apply `brightness-50` dimming (same as inactive cards).
- Button click calls `onToggleMute(index)` and calls `e.stopPropagation()`.

**Index preservation:** Change the render from `voices.filter(v => !v.isFailed).map(voice => ...)` to `voices.map((voice, i) => voice.isFailed ? null : ...)` so the original voice index `i` is always available to pass to `onToggleMute(i)`. `toggleMute` operates on `audioRefs.current[index]` and must receive the index in the original `voices` array, not a filtered array's index.

### `MapView` (`src/components/MapView.tsx`)

Pass `soundscape.toggleMute` to `SoundscapeGrid` as `onToggleMute`.

### `UseSoundscapeResult` interface

```typescript
export interface UseSoundscapeResult {
  voices: SoundscapeVoice[];
  isPlaying: boolean;
  toggle: () => void;
  toggleMute: (index: number) => void;   // new
}
```

---

## Testing

### `src/hooks/useSoundscape.test.ts` — 5 new tests

1. **`toggleMute mutes a voice: stops audio and marks it isMuted`** — after play starts and a voice is active, call `toggleMute(0)`, assert `voices[0].isMuted === true`, `voices[0].isActive === false`, and `audioInstances[0].pause` was called.

2. **`muted voice does not restart after its audio ends`** — mute voice 0 while playing, emit `ended` on its audio element, assert no new timer is scheduled for it (timer count unchanged).

3. **`toggleMute unmutes and resumes playback`** — mute then unmute voice 0 while playing, assert `voices[0].isMuted === false` and `audioInstances[0].play` was called again.

4. **`master play clears all mutes`** — mute voice 0, toggle pause → play (master button), advance past stagger, assert `voices[0].isMuted === false`.

5. **`muted voice is skipped by startVoice stagger timer`** — mute voice 0, press master play, advance timers past stagger, assert `audioInstances[0].play` was NOT called for voice 0.

### `src/components/SoundscapeGrid.test.tsx` — 1 new test

- Renders `faVolumeXmark` icon (aria-label or icon class) for a voice with `isMuted: true`.

### `src/components/SoundscapeControls.test.tsx` — 1 new test

- Renders Font Awesome icon markup (not the `▶`/`⏸` emoji strings) for both play and pause states.

---

## Constraints

- `verbatimModuleSyntax: true` — all type-only imports must use `import type`
- Vitest `globals: true` — no explicit test framework imports in test files
- Mute state resets to `false` for all voices on rebuild (new pin dropped)
- `stopAll` is unchanged — still called only from the rebuild `useEffect`
- The mute button must not interfere with the hover card (pointer-events handled correctly)
