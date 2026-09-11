import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeft, MapPin, Navigation, Phone, AlertTriangle, LocateFixed, SearchX,
  Search, Crosshair, X, ExternalLink, Route,
} from 'lucide-react';
import { searchNearby, geocodeSearch, reverseGeocode, getDirections } from '../api/careFinder.api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
// needing a second image asset. Color shifts by how the location was set —
// blue for GPS, purple for a manually chosen point — so it's visually clear
// this isn't necessarily the device's live position.
const locationIcon = (color) => L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:9999px;background:${color};border:3px solid white;box-shadow:0 0 0 3px ${color}59;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});
const GPS_ICON = locationIcon('#2563eb');
const CHOSEN_ICON = locationIcon('#7c3aed');

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

const externalDirectionsUrl = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

// Mounted as a child of <MapContainer> — react-leaflet's map-event hooks
// only work inside the map's own React context, so a click listener can't be
// wired up from the parent component directly.
function MapClickListener({ active, onPick }) {
  useMapEvents({
    click(e) {
      if (!active) return;
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Recenters/refits the map whenever the active location or an in-progress
// route changes — also mounted inside <MapContainer> for the same reason.
function MapViewController({ coords, route }) {
  const map = useMapEvents({});
  useEffect(() => {
    if (route?.geometry?.length) {
      map.fitBounds(L.latLngBounds(route.geometry), { padding: [32, 32] });
    } else if (coords) {
      map.flyTo([coords.lat, coords.lng], Math.max(map.getZoom(), 14), { duration: 0.5 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.lat, coords?.lng, route]);
  return null;
}

export default function CareFinder() {
  const navigate = useNavigate();

  const [coords, setCoords] = useState(null);
  const [geoStatus, setGeoStatus] = useState('pending'); // 'pending' | 'ready' | 'error'
  const [geoErrorMsg, setGeoErrorMsg] = useState('');

  // How the current `coords` was set, and a human label for it when it
  // wasn't GPS — drives the marker color/popup and the location bar's text.
  const [locationSource, setLocationSource] = useState('gps'); // 'gps' | 'search' | 'map'
  const [locationLabel, setLocationLabel] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [pickModeActive, setPickModeActive] = useState(false);

  const [type, setType] = useState('');
  const [facilities, setFacilities] = useState([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [facilitiesError, setFacilitiesError] = useState(false);
  const [selectedFacilityId, setSelectedFacilityId] = useState(null);

  const [route, setRoute] = useState(null); // { destinationId, facilityName, geometry, distanceKm, durationMin, steps }
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(false);

  const mapRef = useRef(null);
  const markerRefs = useRef({});
  const searchBoxRef = useRef(null);
  // Set right before a programmatic setSearchQuery (selecting a search
  // result, labeling a map-picked point) so the search-as-you-type effect
  // below doesn't treat that assignment as a fresh user query and re-search
  // for the label text itself — which would silently reopen the dropdown.
  const skipNextSearchRef = useRef(false);

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
        setLocationSource('gps');
        setLocationLabel(null);
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

  // Debounced as-you-type place search — mirrors the courtesy already given
  // to the backend's own Overpass/Nominatim calls: don't fire on every
  // keystroke, and always clear results for a query too short to be useful.
  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }
    if (searchQuery.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    // `cancelled` guards against a slow geocode response landing after the
    // user has already moved on (cleared the query, picked "Use my
    // location", etc.) — without it, a stale response can silently resurrect
    // the dropdown after the user thinks they've dismissed it.
    let cancelled = false;
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const results = await geocodeSearch(searchQuery.trim());
        if (!cancelled) setSearchResults(results);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery]);

  // Closes the search dropdown on an outside click.
  useEffect(() => {
    const onClick = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setSearchResults(null);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const chooseLocation = useCallback((lat, lng, source, label) => {
    setCoords({ lat, lng });
    setLocationSource(source);
    setLocationLabel(label);
    setGeoStatus('ready');
    setRoute(null);
    setRouteError(false);
  }, []);

  const handleSelectSearchResult = (result) => {
    skipNextSearchRef.current = true;
    chooseLocation(result.lat, result.lng, 'search', result.label);
    setSearchQuery(result.label);
    setSearchResults(null);
  };

  const handleMapPick = useCallback(async (lat, lng) => {
    setPickModeActive(false);
    chooseLocation(lat, lng, 'map', null);
    try {
      const label = await reverseGeocode(lat, lng);
      setLocationLabel(label);
      skipNextSearchRef.current = true;
      setSearchQuery(label || '');
    } catch {
      // Keep the raw coordinate as the location even if labeling fails.
    }
  }, [chooseLocation]);

  const handleUseMyLocation = () => {
    setSearchQuery('');
    setSearchResults(null);
    setPickModeActive(false);
    requestLocation();
  };

  const loadFacilities = useCallback(async () => {
    if (!coords) return;
    setFacilitiesLoading(true);
    setFacilitiesError(false);
    setSelectedFacilityId(null);
    setRoute(null);
    setRouteError(false);
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

  const handleGetDirections = async (facility) => {
    setSelectedFacilityId(facility.id);
    setRouteError(false);
    setRouteLoading(true);
    setRoute(null);
    try {
      const data = await getDirections({
        fromLat: coords.lat, fromLng: coords.lng, toLat: facility.lat, toLng: facility.lng,
      });
      setRoute({
        destinationId: facility.id,
        facilityName: facility.name,
        destLat: facility.lat,
        destLng: facility.lng,
        ...data,
      });
    } catch {
      setRouteError(true);
    } finally {
      setRouteLoading(false);
    }
  };

  const clearRoute = () => { setRoute(null); setRouteError(false); };

  const locationDisplayLabel = locationSource === 'gps' ? 'Your location' : (locationLabel || 'Selected location');

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
            {/* Location bar: search a place, use GPS, or pick on the map */}
            <div className="flex flex-col gap-2">
              <div ref={searchBoxRef} className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search a location..."
                  className="pl-8 pr-8"
                  aria-label="Search for a location"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(''); setSearchResults(null); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}

                {searchResults !== null && (
                  <div className="absolute z-[1000] mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-card shadow-md">
                    {searchLoading && (
                      <p className="px-3.5 py-2.5 text-xs text-muted-foreground">Searching...</p>
                    )}
                    {!searchLoading && searchResults.length === 0 && (
                      <p className="px-3.5 py-2.5 text-xs text-muted-foreground">No matches found</p>
                    )}
                    {!searchLoading && searchResults.map((r, i) => (
                      <button
                        key={`${r.lat},${r.lng},${i}`}
                        onClick={() => handleSelectSearchResult(r)}
                        className="flex w-full items-start gap-2 border-b border-border/60 px-3.5 py-2.5 text-left text-xs last:border-b-0 hover:bg-accent"
                      >
                        <MapPin size={13} className="mt-0.5 shrink-0 text-muted-foreground" />
                        <span className="text-foreground">{r.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Button variant="outline" size="sm" className="h-7 gap-1.5 rounded-full text-xs" onClick={handleUseMyLocation}>
                  <LocateFixed size={12} /> Use my location
                </Button>
                <Button
                  variant={pickModeActive ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 gap-1.5 rounded-full text-xs"
                  onClick={() => setPickModeActive((v) => !v)}
                >
                  <Crosshair size={12} /> {pickModeActive ? 'Tap the map...' : 'Pick on map'}
                </Button>
                <span className="ml-auto flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: locationSource === 'gps' ? '#2563eb' : '#7c3aed' }}
                  />
                  <span className="truncate">{locationDisplayLabel}</span>
                </span>
              </div>
            </div>

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
              className={cn(
                'relative h-[260px] w-full overflow-hidden rounded-2xl border shadow-sm transition-colors',
                pickModeActive ? 'border-primary ring-2 ring-primary/40' : 'border-border/70'
              )}
            >
              {pickModeActive && (
                <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex justify-center pt-2">
                  <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground shadow-sm">
                    Tap the map to set your location
                  </span>
                </div>
              )}
              <MapContainer
                center={[coords.lat, coords.lng]}
                zoom={14}
                scrollWheelZoom
                style={{ height: '100%', width: '100%', cursor: pickModeActive ? 'crosshair' : '' }}
                ref={mapRef}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickListener active={pickModeActive} onPick={handleMapPick} />
                <MapViewController coords={coords} route={route} />

                <Marker position={[coords.lat, coords.lng]} icon={locationSource === 'gps' ? GPS_ICON : CHOSEN_ICON}>
                  <Popup>{locationDisplayLabel}</Popup>
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
                        <button
                          onClick={() => handleGetDirections(f)}
                          className="mt-1 text-left font-medium text-blue-600 hover:underline"
                        >
                          Directions
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {route && <Polyline positions={route.geometry} pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.85 }} />}
              </MapContainer>
            </motion.div>

            {/* Route panel — replaces the facility list while a route is active */}
            {(route || routeLoading || routeError) && (
              <div className="flex flex-col gap-2.5 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                {routeLoading && (
                  <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <Route size={16} className="animate-pulse" /> Calculating route...
                  </div>
                )}
                {!routeLoading && routeError && (
                  <div className="flex flex-col items-center gap-2 py-4 text-center">
                    <AlertTriangle size={18} className="text-severity-high-fg" />
                    <p className="text-sm font-medium text-foreground">Unable to calculate directions right now.</p>
                    <Button variant="outline" size="sm" onClick={clearRoute}>Dismiss</Button>
                  </div>
                )}
                {!routeLoading && route && (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Driving to {route.facilityName}</p>
                        <p className="text-xs text-muted-foreground">
                          {route.distanceKm} km · about {route.durationMin} min
                        </p>
                      </div>
                      <button onClick={clearRoute} className="rounded-lg p-1 text-muted-foreground hover:bg-accent" aria-label="Clear route">
                        <X size={16} />
                      </button>
                    </div>
                    <div className="flex flex-col gap-1.5 border-t border-border/60 pt-2.5">
                      {route.steps.map((s, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-foreground">{s.instruction}</span>
                          <span className="shrink-0 text-muted-foreground">{s.distanceKm} km</span>
                        </div>
                      ))}
                    </div>
                    <a
                      href={externalDirectionsUrl(route.destLat, route.destLng)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 flex items-center gap-1.5 self-start text-[11px] font-medium text-primary hover:underline"
                    >
                      <ExternalLink size={11} /> Open in Maps app
                    </a>
                  </>
                )}
              </div>
            )}

            {/* List */}
            {!route && !routeLoading && !routeError && facilitiesLoading && (
              <div className="flex flex-col gap-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[92px] rounded-2xl" />
                ))}
              </div>
            )}

            {!route && !routeLoading && !routeError && !facilitiesLoading && facilitiesError && (
              <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
                <AlertTriangle size={22} className="text-severity-high-fg" />
                <p className="text-sm font-medium text-foreground">
                  Unable to reach the care-facility directory right now.
                </p>
                <Button variant="outline" size="sm" onClick={loadFacilities}>Retry</Button>
              </div>
            )}

            {!route && !routeLoading && !routeError && !facilitiesLoading && !facilitiesError && facilities.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
                <SearchX size={22} className="text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">No care facilities found nearby</p>
                <p className="max-w-[280px] text-xs leading-relaxed text-muted-foreground">
                  Try a different facility type, or check back later.
                </p>
              </div>
            )}

            {!route && !routeLoading && !routeError && !facilitiesLoading && !facilitiesError && facilities.length > 0 && (
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
                            <button
                              onClick={(e) => { e.stopPropagation(); handleGetDirections(f); }}
                              className="ml-auto flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                            >
                              <Navigation size={11} /> Directions
                            </button>
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
