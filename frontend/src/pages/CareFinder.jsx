import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeft, MapPin, Navigation, Phone, AlertTriangle, LocateFixed, SearchX,
} from 'lucide-react';
import { searchNearby } from '../api/careFinder.api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Leaflet's default marker icon resolves image paths relative to its own
// CSS in a way that breaks under bundlers — this is the standard fix, run
// once at module scope. leaflet.css is required too, or the map renders as a
// broken gray box with tiles in the wrong position/size.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

// A small solid dot distinguishes "you are here" from facility pins without
// needing a second image asset.
const youAreHereIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:9999px;background:#2563eb;border:3px solid white;box-shadow:0 0 0 3px rgba(37,99,235,0.35);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const TYPE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'doctors', label: 'Doctor' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'dentist', label: 'Dentist' },
];

const TYPE_LABELS = {
  hospital: 'Hospital', clinic: 'Clinic', doctors: 'Doctor', pharmacy: 'Pharmacy', dentist: 'Dentist',
};

const directionsUrl = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export default function CareFinder() {
  const navigate = useNavigate();

  const [coords, setCoords] = useState(null);
  const [geoStatus, setGeoStatus] = useState('pending'); // 'pending' | 'ready' | 'error'
  const [geoErrorMsg, setGeoErrorMsg] = useState('');

  const [type, setType] = useState('');
  const [facilities, setFacilities] = useState([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [facilitiesError, setFacilitiesError] = useState(false);
  const [selectedFacilityId, setSelectedFacilityId] = useState(null);

  const mapRef = useRef(null);
  const markerRefs = useRef({});

  const requestLocation = useCallback(() => {
    setGeoStatus('pending');
    setGeoErrorMsg('');
    if (!navigator.geolocation) {
      setGeoStatus('error');
      setGeoErrorMsg('Your browser does not support location services.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('ready');
      },
      (err) => {
        setGeoStatus('error');
        setGeoErrorMsg(
          err.code === err.PERMISSION_DENIED
            ? 'Location access was denied. Enable location permissions for this site in your browser settings and try again.'
            : 'Unable to determine your location. Please try again.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => { requestLocation(); }, [requestLocation]);

  const loadFacilities = useCallback(async () => {
    if (!coords) return;
    setFacilitiesLoading(true);
    setFacilitiesError(false);
    setSelectedFacilityId(null);
    try {
      const data = await searchNearby({ lat: coords.lat, lng: coords.lng, type: type || undefined });
      setFacilities(data);
    } catch {
      setFacilitiesError(true);
    } finally {
      setFacilitiesLoading(false);
    }
  }, [coords, type]);

  useEffect(() => { loadFacilities(); }, [loadFacilities]);

  // Pans/opens the popup for whichever facility is selected, whether the
  // selection came from a list-row click or a marker click.
  useEffect(() => {
    if (!selectedFacilityId || !mapRef.current) return;
    const facility = facilities.find((f) => f.id === selectedFacilityId);
    if (!facility) return;
    mapRef.current.flyTo([facility.lat, facility.lng], Math.max(mapRef.current.getZoom(), 15), { duration: 0.6 });
    markerRefs.current[selectedFacilityId]?.openPopup();
  }, [selectedFacilityId, facilities]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent-foreground">
              <MapPin size={16} />
            </div>
            <div>
              <p className="font-heading text-sm font-semibold text-foreground">Care Finder</p>
              <p className="text-[11px] text-muted-foreground">
                {geoStatus === 'ready' && !facilitiesLoading
                  ? `${facilities.length} nearby`
                  : 'Nearby hospitals, clinics & pharmacies'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-3.5 px-4 py-4">
        {geoStatus === 'pending' && (
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
              <LocateFixed size={22} className="animate-pulse text-primary" />
              <p className="text-sm font-medium text-foreground">Finding your location...</p>
              <p className="text-xs text-muted-foreground">Your browser may ask for location permission.</p>
            </div>
            <Skeleton className="h-[260px] rounded-2xl" />
            <Skeleton className="h-[92px] rounded-2xl" />
            <Skeleton className="h-[92px] rounded-2xl" />
          </div>
        )}

        {geoStatus === 'error' && (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-severity-high-bg text-severity-high-fg">
              <AlertTriangle size={22} />
            </div>
            <p className="text-base font-semibold text-foreground">Couldn't get your location</p>
            <p className="max-w-[300px] text-sm leading-relaxed text-muted-foreground">{geoErrorMsg}</p>
            <Button onClick={requestLocation} className="mt-2">Try again</Button>
          </div>
        )}

        {geoStatus === 'ready' && coords && (
          <>
            {/* Type filter chips */}
            <div className="flex flex-wrap gap-1.5">
              {TYPE_FILTERS.map((f) => (
                <button
                  key={f.value || 'all'}
                  onClick={() => setType(f.value)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    type === f.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:bg-accent'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Map */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35 }}
              className="h-[260px] w-full overflow-hidden rounded-2xl border border-border/70 shadow-sm"
            >
              <MapContainer
                center={[coords.lat, coords.lng]}
                zoom={14}
                scrollWheelZoom
                style={{ height: '100%', width: '100%' }}
                ref={mapRef}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[coords.lat, coords.lng]} icon={youAreHereIcon}>
                  <Popup>You are here</Popup>
                </Marker>
                {facilities.map((f) => (
                  <Marker
                    key={f.id}
                    position={[f.lat, f.lng]}
                    ref={(instance) => { markerRefs.current[f.id] = instance; }}
                    eventHandlers={{ click: () => setSelectedFacilityId(f.id) }}
                  >
                    <Popup>
                      <div className="flex flex-col gap-1 text-xs">
                        <p className="font-semibold">{f.name}</p>
                        <p className="text-neutral-500">
                          {TYPE_LABELS[f.type] || f.type} · {f.distanceKm} km
                        </p>
                        <a
                          href={directionsUrl(f.lat, f.lng)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 font-medium text-blue-600 hover:underline"
                        >
                          Directions
                        </a>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </motion.div>

            {/* List */}
            {facilitiesLoading && (
              <div className="flex flex-col gap-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[92px] rounded-2xl" />
                ))}
              </div>
            )}

            {!facilitiesLoading && facilitiesError && (
              <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
                <AlertTriangle size={22} className="text-severity-high-fg" />
                <p className="text-sm font-medium text-foreground">
                  Unable to reach the care-facility directory right now.
                </p>
                <Button variant="outline" size="sm" onClick={loadFacilities}>Retry</Button>
              </div>
            )}

            {!facilitiesLoading && !facilitiesError && facilities.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
                <SearchX size={22} className="text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">No care facilities found nearby</p>
                <p className="max-w-[280px] text-xs leading-relaxed text-muted-foreground">
                  Try a different facility type, or check back later.
                </p>
              </div>
            )}

            {!facilitiesLoading && !facilitiesError && facilities.length > 0 && (
              <AnimatePresence mode="popLayout">
                <motion.div layout className="flex flex-col gap-2.5">
                  {facilities.map((f, i) => (
                    <motion.div
                      key={f.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.99 }}
                      transition={{ duration: 0.25, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                      onClick={() => setSelectedFacilityId(f.id)}
                    >
                      <Card
                        className={cn(
                          'cursor-pointer rounded-2xl border-border/70 py-0 shadow-sm transition-colors',
                          selectedFacilityId === f.id && 'border-primary ring-1 ring-primary/30'
                        )}
                      >
                        <CardContent className="flex flex-col gap-2 px-[18px] py-3.5">
                          <div className="flex items-start justify-between gap-3">
                            <p className="truncate text-sm font-semibold text-foreground">{f.name}</p>
                            <span className="shrink-0 text-xs font-medium text-muted-foreground">
                              {f.distanceKm} km
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="secondary" className="text-[10px]">
                              {TYPE_LABELS[f.type] || f.type}
                            </Badge>
                            {f.address && (
                              <span className="truncate text-[11px] text-muted-foreground">{f.address}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 pt-0.5">
                            {f.phone && (
                              <a
                                href={`tel:${f.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
                              >
                                <Phone size={11} /> Call
                              </a>
                            )}
                            <a
                              href={directionsUrl(f.lat, f.lng)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="ml-auto flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                            >
                              <Navigation size={11} /> Directions
                            </a>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            )}
          </>
        )}
      </div>
    </div>
  );
}
