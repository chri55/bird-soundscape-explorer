import { useState, useRef, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

import type { LatLng } from '../utils/geo';
import { haversineKm } from '../utils/geo';
import type { EBirdObservation, EBirdHotspot } from '../api/ebird';
import { fetchRecentNearby, fetchNearbyNotable } from '../api/ebird';
import type { XCRecording } from '../api/xeno-canto';
import { fetchRecordingsByBox } from '../api/xeno-canto';
import { fillRecordingGaps } from '../utils/soundscape-recordings';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear } from '@fortawesome/free-solid-svg-icons';
import { useSoundscape, MAX_VOICES, SPARE_VOICES } from '../hooks/useSoundscape';
import type { SoundscapeVoice } from '../hooks/useSoundscape';
import { useExclusionList } from '../hooks/useExclusionList';
import { SpeciesPanel } from './SpeciesPanel';
import { SoundscapeGrid } from './SoundscapeGrid';
import { SoundscapeControls } from './SoundscapeControls';
import { useNpsParks } from '../hooks/useNpsParks';
import { ParkClusterLayer } from './ParkClusterLayer';
import { EbirdHotspotLayer } from './EbirdHotspotLayer';
import { PoiSearch } from './PoiSearch';
import type { SearchItem } from './PoiSearch';
import { SettingsModal } from './SettingsModal';
import type { MobileTab } from './MobileTabBar';
import { MobileTabBar } from './MobileTabBar';

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
const XC_BOX_DEG = 0.225;

