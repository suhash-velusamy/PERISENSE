/**
 * ExportLocationView - Updated to use WebView + Leaflet
 * Works without Google Maps API key
 */
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { WebView } from 'react-native-webview';
import axios from 'axios'; // used only for the external OpenRouteService call below
import api from '../../../services/api';
import { getFreshness, formatMinutesAgo, FRESHNESS } from '../../../utils/freshness';

const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjRkZjk4MGNjNTZhZTAzYTE3ZGI0NDJiMjVkNzAzNGM5YTczOWIzODlhOTg5NGM1YzZhODYzZWQ0IiwiaCI6Im11cm11cjY0In0=';

const generateMainMapHTML = (start, end, route, intermediateLocations, liveLocation, isTracking) => {
  const center = start || { latitude: 11.1271, longitude: 78.6569 };
  const routeCoords = route.map(c => `[${c.latitude}, ${c.longitude}]`).join(',');

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
      width: 28px; height: 28px; border-radius: 50%;
      border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      font-size: 12px; font-weight: bold; color: white;
    }
    .live-marker { animation: pulse 1.5s infinite; }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(0,122,255,0.5); }
      70% { box-shadow: 0 0 0 12px rgba(0,122,255,0); }
      100% { box-shadow: 0 0 0 0 rgba(0,122,255,0); }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map').setView([${center.latitude}, ${center.longitude}], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    
    ${route.length > 0 ? `
    const routeCoords = [${routeCoords}];
    L.polyline(routeCoords, { color: '${isTracking ? '#4CAF50' : '#007AFF'}', weight: 4 }).addTo(map);
    map.fitBounds(routeCoords, { padding: [30, 30] });
    ` : ''}
    
    ${start && !isTracking ? `
    L.marker([${start.latitude}, ${start.longitude}], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-icon" style="background:#28a745;">🚀</div>',
        iconSize: [28, 28], iconAnchor: [14, 14],
      })
    }).addTo(map).bindPopup('Start');
    ` : ''}
    
    ${end ? `
    L.marker([${end.latitude}, ${end.longitude}], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-icon" style="background:#dc3545;">🏁</div>',
        iconSize: [28, 28], iconAnchor: [14, 14],
      })
    }).addTo(map).bindPopup('Destination');
    ` : ''}
    
    ${intermediateLocations.map((loc, i) => `
    L.marker([${loc.latitude}, ${loc.longitude}], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-icon" style="background:#ffc107;">${i + 1}</div>',
        iconSize: [28, 28], iconAnchor: [14, 14],
      })
    }).addTo(map).bindPopup('${loc.name || `Waypoint ${i + 1}`}');
    `).join('\n')}
    
    ${liveLocation ? `
    L.marker([${liveLocation.latitude}, ${liveLocation.longitude}], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-icon live-marker" style="background:#007AFF;">🚚</div>',
        iconSize: [28, 28], iconAnchor: [14, 14],
      })
    }).addTo(map).bindPopup('Current Location');
    map.setView([${liveLocation.latitude}, ${liveLocation.longitude}], 14);
    ` : ''}
  </script>
