# Park Marker Clustering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cluster the ~500 NPS park markers at higher zoom levels using `leaflet.markercluster`, replacing the individual `<Marker>` elements in MapView with a self-contained `<ParkClusterLayer>` component.

**Architecture:** A new `ParkClusterLayer` component uses react-leaflet's `useMap()` hook to access the Leaflet map instance imperatively, creates a `L.markerClusterGroup` with a custom green icon, and adds/removes it via `useEffect`. MapView replaces its `{parks.map(...)}` block with `<ParkClusterLayer>`. No unit tests are possible (requires a real Leaflet DOM environment); correctness is verified by running the dev server.

**Tech Stack:** React 19 + TypeScript, react-leaflet v5, leaflet 1.9, leaflet.markercluster, Vite 8

## Global Constraints

- verbatimModuleSyntax: true — type-only imports must use `import type { ... }` on a separate line
- Run tests: `npm run test`; existing 135 tests must still pass after this change
- Cluster icon: green `#16a34a`, 32×32px circle, white border + shadow, white bold count centered — matching the existing `parkIcon` style

---

### Task 1: Add leaflet.markercluster, create ParkClusterLayer, wire into MapView

**Files:**
- Create: `src/components/ParkClusterLayer.tsx`
- Modify: `src/components/MapView.tsx`

**Interfaces:**
- Consumes: `NpsPark` from `../api/nps`, `LatLng` from `../utils/geo`
- Produces: `<ParkClusterLayer parks={NpsPark[]} onParkClick={(pos: LatLng) => void} />` — a component that renders `null` but manages a Leaflet cluster layer as a side effect

- [ ] **Step 1: Install packages**

```bash
npm install leaflet.markercluster
npm install --save-dev @types/leaflet.markercluster
```

Expected: both packages appear in `package.json` dependencies / devDependencies.

- [ ] **Step 2: Create `src/components/ParkClusterLayer.tsx`**

Create the file with this exact content:

```typescript
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type { NpsPark } from '../api/nps';
import type { LatLng } from '../utils/geo';

const parkIcon = L.divIcon({
  html: '<div style="background:#16a34a;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>',
  className: '',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

interface ParkClusterLayerProps {
  parks: NpsPark[];
  onParkClick: (pos: LatLng) => void;
}

export function ParkClusterLayer({ parks, onParkClick }: ParkClusterLayerProps) {
  const map = useMap();

  useEffect(() => {
    const clusterGroup = L.markerClusterGroup({
      iconCreateFunction: (cluster: L.MarkerCluster) =>
        L.divIcon({
          html: `<div style="background:#16a34a;width:32px;height:32px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:600">${cluster.getChildCount()}</div>`,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        }),
    });

    const markers = parks.map(park => {
      const lat = parseFloat(park.latitude);
      const lng = parseFloat(park.longitude);
      const marker = L.marker([lat, lng], { icon: parkIcon });
      marker.on('click', () => onParkClick({ lat, lng }));
      return marker;
    });

    clusterGroup.addLayers(markers);
    map.addLayer(clusterGroup);

    return () => {
      map.removeLayer(clusterGroup);
    };
  }, [map, parks, onParkClick]);

  return null;
}
```

- [ ] **Step 3: Update `src/components/MapView.tsx`**

**3a.** Replace the react-leaflet import on line 2. Remove `Popup` (only used for park markers, which move to ParkClusterLayer) and add `ParkClusterLayer` import:

```typescript
// Before (line 2):
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';

// After:
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
```

Add the ParkClusterLayer import after line 21 (after the `useNpsParks` import):

```typescript
import { ParkClusterLayer } from './ParkClusterLayer';
```

**3b.** Remove the `parkIcon` constant (lines 33–39):

```typescript
// Remove this entire block:
const parkIcon = L.divIcon({
  html: '<div style="background:#16a34a;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>',
  className: '',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -8],
});
```

**3c.** Replace the park markers block in the JSX. Find this block (around lines 135–144):

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

Replace with:

```tsx
<ParkClusterLayer parks={parks} onParkClick={handlePin} />
```

- [ ] **Step 4: Run tests**

```bash
npm run test
```

Expected: 135 tests pass, 0 failures. (The new component is not unit-tested — it requires a real Leaflet DOM environment — but the existing suite must remain green.)

- [ ] **Step 5: Verify visually**

```bash
npm run dev
```

Open the app in a browser. Set a `VITE_NPS_API_KEY` in `.env.local` if parks aren't loading.

Check:
- Zoomed out (zoom 4): parks appear as green numbered clusters (e.g. "47", "120")
- Zoom in: clusters split into smaller clusters or individual green dots
- Click a cluster that fits the viewport: map zooms in to show sub-clusters
- Click a cluster that doesn't fit: markers spiderfy outward
- Click an individual park marker: the species panel populates with birds from that location

- [ ] **Step 6: Commit**

```bash
git add src/components/ParkClusterLayer.tsx src/components/MapView.tsx package.json package-lock.json
git commit -m "feat: cluster NPS park markers with leaflet.markercluster, green icon with count"
```
