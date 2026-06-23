# Runtime Performance Profiling Guide

This guide explains how to profile Tweetr's runtime performance in Chrome DevTools and Firefox DevTools/Profiler. Start the app with `netlify dev` or `npm run preview` before profiling.

## What to Look For

The main runtime concerns:
- **Frame rate during map panning** — marker cluster updates should not drop frames
- **Memory growth** — the LRU cap (30 cells) should keep heap bounded
- **Debounce effectiveness** — only 1 API call per 1° grid cell, not per `moveend` event
- **CDN cache hits** — hotspot API responses should be served from cache after the first visit

---

## Chrome DevTools

### Performance Tab — Recording a Panning Session

1. Open Chrome DevTools (`F12` or `Cmd+Option+I`)
2. Click the **Performance** tab
3. Click the ⚙️ gear icon and check **Disable JavaScript samples** OFF (you want JS samples)
4. Click **Record** (circle button)
5. Pan the map continuously for 10–15 seconds across several areas
6. Click **Stop**

**What to look for:**

- **Long tasks (red triangles in the Main thread)** — any JS task over 50ms blocks the main thread and causes a visible frame drop. Click on them to see the call stack.
- **Cluster group updates** — search for `addLayers` in the flame chart. This is the Leaflet marker cluster rebuild. It should be a short burst (<20ms) after each pan settles.
- **GC events** — garbage collection pauses appear as yellow segments. Frequent GC suggests memory pressure.
- **FPS gauge** — the green line at the top. A dip below 30 FPS during panning is noticeable to users.

**Interpreting the flame chart:**

- Taller stacks = deeper call chains (not necessarily slow)
- **Wide bars = slow functions** — focus on wide bars in the JS flame chart
- Click any bar to see the function name and source location
- Use the **Bottom-Up** tab to see which functions consumed the most self-time

---

### Memory Tab — Verifying the LRU Cap

1. Open DevTools → **Memory** tab
2. Select **Heap snapshot** and click **Take snapshot** (baseline)
3. Pan the map to 10–15 different areas (zoom in to zoom ≥ 5 to trigger fetches)
4. Return to the Memory tab and click **Take snapshot** again

**Comparing snapshots:**

- Look at the **total heap size** shown at the top of each snapshot. Healthy growth: a few MB for marker objects + tile images. Concerning: linear growth that doesn't plateau.
- In the snapshot view, type `Marker` in the **Class filter** box — you should see Leaflet marker instances. After visiting >30 areas, the count should plateau (eviction is working).
- Switch to the **Comparison** view (dropdown at top) to diff snapshot 1 vs. snapshot 2. Look at the **# Delta** column — large positive numbers on `Marker` or `DivIcon` rows mean markers are accumulating.

---

### Network Tab — Verifying Debounce and CDN Caching

1. Open DevTools → **Network** tab
2. Type `/api/ebird/ref/hotspot` in the **Filter** box
3. Pan the map rapidly across several areas for 5–10 seconds

**Debounce verification:**
- During rapid panning, you should see requests fire roughly 600ms after you stop (not continuously)
- Each request URL should have a unique `lat` and `lng` (the snapped 1° cell center)
- Revisiting an area you've already viewed should produce no new request for that cell

**CDN cache verification (production only):**
- In the response headers for a hotspot request, look for:
  `cache-control: public, s-maxage=604800`
- A second visit to the same area from any user hits the Netlify CDN edge cache; the response time will drop from ~200ms to ~10ms

---

## Firefox DevTools

### Firefox Profiler

Firefox's profiler is excellent for JS flame graphs and is available at [profiler.firefox.com](https://profiler.firefox.com).

**Option A — Built-in DevTools Performance tab:**

1. Open Firefox DevTools (`F12`)
2. Click the **Performance** tab
3. Click **Start Recording**
4. Pan the map for 10–15 seconds
5. Click **Stop Recording**

The recording appears inline. Use the **JS Flame Chart** view to see JS execution by time slice, and the **Call Tree** tab to see cumulative time per function.

**Option B — Firefox Profiler extension (recommended for deeper analysis):**

1. Install the [Firefox Profiler browser extension](https://profiler.firefox.com/)
2. Click the extension icon → **Start recording**
3. Pan the map
4. Click **Capture profile** → opens profiler.firefox.com with your profile

The profiler.firefox.com UI offers:
- **Flame Graph** — same as Chrome but with better filtering controls
- **Stack Chart** — shows which functions were on the call stack at each moment
- **Network** — overlays network requests on the timeline (useful for seeing when debounced fetches fire)
- **Markers** — GC events, layout events

**What to look for:** same as Chrome — wide bars in the flame graph, GC pauses, jank during panning.

---

### Firefox Memory Panel

1. Open DevTools → **Memory** tab
2. Click **Take snapshot** (baseline)
3. Pan to 10+ areas and return to Memory
4. Click **Take snapshot** again
5. Use the **Dominator tree** view to find large retained objects

Note: Firefox does not expose `performance.memory` to JavaScript — heap size can only be inspected through DevTools, not measured programmatically (this is why the automated memory test only runs in Chrome).

---

## Running Automated Performance Tests

```bash
npm run build
npm run test:e2e          # run all tests, generate HTML report
npm run test:e2e:report   # open the report in a browser
```

The report shows:
- Load time (DCL in ms, per browser)
- API call counts for debounce and dedup scenarios
- Heap baseline, final, and growth in MB (Chrome only)
