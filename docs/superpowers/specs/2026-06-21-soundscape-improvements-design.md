# Soundscape Improvements Design

## Goal

Three small improvements to the soundscape bar and map:

1. **Mute-all button** — silence or restore all voices at once for selective listening
2. **US-centered map** — start the Leaflet map over the continental US instead of the world midpoint
3. **Loaded audio count** — show how many audio tracks are ready, not just how many are queued

---

## 1. Mute-all Button

### Behavior

A "Mute / Unmute" button appears below the play/pause button in `SoundscapeControls`. Label logic:

- At least one voice unmuted → label is **"Mute"** (clicking will mute all)
- All voices muted → label is **"Unmute"** (clicking will unmute all)

**Mute all:** Pause every `HTMLAudioElement`, set `isMutedRef.current` to all `true`, update `voices` state to `isMuted: true, isActive: false` for every voice.

**Unmute all:** Set `isMutedRef.current` to all `false`, update `voices` state to `isMuted: false`. If `isPlayingRef.current` is true, call `startVoice(i)` for each index — matching the existing per-voice unmute behaviour.

The button is visible whenever the soundscape bar is visible (`voiceCount > 0`), regardless of play/pause state.

### `useSoundscape` changes

Add to `UseSoundscapeResult`:

```typescript
muteAll: () => void;
allMuted: boolean;
```

`allMuted` is a derived value: `voices.length > 0 && voices.every(v => v.isMuted)`.

`muteAll` is a `useCallback` that reads `isMutedRef.current` to decide direction, then updates both the ref and React state in one call.

### `SoundscapeControls` changes

New props:

```typescript
allMuted: boolean;
onMuteAll: () => void;
```

Layout change: wrap the play button and new mute-all button in a `flex flex-col items-center gap-1` column, keeping the count label beside the column.

```
[ ▶/⏸  ]   5 birds ready
[ Mute  ]
```

Mute-all button style: small text button (`text-xs text-gray-300 hover:text-white`), no ring/circle so it reads as a secondary control.

### `MapView` changes

Pass the two new props to `SoundscapeControls`:

```tsx
allMuted={soundscape.allMuted}
onMuteAll={soundscape.muteAll}
```

---

## 2. US-Centered Map

Single change in `MapView.tsx`:

```tsx
// Before
<MapContainer center={[20, 0]} zoom={3} ...>

// After
<MapContainer center={[39.5, -98.35]} zoom={4} ...>
```

`[39.5, -98.35]` is the geographic center of the contiguous United States. Zoom 4 shows all 48 states on a typical desktop viewport.

---

## 3. Loaded Audio Count

### `useSoundscape` changes

Add to `UseSoundscapeResult`:

```typescript
loadedCount: number;
```

Computed as `voices.filter(v => !v.isLoading && !v.isFailed).length`. This goes from 0 → N as each `HTMLAudioElement` fires `canplay`.

### `SoundscapeControls` changes

New prop:

```typescript
loadedCount: number;
```

The `voiceCount` prop remains (controls bar show/hide: hide when `voiceCount === 0`). Display text changes from `voiceCount` to `loadedCount`:

```
// Playing:  "5 birds playing"   (5 = loaded, not queued)
// Paused:   "5 birds ready"     (count ticks up as audio loads)
```

### `MapView` changes

Pass `loadedCount` to `SoundscapeControls`:

```tsx
loadedCount={soundscape.loadedCount}
```

---

## Files Touched

| File | Change |
|------|--------|
| `src/hooks/useSoundscape.ts` | Add `muteAll`, `allMuted`, `loadedCount` to hook return |
| `src/hooks/useSoundscape.test.ts` | Add tests for `muteAll`, `allMuted`, `loadedCount` |
| `src/components/SoundscapeControls.tsx` | New props, mute-all button, loadedCount in text |
| `src/components/SoundscapeControls.test.tsx` | Update existing text tests, add mute-all tests |
| `src/components/MapView.tsx` | Pass new props; change map center/zoom |

No new files. No changes to `SoundscapeGrid`, `useSoundscape` tests (hook test file covers the hook logic), or other components.

---

## Testing

`SoundscapeControls` tests (update + add):

- Update "shows N birds playing/ready" tests to pass both `voiceCount` and `loadedCount`
- Update `renders nothing when voiceCount is 0` — now also needs `loadedCount={0}` and the two new props
- Add: mute-all button renders with label "Mute" when `allMuted={false}`
- Add: mute-all button renders with label "Unmute" when `allMuted={true}`
- Add: clicking mute-all button calls `onMuteAll`
- Add: `loadedCount` shown in status text (not `voiceCount`)

`useSoundscape` unit tests (add to existing test file):

- `muteAll` mutes all voices when at least one is unmuted
- `muteAll` unmutes all voices when all are muted
- `allMuted` is false when no voices are muted
- `allMuted` is true when all voices are muted
- `allMuted` is false when voices array is empty
- `loadedCount` equals the number of voices with `isLoading: false` and `isFailed: false`