</body>
</html>
`;
};

const generatePickerMapHTML = (center, selectedLocation) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="initial-scale=1.0, user-scalable=no, width=device-width" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { margin: 0; padding: 0; }
    html, body, #map { height: 100%; width: 100%; }
    #searchBar {
      position: absolute; top: 10px; left: 10px; right: 10px; z-index: 1000;
    }
    #searchInput {
      width: 100%; padding: 12px 15px; border: none; border-radius: 10px;
      font-size: 14px; box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }
    #confirmBtn {
      position: absolute; bottom: 80px; left: 20px; right: 20px; z-index: 1000;
      background: #6C5CE7; color: white; padding: 14px; border: none;
      border-radius: 12px; font-size: 16px; font-weight: bold; display: none;
      box-shadow: 0 4px 15px rgba(108,92,231,0.4);
    }
    .selected-marker {
      background: #6C5CE7; width: 32px; height: 32px; border-radius: 50%;
      border: 3px solid white; box-shadow: 0 2px 10px rgba(108,92,231,0.5);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
    }
  </style>
</head>
<body>
  <div id="searchBar"><input id="searchInput" placeholder="Search location..." /></div>
  <div id="map"></div>
  <button id="confirmBtn">✓ Select This Location</button>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map').setView([${center.latitude}, ${center.longitude}], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    
    let marker = null;
    let selectedLocation = null;
    const confirmBtn = document.getElementById('confirmBtn');
    
    map.on('click', function(e) {
      if (marker) map.removeLayer(marker);
      marker = L.marker(e.latlng, {
        icon: L.divIcon({
          className: 'custom-marker',
          html: '<div class="selected-marker">📍</div>',
          iconSize: [32, 32], iconAnchor: [16, 16],
        })
      }).addTo(map);
      selectedLocation = e.latlng;
      confirmBtn.style.display = 'block';
    });
    
    confirmBtn.addEventListener('click', function() {
      if (selectedLocation) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'locationSelected',
          latitude: selectedLocation.lat,
          longitude: selectedLocation.lng
        }));
      }
    });
    
    document.getElementById('searchInput').addEventListener('keydown', async function(e) {
      if (e.key === 'Enter') {
        const query = e.target.value;
        try {
          const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query));
          const data = await res.json();
          if (data[0]) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            map.setView([lat, lng], 14);
            if (marker) map.removeLayer(marker);
            marker = L.marker([lat, lng], {
              icon: L.divIcon({
                className: 'custom-marker',
                html: '<div class="selected-marker">📍</div>',
                iconSize: [32, 32], iconAnchor: [16, 16],
              })
            }).addTo(map);
            selectedLocation = { lat, lng };
            confirmBtn.style.display = 'block';
          }
        } catch(err) { console.error('Search error:', err); }
      }
    });
  </script>
</body>
</html>
`;