function PinHandler({ onPin }: { onPin: (pos: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPin({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function FlyToController({ target }: { target: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 10);
  }, [map, target]);
  return null;
}

function MapExposer() {
  const map = useMap();
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__leafletMap = map;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return () => { (window as any).__leafletMap = undefined; };
  }, [map]);
  return null;
}

export default function MapView() {
  const [pin, setPin] = useState<LatLng | null>(null);
  const [notableObs, setNotableObs] = useState<EBirdObservation[]>([]);
  const [recentObs, setRecentObs] = useState<EBirdObservation[]>([]);
  const [recordings, setRecordings] = useState<XCRecording[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [flyToTarget, setFlyToTarget] = useState<LatLng | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const [selectedVoice, setSelectedVoice] = useState<SoundscapeVoice | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>('map');
  const [loadedHotspots, setLoadedHotspots] = useState<EBirdHotspot[]>([]);
  const { exclusions, excludedSciNames, addExclusion, removeExclusion } = useExclusionList();

  const lastFetchRef = useRef<LatLng | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const soundscape = useSoundscape(recordings, recentObs, notableObs, excludedSciNames);
  const parks = useNpsParks();

  const availableObs = [...notableObs, ...recentObs].filter(
    (obs, i, arr) => arr.findIndex(o => o.sciName === obs.sciName) === i,
  );

  const searchItems: SearchItem[] = [
    ...parks.map(p => ({
      name: p.fullName,
      lat: parseFloat(p.latitude),
      lng: parseFloat(p.longitude),
      subtitle: 'U.S. National Park',
    })),
    ...loadedHotspots.map(hs => ({
      name: hs.locName,
      lat: hs.lat,
      lng: hs.lng,
      subtitle: 'Birding Hotspot',
    })),
  ];

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

  const handleParkSearch = useCallback(
    (pos: LatLng) => {
      handlePin(pos);
      setFlyToTarget(pos);
    },
    [handlePin],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <header className="px-4 py-2 bg-green-800 text-white flex items-center gap-3 shrink-0">
        <img src="/favicon.png" alt="" className="w-6 h-6 shrink-0" aria-hidden="true" />
        <span className="text-lg font-semibold min-w-0 truncate">Tweetr</span>
        {pin && (
          <span className="text-sm text-green-200 ml-auto whitespace-nowrap shrink-0">
            {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
          </span>
        )}
        <button
          ref={settingsButtonRef}
          type="button"
          aria-label="Open settings"
          onClick={() => setSettingsOpen(true)}
          className={`${pin ? '' : 'ml-auto '}p-1 rounded hover:bg-green-700 transition-colors`}
        >
          <FontAwesomeIcon icon={faGear} />
        </button>
      </header>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        <div className={`${mobileTab === 'list' ? 'flex flex-col flex-1' : 'hidden'} md:contents`}>
          <SpeciesPanel
            notableObs={notableObs}
            recentObs={recentObs}
            recordings={recordings}
            isLoading={isLoading}
          />
        </div>

        <div className={`${mobileTab === 'map' ? '' : 'hidden md:block'} flex-1 relative z-0 min-h-0`}>
          <div className="absolute top-3 left-1/2 -translate-x-1/2 md:left-14 md:translate-x-0 z-[1000] w-64">
            <PoiSearch items={searchItems} onSelect={handleParkSearch} />
          </div>
          <MapContainer center={[39.5, -98.35]} zoom={4} className="w-full h-full cursor-crosshair">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <PinHandler onPin={handlePin} />
            {pin && <Marker position={[pin.lat, pin.lng]} icon={defaultIcon} />}
            <ParkClusterLayer parks={parks} onParkClick={handlePin} />
            <FlyToController target={flyToTarget} />
            <EbirdHotspotLayer
              onHotspotClick={handlePin}
              onNewHotspots={hotspots => setLoadedHotspots(prev => [...prev, ...hotspots])}
            />
            <MapExposer />
          </MapContainer>
        </div>
      </div>

      {(isLoading || soundscape.voices.length > 0) && (
        <>
          {isLoading && soundscape.voices.length === 0 ? (
            <div
              role="status"
              aria-label="Loading birds"
              className={`shrink-0 bg-gray-900 items-center gap-3 px-3 py-2 ${
                mobileTab !== 'map' ? 'hidden md:flex' : 'flex'
              }`}
            >
              <div className="w-12 h-14 rounded bg-gray-700 animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-700 rounded animate-pulse w-32" />
                <div className="h-3 bg-gray-700 rounded animate-pulse w-24" />
              </div>
            </div>
          ) : (
            <>
              {selectedVoice && mobileTab === 'map' && (
                <div className="md:hidden shrink-0 bg-gray-800 flex gap-3 px-3 py-2 items-center">
                  <div className="w-16 h-16 rounded overflow-hidden shrink-0 bg-gray-700 flex items-center justify-center">
                    {selectedVoice.photo ? (
                      <img
                        src={selectedVoice.photo.photoUrl}
                        alt={selectedVoice.recording.en}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <p className="text-white text-xs text-center px-1">{selectedVoice.recording.en}</p>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-semibold truncate">{selectedVoice.recording.en}</p>
                    <p className="text-gray-400 text-xs italic truncate">{selectedVoice.sciName}</p>
                    {selectedVoice.photo && (
                      <p className="text-gray-500 text-xs truncate">{selectedVoice.photo.attribution}</p>
                    )}
                    <p className="text-gray-500 text-xs truncate">Rec: {selectedVoice.recording.rec}</p>
                  </div>
                </div>
              )}
              <div className={`shrink-0 bg-gray-900 items-center gap-2 px-3 py-2 relative z-10 ${
                mobileTab !== 'map' ? 'hidden md:flex' : 'flex'
              }`}>
                <SoundscapeControls
                  isPlaying={soundscape.isPlaying}
                  voiceCount={soundscape.voices.length}
                  loadedCount={soundscape.loadedCount}
                  allMuted={soundscape.allMuted}
                  onToggle={soundscape.toggle}
                  onMuteAll={soundscape.muteAll}
                />
                <div className="flex-1 min-w-0 relative z-10">
                  <SoundscapeGrid
                    voices={soundscape.voices}
                    onToggleMute={soundscape.toggleMute}
                    onReroll={soundscape.rerollVoice}
                    onSelectedVoiceChange={setSelectedVoice}
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}
      <MobileTabBar activeTab={mobileTab} onTabChange={setMobileTab} />
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => { setSettingsOpen(false); settingsButtonRef.current?.focus(); }}
        availableObs={availableObs}
        exclusions={exclusions}
        onAddExclusion={addExclusion}
        onRemoveExclusion={removeExclusion}
      />
    </div>
  );
}
