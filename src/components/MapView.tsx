import { useState, useRef, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
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
import { fillRecordingGaps } from '../utils/soundscape-recordings';
import { useSoundscape, MAX_VOICES, SPARE_VOICES } from '../hooks/useSoundscape';
import { SpeciesPanel } from './SpeciesPanel';
import { SoundscapeGrid } from './SoundscapeGrid';
import { SoundscapeControls } from './SoundscapeControls';
import { useNpsParks } from '../hooks/useNpsParks';

const defaultIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconRetinaUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const parkIcon = L.divIcon({
  html: '<div style="background:#16a34a;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>',
  className: '',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -8],
});

const FETCH_RADIUS_KM = 10;
const DEBOUNCE_MS = 500;
const XC_BOX_DEG = 0.225;

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
  const [isLoading, setIsLoading] = useState(false);

  const lastFetchRef = useRef<LatLng | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const soundscape = useSoundscape(recordings, recentObs);
  const parks = useNpsParks();

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
      setRecordings(await fillRecordingGaps(xcRes.recordings, recent, MAX_VOICES + SPARE_VOICES));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handlePin = useCallback(
    (pos: LatLng) => {
      setPin(pos);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void fetchForPin(pos), DEBOUNCE_MS);
    },
    [fetchForPin],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, []);

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

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        <SpeciesPanel
          notableObs={notableObs}
          recentObs={recentObs}
          recordings={recordings}
          isLoading={isLoading}
        />

        <div className="flex-1 relative z-0 min-h-0">
          <MapContainer center={[39.5, -98.35]} zoom={4} className="w-full h-full cursor-crosshair">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <PinHandler onPin={handlePin} />
            {pin && <Marker position={[pin.lat, pin.lng]} icon={defaultIcon} />}
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
          </MapContainer>
        </div>
      </div>

      {soundscape.voices.length > 0 && (
        <div className="shrink-0 bg-gray-900 flex items-center gap-2 px-3 py-2 relative z-10">
          <SoundscapeControls
            isPlaying={soundscape.isPlaying}
            voiceCount={soundscape.voices.length}
            loadedCount={soundscape.loadedCount}
            allMuted={soundscape.allMuted}
            onToggle={soundscape.toggle}
            onMuteAll={soundscape.muteAll}
          />
          <div className="flex-1 min-w-0 relative z-10">
            <SoundscapeGrid voices={soundscape.voices} onToggleMute={soundscape.toggleMute} />
          </div>
        </div>
      )}
    </div>
  );
}
