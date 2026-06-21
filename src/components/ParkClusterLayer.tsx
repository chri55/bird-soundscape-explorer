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
