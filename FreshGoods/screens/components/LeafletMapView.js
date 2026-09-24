/**
 * LeafletMapView - Unified map component using WebView + Leaflet
 * Works without Google Maps API key, compatible with Expo
 */
import React, { useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';

const { width, height } = Dimensions.get('window');

/**
 * Generate HTML for the Leaflet map
 */
const generateMapHTML = (options = {}) => {
    const {
        center = { lat: 11.1271, lng: 78.6569 },
        zoom = 7,
        markers = [],
        polylines = [],
        enableClick = false,
        showSearch = false,
    } = options;

    const markersJS = markers.map((m, i) => `
    L.marker([${m.lat}, ${m.lng}], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: '<div style="background:${m.color || '#007AFF'};width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:bold;">${m.label || ''}</div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })
    }).addTo(map)${m.popup ? `.bindPopup('${m.popup}')` : ''};
  `).join('\n');

    const polylinesJS = polylines.map((p, i) => `
    L.polyline([${p.coordinates.map(c => `[${c.lat}, ${c.lng}]`).join(',')}], {
      color: '${p.color || '#007AFF'}',
      weight: ${p.weight || 4},
      opacity: ${p.opacity || 0.8},
      ${p.dashArray ? `dashArray: '${p.dashArray}',` : ''}
    }).addTo(map);
  `).join('\n');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="initial-scale=1.0, user-scalable=no, width=device-width" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { height: 100%; width: 100%; }
    .custom-marker { background: transparent !important; border: none !important; }
    ${showSearch ? `
    #searchBar {
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      z-index: 1000;
    }
    #searchInput {
      width: 100%;
      padding: 10px 15px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }
    ` : ''}
    ${enableClick ? `
    #confirmBtn {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      background: #00CEC9;
      color: white;
      padding: 12px 32px;
      border: none;
      border-radius: 25px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      display: none;
      box-shadow: 0 4px 15px rgba(0,206,201,0.4);
    }
    ` : ''}
  </style>
</head>
<body>
  ${showSearch ? '<div id="searchBar"><input id="searchInput" placeholder="Search location..." /></div>' : ''}
  <div id="map"></div>
  ${enableClick ? '<button id="confirmBtn">✓ Confirm Location</button>' : ''}
  
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map').setView([${center.lat}, ${center.lng}], ${zoom});
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);
    
    // Add markers
    ${markersJS}
    
    // Add polylines
    ${polylinesJS}
    
    ${enableClick ? `
    let clickMarker = null;
    let selectedLocation = null;
    const confirmBtn = document.getElementById('confirmBtn');
    
    map.on('click', function(e) {
      if (clickMarker) map.removeLayer(clickMarker);
      
      clickMarker = L.marker(e.latlng, {
        icon: L.divIcon({
          className: 'custom-marker',
          html: '<div style="background:#6C5CE7;width:30px;height:30px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(108,92,231,0.5);"></div>',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        })
      }).addTo(map);
      
      selectedLocation = e.latlng;
      confirmBtn.style.display = 'block';
    });
    
    confirmBtn.addEventListener('click', function() {
      if (selectedLocation) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'locationSelected',
          lat: selectedLocation.lat,
          lng: selectedLocation.lng
        }));
      }
    });
    ` : ''}
    
    ${showSearch ? `
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
            ${enableClick ? `
            if (clickMarker) map.removeLayer(clickMarker);
            clickMarker = L.marker([lat, lng], {
              icon: L.divIcon({
                className: 'custom-marker',
                html: '<div style="background:#6C5CE7;width:30px;height:30px;border-radius:50%;border:3px solid white;"></div>',
                iconSize: [30, 30],
                iconAnchor: [15, 15],
              })
            }).addTo(map);
            selectedLocation = { lat, lng };
            confirmBtn.style.display = 'block';
            ` : ''}
          }
        } catch(err) {
          console.error('Search error:', err);
        }
      }
    });
    ` : ''}
    
    // Function to update map from React Native
    window.updateMap = function(data) {
      // Handle updates from React Native
      if (data.fitBounds && data.bounds) {
        map.fitBounds(data.bounds);
      }
      if (data.setView && data.center) {
        map.setView([data.center.lat, data.center.lng], data.zoom || 14);
      }
    };
  </script>
</body>
</html>
`;
};

/**
 * LeafletMapView Component
 */
const LeafletMapView = ({
    center,
    zoom = 10,
    markers = [],
    polylines = [],
    enableClick = false,
    showSearch = false,
    onLocationSelect,
    style,
}) => {
    const webViewRef = useRef(null);

    const html = useMemo(() => generateMapHTML({
        center: center || { lat: 11.1271, lng: 78.6569 },
        zoom,
        markers,
        polylines,
        enableClick,
        showSearch,
    }), [center, zoom, markers, polylines, enableClick, showSearch]);

    const handleMessage = useCallback((event) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'locationSelected' && onLocationSelect) {
                onLocationSelect({
                    latitude: data.lat,
                    longitude: data.lng,
                });
            }
        } catch (err) {
            console.error('WebView message error:', err);
        }
    }, [onLocationSelect]);

    const updateMap = useCallback((data) => {
        if (webViewRef.current) {
            webViewRef.current.injectJavaScript(`
        if (window.updateMap) {
          window.updateMap(${JSON.stringify(data)});
        }
        true;
      `);
        }
    }, []);

    return (
        <View style={[styles.container, style]}>
            <WebView
                ref={webViewRef}
                source={{ html }}
                style={styles.webview}
                onMessage={handleMessage}
                originWhitelist={['*']}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                renderLoading={() => (
                    <View style={styles.loading}>
                        <ActivityIndicator size="large" color="#007AFF" />
                        <Text style={styles.loadingText}>Loading map...</Text>
                    </View>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f0f0',
    },
    webview: {
        flex: 1,
    },
    loading: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
    },
});

export default LeafletMapView;
