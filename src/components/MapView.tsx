import { useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

import type { LatLng } from '../utils/geo';
import { haversineKm } from '../utils/geo';
import type { EBirdObservation } from '../api/ebird';
import { fetchRecentNearby, fetchNearbyNotable } from '../api/ebird';
import type { XCRecording } from '../api/xeno-canto';
import { fetchRecordingsByBox } from '../api/xeno-canto';
import { useFeaturedBird } from '../hooks/useFeaturedBird';
import { FeaturedBirdCard } from './FeaturedBirdCard';

const defaultIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconRetinaUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const FETCH_RADIUS_KM = 10;
const DEBOUNCE_MS = 500;
const XC_BOX_DEG = 0.225; // ~25km box around pin

function PinHandler({ onPin }: { onPin: (pos: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPin({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function MapView() {
  const [pin, setPin] = useState<LatLng | null>(null);
  const [notableObs, setNotableObs] = useState<EBirdObservation[]>([]);
  const [recentObs, setRecentObs] = useState<EBirdObservation[]>([]);
  const [recordings, setRecordings] = useState<XCRecording[]>([]);

  const lastFetchRef = useRef<LatLng | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const featured = useFeaturedBird({
    notableObservations: notableObs,
    recentObservations: recentObs,
    recordings,
  });

  const fetchForPin = useCallback(async (pos: LatLng) => {
    if (lastFetchRef.current && haversineKm(pos, lastFetchRef.current) < FETCH_RADIUS_KM) return;
    lastFetchRef.current = pos;

    const month = new Date().getMonth() + 1;

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
    setRecordings(xcRes.recordings);
  }, []);

  const handlePin = useCallback(
    (pos: LatLng) => {
      setPin(pos);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void fetchForPin(pos), DEBOUNCE_MS);
    },
    [fetchForPin],
  );

  return (
    <div className="flex flex-col h-screen">
      <header className="px-4 py-2 bg-green-800 text-white flex items-center gap-3 shrink-0">
        <span className="text-lg font-semibold">Bird Soundscape Explorer</span>
        {pin && (
          <span className="text-sm text-green-200 ml-auto">
            {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
          </span>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <MapContainer center={[20, 0]} zoom={3} className="flex-1 cursor-crosshair">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <PinHandler onPin={handlePin} />
          {pin && <Marker position={[pin.lat, pin.lng]} icon={defaultIcon} />}
        </MapContainer>

        {featured.observation && (
          <FeaturedBirdCard
            observation={featured.observation}
            taxon={featured.taxon}
            photo={featured.photo}
            recording={featured.recording}
            isNotable={featured.isNotable}
            mode={featured.mode}
            onToggleMode={featured.onToggleMode}
            showToggle={featured.showToggle}
          />
        )}
      </div>
    </div>
  );
}
