/**
 * DriverRouteMap - Updated to use LeafletMapView (WebView + Leaflet)
 * Works without Google Maps API key
 */
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import axios from 'axios'; // used only for the external OpenRouteService calls below
import api from '../../../services/api';
import { getFreshness, formatMinutesAgo, FRESHNESS } from '../../../utils/freshness';

const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjRkZjk4MGNjNTZhZTAzYTE3ZGI0NDJiMjVkNzAzNGM5YTczOWIzODlhOTg5NGM1YzZhODYzZWQ0IiwiaCI6Im11cm11cjY0In0=';

const generateMapHTML = (start, end, route, intermediateLocations, liveLocation, pathHistory) => {
  const center = start ? start : { latitude: 11.1271, longitude: 78.6569 };

  const routeCoords = route.map(c => `[${c.latitude}, ${c.longitude}]`).join(',');
  const pathCoords = pathHistory.map(c => `[${c.latitude}, ${c.longitude}]`).join(',');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="initial-scale=1.0, user-scalable=no, width=device-width" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { margin: 0; padding: 0; }
    html, body, #map { height: 100%; width: 100%; }
    .marker-icon { 
      display: flex; align-items: center; justify-content: center;
      width: 30px; height: 30px; border-radius: 50%;
      border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      font-size: 14px;
    }
    .start-marker { background: #28a745; }
    .end-marker { background: #dc3545; }
    .live-marker { background: #007AFF; animation: pulse 1.5s infinite; }
    .waypoint-marker { background: #ffc107; }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(0,122,255,0.5); }
      70% { box-shadow: 0 0 0 15px rgba(0,122,255,0); }
      100% { box-shadow: 0 0 0 0 rgba(0,122,255,0); }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map').setView([${center.latitude}, ${center.longitude}], 10);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);
    
    // Route polyline
    ${route.length > 0 ? `
    const routeCoords = [${routeCoords}];
    L.polyline(routeCoords, { color: '#007AFF', weight: 4, opacity: 0.8 }).addTo(map);
    ` : ''}
    
    // Path history (dashed line)
    ${pathHistory.length > 1 ? `
    const pathCoords = [${pathCoords}];
    L.polyline(pathCoords, { color: '#FF1493', weight: 3, dashArray: '5,5' }).addTo(map);
    ` : ''}
    
    // Start marker
    ${start ? `
    L.marker([${start.latitude}, ${start.longitude}], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-icon start-marker">🚀</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      })
    }).addTo(map).bindPopup('Start Location');
    ` : ''}
    
    // End marker
    ${end ? `
    L.marker([${end.latitude}, ${end.longitude}], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-icon end-marker">🏁</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      })
    }).addTo(map).bindPopup('Destination');
    ` : ''}
    
    // Waypoints
    ${intermediateLocations.map((loc, i) => `
    L.marker([${loc.latitude}, ${loc.longitude}], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-icon waypoint-marker">${i + 1}</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      })
    }).addTo(map).bindPopup('Waypoint ${i + 1}');
    `).join('\n')}
    
    // Live location marker
    ${liveLocation ? `
    const liveMarker = L.marker([${liveLocation.latitude}, ${liveLocation.longitude}], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-icon live-marker">🚚</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      })
    }).addTo(map).bindPopup('Driver (Live)');
    
    map.setView([${liveLocation.latitude}, ${liveLocation.longitude}], 14);
    ` : ''}
    
    // Fit bounds to show all markers
    ${route.length > 0 ? `
    map.fitBounds(routeCoords, { padding: [50, 50] });
    ` : ''}
  </script>
</body>
</html>
`;
};

const DriverRouteMap = ({ exportId, onBack }) => {
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [latestLocation, setLatestLocation] = useState(null);
  const [latestLocationTimestamp, setLatestLocationTimestamp] = useState(null);
  const [locationChecked, setLocationChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [liveTracking, setLiveTracking] = useState(false);
  const [pathHistory, setPathHistory] = useState([]);
  const [intermediateLocations, setIntermediateLocations] = useState([]);
  const [mapKey, setMapKey] = useState(0); // Force refresh WebView
  const intervalRef = useRef(null);
  const routeIntervalRef = useRef(null);

  const fetchRoute = useCallback(async (startLoc, endLoc, waypoints = []) => {
    try {
      const coordinates = [
        [startLoc.longitude, startLoc.latitude],
        ...waypoints.map(wp => [wp.longitude, wp.latitude]),
        [endLoc.longitude, endLoc.latitude]
      ];

      const orsRes = await axios.post(
        'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
        { coordinates },
        {
          headers: {
            Authorization: ORS_API_KEY,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 second timeout
        }
      );

      const geometry = orsRes.data.features[0].geometry.coordinates;
      return geometry.map(([lon, lat]) => ({
        latitude: lat,
        longitude: lon,
      }));
    } catch (err) {
      // Silently fall back to straight lines - this is expected behavior
      // when route service is unavailable or coordinates are not routable
      console.log('Using direct route (routing service unavailable)');
      return [startLoc, ...waypoints, endLoc];
    }
  }, []);

  const fetchExportAndRoute = useCallback(async () => {
    try {
      const exportRes = await api.get(`/api/driver/map/export/${exportId}`);
      const exportData = exportRes.data;

      const startLoc = {
        latitude: exportData.startLocation.latitude,
        longitude: exportData.startLocation.longitude,
      };
      const endLoc = {
        latitude: exportData.endLocation.latitude,
        longitude: exportData.endLocation.longitude,
      };

      setStart(startLoc);
      setEnd(endLoc);

      const newIntermediateLocations = exportData.intermediateLocations || [];
      setIntermediateLocations(newIntermediateLocations);

      const route = await fetchRoute(startLoc, endLoc, newIntermediateLocations);
      setRouteCoords(route);
      setMapKey(k => k + 1);
    } catch (err) {
      console.error('Initial fetch error:', err);
      Alert.alert('Error', 'Failed to fetch route data');
    } finally {
      setLoading(false);
    }
  }, [exportId, fetchRoute]);

  const fetchLiveLocation = useCallback(async () => {
    try {
      const res = await api.get(`/api/driver/device/location-data/${exportId}`);
      const locationArray = res.data;
      setLocationChecked(true);

      if (Array.isArray(locationArray) && locationArray.length > 0) {
        const latest = locationArray[locationArray.length - 1];
        const newLocation = {
          latitude: latest.latitude,
          longitude: latest.longitude,
        };

        setLatestLocation(newLocation);
        setLatestLocationTimestamp(latest.timestamp || null);
        setPathHistory(prev => [...prev, newLocation]);
        setMapKey(k => k + 1);
      } else {
        // No reading exists — do not fabricate one.
        setLatestLocation(null);
        setLatestLocationTimestamp(null);
      }
    } catch (err) {
      console.error('Live location fetch error:', err);
      setLocationChecked(true);
      setLatestLocation(null);
      setLatestLocationTimestamp(null);
    }
  }, [exportId]);

  const startLiveTracking = useCallback(() => {
    if (intervalRef.current) return;
    fetchLiveLocation();
    intervalRef.current = setInterval(fetchLiveLocation, 15000);
    setLiveTracking(true);
  }, [fetchLiveLocation]);

  const stopLiveTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (routeIntervalRef.current) {
      clearInterval(routeIntervalRef.current);
      routeIntervalRef.current = null;
    }
    setLiveTracking(false);
  }, []);

  useEffect(() => {
    fetchExportAndRoute();
    // One-shot check so freshness/unavailable is visible before the driver
    // taps "Start Live Tracking".
    fetchLiveLocation();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (routeIntervalRef.current) clearInterval(routeIntervalRef.current);
    };
  }, [fetchExportAndRoute, fetchLiveLocation]);

  const mapHtml = useMemo(() =>
    generateMapHTML(start, end, routeCoords, intermediateLocations, latestLocation, pathHistory),
    [start, end, routeCoords, intermediateLocations, latestLocation, pathHistory]
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>🗺 Loading route...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        key={mapKey}
        source={{ html: mapHtml }}
        style={styles.map}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />

      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      {!liveTracking ? (
        <TouchableOpacity onPress={startLiveTracking} style={styles.startButton}>
          <Text style={styles.buttonText}>▶ Start Live Tracking</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={stopLiveTracking} style={styles.stopButton}>
          <Text style={styles.buttonText}>⏹ Stop Tracking</Text>
        </TouchableOpacity>
      )}

      {locationChecked && (() => {
        const freshness = getFreshness(latestLocationTimestamp);
        if (freshness.status === FRESHNESS.UNAVAILABLE) {
          return (
            <View style={styles.liveInfo}>
              <Text style={styles.unavailableText}>📍 Location unavailable</Text>
            </View>
          );
        }
        return (
          <View style={styles.liveInfo}>
            <Text style={styles.liveText}>
              {freshness.status === FRESHNESS.RECENT ? '📍 Live' : '📍 Stale'} — {formatMinutesAgo(freshness.minutesAgo)}
            </Text>
            {latestLocation && (
              <Text style={styles.coordText}>
                {latestLocation.latitude.toFixed(4)}, {latestLocation.longitude.toFixed(4)}
              </Text>
            )}
          </View>
        );
      })()}
    </View>
  );
};

export default DriverRouteMap;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  map: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  backText: {
    color: '#007AFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  startButton: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: '#28a745',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    elevation: 3,
  },
  stopButton: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: '#dc3545',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  liveInfo: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0, 122, 255, 0.95)',
    padding: 12,
    borderRadius: 10,
    elevation: 3,
  },
  liveText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  unavailableText: {
    color: 'rgba(255,255,255,0.85)',
    fontStyle: 'italic',
    fontSize: 12,
  },
  coordText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    marginTop: 2,
  },
});