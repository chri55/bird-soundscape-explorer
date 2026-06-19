import { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { LatLng } from '../utils/geo';

// Fix default marker icons broken by Vite's asset handling
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

const defaultIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconRetinaUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

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

      <MapContainer
        center={[20, 0]}
        zoom={3}
        className="flex-1 cursor-crosshair"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <PinHandler onPin={setPin} />
        {pin && <Marker position={[pin.lat, pin.lng]} icon={defaultIcon} />}
      </MapContainer>

      {pin && (
        <div className="px-4 py-2 bg-green-50 border-t border-green-200 text-sm text-green-900 shrink-0">
          Pinned at {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)} — species data coming soon
        </div>
      )}
    </div>
  );
}
