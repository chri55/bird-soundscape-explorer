# Park Marker Clustering Design

## Goal

Cluster the ~500 NPS park markers at higher zoom levels so the map is readable and performant when zoomed out, while still showing individual parks when zoomed in.

## Approach

Use `leaflet.markercluster` directly via react-leaflet's `useMap()` hook — no React wrapper package — to avoid compatibility uncertainty with react-leaflet v5. A new `<ParkClusterLayer>` component owns the cluster group lifecycle.

---

## New Component: `ParkClusterLayer`

`src/components/ParkClusterLayer.tsx`

**Props:**
```typescript
interface ParkClusterLayerProps {
  parks: NpsPark[];
  onParkClick: (pos: LatLng) => void;
}
```

**Lifecycle:**
- Uses `useMap()` from react-leaflet to get the Leaflet map instance
- In a `useEffect` keyed on `parks` and `onParkClick`:
  1. Create `L.markerClusterGroup({ iconCreateFunction })`
  2. For each park, create `L.marker(position, { icon: parkIcon })` with a click handler that calls `onParkClick({ lat, lng })`
  3. Add all markers to the cluster group via `clusterGroup.addLayers(markers)`
  4. Add the cluster group to the map: `map.addLayer(clusterGroup)`
  5. Cleanup: `map.removeLayer(clusterGroup)`

**Custom cluster icon (`iconCreateFunction`):**
```typescript
(cluster) => L.divIcon({
  html: `<div style="background:#16a34a;width:32px;height:32px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:600">${cluster.getChildCount()}</div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})
```

This matches the existing `parkIcon` green (`#16a34a`), white border, and drop-shadow — but larger (32×32px) with the count centered in white text.

**CSS:** Import only `leaflet.markercluster/dist/MarkerCluster.css` (for spiderfy animation). Skip `MarkerCluster.Default.css` (blue/yellow/red defaults we're replacing).

---

## MapView Changes

`src/components/MapView.tsx`

Replace the current park marker block:
```tsx
{parks.map(park => (
  <Marker key={park.parkCode} position={...} icon={parkIcon} eventHandlers={...}>
    <Popup>{park.fullName}</Popup>
  </Marker>
))}
```

With:
```tsx
<ParkClusterLayer parks={parks} onParkClick={handlePin} />
```

The `parkIcon` definition moves from `MapView.tsx` into `ParkClusterLayer.tsx` since only that component uses it.

---

## Packages

| Package | Purpose |
|---------|---------|
| `leaflet.markercluster` | Clustering engine (imperative Leaflet layer) |
| `@types/leaflet.markercluster` | TypeScript types |

---

## Cluster Behavior

| User action | Result |
|-------------|--------|
| Zoomed out, many parks nearby | Green bubble with count |
| Click cluster (fits in viewport) | Zooms in to show subclusters or individual markers |
| Click cluster (doesn't fit) | Spiderfies markers outward |
| Click individual park marker | Calls `handlePin` → triggers bird fetch |

---

## Files Touched

| File | Change |
|------|--------|
| `src/components/ParkClusterLayer.tsx` | New — owns cluster group, custom icon, click handler |
| `src/components/MapView.tsx` | Replace park `<Marker>` block with `<ParkClusterLayer>` |
| `package.json` | Add `leaflet.markercluster` + `@types/leaflet.markercluster` |

No changes to `useNpsParks`, `SpeciesPanel`, `useSoundscape`, or any other file.

---

## Testing

`ParkClusterLayer` uses `useMap()` which requires a `MapContainer` context — it cannot be rendered in unit tests without a full Leaflet environment. The existing `MapView.test.tsx` mocks `react-leaflet`, so `ParkClusterLayer` won't be exercised there. No unit tests for this component; correctness is verified by running the dev server and clicking the map at different zoom levels.