const EnhancedExportLocationView = ({ selectedExport, onBack }) => {
  const [routeCoords, setRouteCoords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [intermediateLocations, setIntermediateLocations] = useState([]);
  const [liveLocation, setLiveLocation] = useState(null);
  const [liveLocationTimestamp, setLiveLocationTimestamp] = useState(null);
  const [locationFetchAttempted, setLocationFetchAttempted] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationName, setLocationName] = useState('');
  const [mapKey, setMapKey] = useState(0);
  const intervalRef = useRef(null);

  const start = selectedExport.startLocation;
  const end = selectedExport.endLocation;

  const fetchRoute = useCallback(async (startingPoint = null) => {
    try {
      setLoading(true);
      const routeStart = isTracking && liveLocation ? liveLocation : startingPoint || start;

      const coordinates = [
        [routeStart.longitude, routeStart.latitude],
        ...intermediateLocations.map(loc => [loc.longitude, loc.latitude]),
        [end.longitude, end.latitude],
      ];

      const response = await axios.post(
        'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
        { coordinates, instructions: false, preference: 'fastest' },
        {
          headers: { Authorization: ORS_API_KEY, 'Content-Type': 'application/json' },
          timeout: 10000,
        }
      );

      if (response.data?.features?.length > 0) {
        const coords = response.data.features[0].geometry.coordinates.map(
          ([lon, lat]) => ({ latitude: lat, longitude: lon })
        );
        setRouteCoords(coords);
      }
    } catch (err) {
      // Silently fall back to straight lines
      console.log('Using direct route (routing service unavailable)');
      setRouteCoords([
        isTracking && liveLocation ? liveLocation : start,
        ...intermediateLocations,
        end
      ]);
    } finally {
      setLoading(false);
      setMapKey(k => k + 1);
    }
  }, [start, end, intermediateLocations, isTracking, liveLocation]);

  const fetchIntermediateLocations = async () => {
    try {
      const res = await api.get(
        `/api/vendor/export/intermediateLocation/get/${selectedExport._id}`
      );
      if (res.data) setIntermediateLocations(res.data);
    } catch (err) {
      console.error('Failed to fetch waypoints:', err);
    }
  };

  const addIntermediateLocation = async () => {
    if (!selectedLocation) {
      Alert.alert('Error', 'Please select a location on the map');
      return;
    }

    try {
      await api.post(
        `/api/vendor/export/intermediateLocation/push/${selectedExport._id}`,
        { ...selectedLocation, name: locationName || `Waypoint ${intermediateLocations.length + 1}` }
      );
      await fetchIntermediateLocations();
      setShowMapModal(false);
      setSelectedLocation(null);
      setLocationName('');
    } catch (err) {
      Alert.alert('Error', 'Failed to add waypoint');
    }
  };

  const fetchLiveLocation = async () => {
    try {
      // Fixed: this vendor-side screen was incorrectly calling the
      // driver-prefixed endpoint (which now correctly requires a Driver
      // role token and would 403 for a vendor). The vendor route mounted
      // under /api/vendor exposes the same data for the vendor who owns
      // this export.
      const res = await api.get(
        `/api/vendor/device/location-data/${selectedExport._id}`
      );
      const locations = res.data;
      setLocationFetchAttempted(true);
      if (locations?.length > 0) {
        const latest = locations[locations.length - 1];
        setLiveLocation({ latitude: latest.latitude, longitude: latest.longitude });
        setLiveLocationTimestamp(latest.timestamp || null);
        setMapKey(k => k + 1);
      } else {
        // No reading exists at all — do not fabricate a location.
        setLiveLocation(null);
        setLiveLocationTimestamp(null);
      }
    } catch (err) {
      console.error('Location fetch error:', err);
      setLocationFetchAttempted(true);
      setLiveLocation(null);
      setLiveLocationTimestamp(null);
    }
  };

  const startLiveTracking = async () => {
    if (isTracking) return;
    await fetchLiveLocation();
    intervalRef.current = setInterval(fetchLiveLocation, 15000);
    setIsTracking(true);
  };

  const stopLiveTracking = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsTracking(false);
    fetchRoute();
  };

  const handlePickerMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'locationSelected') {
        setSelectedLocation({ latitude: data.latitude, longitude: data.longitude });
      }
    } catch (err) {
      console.error('Message parse error:', err);
    }
  };

  useEffect(() => {
    fetchIntermediateLocations();
    fetchRoute();
    // One-shot check so freshness/unavailable state is visible immediately,
    // without requiring the vendor to press "Start Tracking" first.
    fetchLiveLocation();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    if (intermediateLocations.length > 0) {
      fetchRoute(isTracking ? liveLocation : null);
    }
  }, [intermediateLocations]);

  const mainMapHtml = useMemo(() =>
    generateMainMapHTML(start, end, routeCoords, intermediateLocations, liveLocation, isTracking),
    [start, end, routeCoords, intermediateLocations, liveLocation, isTracking]
  );

  const pickerMapHtml = useMemo(() =>
    generatePickerMapHTML(start || { latitude: 11.1271, longitude: 78.6569 }, selectedLocation),
    [start, selectedLocation]
  );

  if (loading && routeCoords.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text>Calculating route...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        key={mapKey}
        source={{ html: mainMapHtml }}
        style={styles.map}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />

      <View style={styles.infoPanel}>
        <Text style={styles.title}>📍 {selectedExport.itemName}</Text>
        <Text style={styles.infoText}>Status: {selectedExport.status}</Text>
        {intermediateLocations.length > 0 && (
          <Text style={styles.infoText}>📌 {intermediateLocations.length} waypoint(s)</Text>
        )}
        {loading && <Text style={styles.recalcText}>🔄 Recalculating route...</Text>}
        {locationFetchAttempted && (() => {
          const freshness = getFreshness(liveLocationTimestamp);
          if (freshness.status === FRESHNESS.UNAVAILABLE) {
            return <Text style={styles.locationUnavailableText}>📡 Location unavailable</Text>;
          }
          const color = freshness.status === FRESHNESS.RECENT ? '#28a745' : '#dc3545';
          return (
            <Text style={[styles.infoText, { color }]}>
              📡 {freshness.status === FRESHNESS.RECENT ? 'Live' : 'Stale'} — last update {formatMinutesAgo(freshness.minutesAgo)}
            </Text>
          );
        })()}
        {isTracking && liveLocation && (
          <Text style={styles.infoText}>
            {liveLocation.latitude.toFixed(4)}, {liveLocation.longitude.toFixed(4)}
          </Text>
        )}
      </View>

      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setShowMapModal(true)} style={styles.addButton}>
        <Text style={styles.buttonText}>➕ Add Waypoint</Text>
      </TouchableOpacity>

      {!isTracking ? (
        <TouchableOpacity onPress={startLiveTracking} style={styles.startButton}>
          <Text style={styles.buttonText}>▶ Start Tracking</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={stopLiveTracking} style={styles.stopButton}>
          <Text style={styles.buttonText}>⏹ Stop</Text>
        </TouchableOpacity>
      )}

      <Modal visible={showMapModal} animationType="slide">
        <View style={styles.modalContainer}>
          <WebView
            source={{ html: pickerMapHtml }}
            style={styles.fullMap}
            originWhitelist={['*']}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            onMessage={handlePickerMessage}
          />

          <View style={styles.modalForm}>
            <TextInput
              style={styles.input}
              placeholder="Waypoint name (optional)"
              value={locationName}
              onChangeText={setLocationName}
            />
            {selectedLocation && (
              <Text style={styles.coordsText}>
                📍 {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
              </Text>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowMapModal(false)} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={addIntermediateLocation}
                style={[styles.confirmButton, !selectedLocation && styles.disabledButton]}
                disabled={!selectedLocation}
              >
                <Text style={styles.confirmText}>Add Waypoint</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  infoPanel: {
    position: 'absolute', top: 40, left: 15, right: 15,
    backgroundColor: 'rgba(255,255,255,0.95)', padding: 12,
    borderRadius: 12, elevation: 3,
  },
  title: { fontSize: 16, fontWeight: 'bold', color: '#007AFF' },
  infoText: { fontSize: 13, color: '#444', marginTop: 2 },
  locationUnavailableText: { fontSize: 13, color: '#999', marginTop: 2, fontStyle: 'italic' },
  recalcText: { fontSize: 12, color: '#007AFF', marginTop: 4, fontStyle: 'italic' },
  backButton: {
    position: 'absolute', top: 110, left: 15,
    backgroundColor: '#fff', padding: 10, borderRadius: 20, elevation: 2,
  },
  backText: { color: '#007AFF', fontWeight: 'bold' },
  addButton: {
    position: 'absolute', bottom: 90, alignSelf: 'center',
    backgroundColor: '#6C5CE7', paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 25, elevation: 3,
  },
  startButton: {
    position: 'absolute', bottom: 30, alignSelf: 'center',
    backgroundColor: '#28a745', paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 25, elevation: 3,
  },
  stopButton: {
    position: 'absolute', bottom: 30, alignSelf: 'center',
    backgroundColor: '#dc3545', paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 25, elevation: 3,
  },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  modalContainer: { flex: 1 },
  fullMap: { flex: 1 },
  modalForm: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'white', padding: 20,
    borderTopLeftRadius: 20, borderTopRightRadius: 20, elevation: 5,
  },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    padding: 12, marginBottom: 10, fontSize: 14,
  },
  coordsText: { fontSize: 12, color: '#666', marginBottom: 10, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', gap: 10 },
  cancelButton: {
    flex: 1, padding: 14, borderRadius: 10,
    alignItems: 'center', backgroundColor: '#f0f0f0',
  },
  cancelText: { color: '#666', fontWeight: '600' },
  confirmButton: {
    flex: 1, padding: 14, borderRadius: 10,
    alignItems: 'center', backgroundColor: '#6C5CE7',
  },
  disabledButton: { backgroundColor: '#ccc' },
  confirmText: { color: 'white', fontWeight: 'bold' },
});

export default EnhancedExportLocationView;
