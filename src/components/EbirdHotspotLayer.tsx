import { useEffect, useLayoutEffect, useRef } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type { EBirdHotspot } from '../api/ebird';
import { fetchNearbyHotspots } from '../api/ebird';
import { snapToGrid, cellKey } from '../utils/hotspot-grid';
import type { LatLng } from '../utils/geo';

const HOTSPOT_COLOR = '#2563eb';
const MIN_ZOOM = 5;
const DEBOUNCE_MS = 600;
const MAX_CELLS = 30;

interface EbirdHotspotLayerProps {
  onHotspotClick: (pos: LatLng) => void;
  onNewHotspots?: (hotspots: EBirdHotspot[]) => void;
}

export function EbirdHotspotLayer({ onHotspotClick, onNewHotspots }: EbirdHotspotLayerProps) {
  const map = useMap();

  // All mutable state lives in refs — no re-renders needed since output is pure Leaflet
  const hotspotIconRef = useRef<L.DivIcon | null>(null);
  const fetchedCells = useRef(new Set<string>());
  const cellOrder = useRef<string[]>([]);
  const cellMarkers = useRef(new Map<string, { markers: L.Marker[]; locIds: string[] }>());
  const addedLocIds = useRef(new Set<string>());
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep a stable ref to the click handler so markers don't capture stale closures
  const onHotspotClickRef = useRef(onHotspotClick);
  useLayoutEffect(() => {
    onHotspotClickRef.current = onHotspotClick;
  });

  const onNewHotspotsRef = useRef(onNewHotspots);
  useLayoutEffect(() => {
    onNewHotspotsRef.current = onNewHotspots;
  });

  // Create the cluster group once and add it to the map
  // Also initialise the hotspot icon here so L.divIcon is never called during render
  useEffect(() => {
    hotspotIconRef.current = L.divIcon({
      html: `<div style="background:${HOTSPOT_COLOR};width:10px;height:10px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
      className: '',
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    });

    const clusterGroup = L.markerClusterGroup({
      iconCreateFunction: (cluster: L.MarkerCluster) =>
        L.divIcon({
          html: `<div style="background:${HOTSPOT_COLOR};width:28px;height:28px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:600">${cluster.getChildCount()}</div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
    });
    clusterGroupRef.current = clusterGroup;
    map.addLayer(clusterGroup);
    return () => {
      map.removeLayer(clusterGroup);
      clusterGroupRef.current = null;
      hotspotIconRef.current = null;
    };
  }, [map]);

  const addToCluster = (hotspots: EBirdHotspot[], key: string) => {
    const clusterGroup = clusterGroupRef.current;
    if (!clusterGroup) return; // component unmounted

    const newMarkers: L.Marker[] = [];
    const newLocIds: string[] = [];

    for (const hs of hotspots) {
      if (addedLocIds.current.has(hs.locId)) continue;
      addedLocIds.current.add(hs.locId);
      newLocIds.push(hs.locId);

      const marker = L.marker([hs.lat, hs.lng], { icon: hotspotIconRef.current! });
      marker.bindTooltip(`${hs.locName} · ${hs.numSpeciesAllTime} species`);
      marker.on('click', () => onHotspotClickRef.current({ lat: hs.lat, lng: hs.lng }));
      newMarkers.push(marker);
    }

    if (newMarkers.length > 0) {
      clusterGroup.addLayers(newMarkers);
      cellMarkers.current.set(key, { markers: newMarkers, locIds: newLocIds });
      const addedHotspots = hotspots.filter(hs => newLocIds.includes(hs.locId));
      onNewHotspotsRef.current?.(addedHotspots);
    }
  };

  const evictOldestCell = () => {
    const evictKey = cellOrder.current.shift();
    if (!evictKey) return;

    fetchedCells.current.delete(evictKey); // allow re-fetch if user returns (CDN serves instantly)
    const evicted = cellMarkers.current.get(evictKey);
    if (evicted) {
      clusterGroupRef.current?.removeLayers(evicted.markers);
      for (const locId of evicted.locIds) addedLocIds.current.delete(locId);
      cellMarkers.current.delete(evictKey);
    }
  };

  const fetchCell = async (lat: number, lng: number) => {
    const key = cellKey(lat, lng);
    if (fetchedCells.current.has(key)) return;

    fetchedCells.current.add(key); // guard against duplicate in-flight fetches

    try {
      const results = await fetchNearbyHotspots(snapToGrid(lat), snapToGrid(lng));
      addToCluster(results, key);
      // Only count the cell toward the cap after markers are confirmed in cellMarkers
      if (cellMarkers.current.has(key)) {
        cellOrder.current.push(key);
        if (cellOrder.current.length > MAX_CELLS) evictOldestCell();
      }
    } catch {
      // hotspot layer is non-critical; silently skip on error
    }
  };

  const triggerFetch = () => {
    if (map.getZoom() < MIN_ZOOM) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const center = map.getCenter();
      void fetchCell(center.lat, center.lng);
    }, DEBOUNCE_MS);
  };

  useMapEvents({ moveend: triggerFetch });

  // Fetch once on mount for the initial map position
  useEffect(() => {
    triggerFetch();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // triggerFetch is intentionally excluded — it reads live state via refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
