import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Coordinates } from '../types';

// Fix for Leaflet default icon issues in React without bundler
const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const iconRetinaUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

// Custom Car Icon for Driver
const carIconUrl = "https://cdn-icons-png.flaticon.com/512/3097/3097180.png"; 

const DefaultIcon = L.icon({
  iconRetinaUrl: iconRetinaUrl,
  iconUrl: iconUrl,
  shadowUrl: shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

const CarIcon = L.icon({
  iconUrl: carIconUrl,
  iconSize: [40, 40], // larger size for car
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapProps {
  pickup: Coordinates | null;
  dropoff: Coordinates | null;
  userLocation: Coordinates | null;
  driverLocation: Coordinates | null;
  onMapClick?: (coords: Coordinates) => void;
}

// Helper to auto-fit bounds or center on user
const BoundsManager: React.FC<{ 
    pickup: Coordinates | null, 
    dropoff: Coordinates | null, 
    userLocation: Coordinates | null,
    driverLocation: Coordinates | null 
}> = ({ pickup, dropoff, userLocation, driverLocation }) => {
  const map = useMap();

  useEffect(() => {
    // If driver is active and pickup exists, show both
    if (driverLocation && pickup) {
        const bounds = L.latLngBounds([driverLocation.lat, driverLocation.lng], [pickup.lat, pickup.lng]);
        map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
        return;
    }

    // Normal booking flow bounds
    if (pickup && dropoff) {
      const bounds = L.latLngBounds([pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (pickup) {
      map.flyTo([pickup.lat, pickup.lng], 15);
    } else if (userLocation) {
        // If no pickup/dropoff selected, show user location
        map.flyTo([userLocation.lat, userLocation.lng], 15);
    }
  }, [pickup, dropoff, userLocation, driverLocation, map]);

  return null;
};

// Component to handle map clicks
const MapEvents: React.FC<{ onMapClick: (coords: Coordinates) => void }> = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

const MapComponent: React.FC<MapProps> = ({ pickup, dropoff, userLocation, driverLocation, onMapClick }) => {
  // Default center (Bangalore) as fallback
  const defaultCenter = { lat: 12.9716, lng: 77.5946 };
  const center = userLocation || defaultCenter;

  return (
    <div className="h-full w-full absolute inset-0 z-0">
        <MapContainer 
            center={[center.lat, center.lng]} 
            zoom={13} 
            scrollWheelZoom={false}
            zoomControl={false}
            className="h-full w-full"
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            
            {userLocation && !pickup && !driverLocation && (
                 <Marker position={[userLocation.lat, userLocation.lng]} opacity={0.6}>
                    <Popup>You are here</Popup>
                </Marker>
            )}

            {driverLocation && (
                <Marker position={[driverLocation.lat, driverLocation.lng]} icon={CarIcon} zIndexOffset={1000}>
                    <Popup>Driver</Popup>
                </Marker>
            )}

            {pickup && (
                <Marker position={[pickup.lat, pickup.lng]}>
                    <Popup>Pickup Location</Popup>
                </Marker>
            )}

            {dropoff && (
                <Marker position={[dropoff.lat, dropoff.lng]}>
                     <Popup>Dropoff Location</Popup>
                </Marker>
            )}

            <BoundsManager pickup={pickup} dropoff={dropoff} userLocation={userLocation} driverLocation={driverLocation} />
            {onMapClick && <MapEvents onMapClick={onMapClick} />}
        </MapContainer>
        {/* Overlay gradient for better text readability on top */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/90 to-transparent pointer-events-none z-[400]" />
    </div>
  );
};

export default MapComponent;