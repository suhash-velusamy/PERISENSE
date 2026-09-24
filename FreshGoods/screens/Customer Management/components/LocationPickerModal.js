/**
 * LocationPickerModal.js
 * Customer Preferred Location — map picker. Reuses the existing Leaflet map
 * component (no new map provider) and the same Modal-wrapped-map pattern
 * already established by RerouteReviewModal.js. Pure UI: the caller owns
 * the actual save request and decides what happens after (profile refetch,
 * dashboard state update, etc.) via onConfirm.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Alert } from 'react-native';
import * as Location from 'expo-location';
import LeafletMapView from '../../components/LeafletMapView';
import ThemedButton from '../../components/ThemedButton';
import { colors, spacing, borderRadius, typography } from '../../theme';

const DEFAULT_CENTER = { lat: 11.1271, lng: 78.6569 };

const LocationPickerModal = ({ visible, initialCoords, onClose, onConfirm, saving }) => {
  const [selected, setSelected] = useState(
    initialCoords ? { lat: initialCoords.latitude, lng: initialCoords.longitude } : null
  );
  const [locating, setLocating] = useState(false);

  // Convenience only, never required — matches the same permission pattern
  // already used for Rescue Sale opt-in (CustomerProfile.js).
  const handleUseCurrentLocation = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location permission needed',
          'Enable location access to use your current position, or tap the map to pick a point manually.'
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setSelected({ lat: position.coords.latitude, lng: position.coords.longitude });
    } catch (err) {
      Alert.alert('Error', 'Could not get your current location. Please tap the map instead.');
    } finally {
      setLocating(false);
    }
  }, []);

  const center = selected || DEFAULT_CENTER;
  const markers = selected ? [{ lat: selected.lat, lng: selected.lng, color: '#6C5CE7' }] : [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Preferred Delivery Location</Text>
          <View style={{ width: 24 }} />
        </View>

        <Text style={styles.hint}>
          Tap the map to drop a pin, confirm it, then tap Save Location below.
        </Text>

        <View style={styles.mapContainer}>
          <LeafletMapView
            center={center}
            zoom={selected ? 14 : 7}
            markers={markers}
            enableClick
            showSearch
            onLocationSelect={({ latitude, longitude }) => setSelected({ lat: latitude, lng: longitude })}
          />
        </View>

        <View style={styles.footer}>
          <ThemedButton
            title={locating ? 'Locating…' : '📍 Use My Current Location'}
            variant="outline"
            onPress={handleUseCurrentLocation}
            loading={locating}
            fullWidth
            style={{ marginBottom: spacing.sm }}
          />
          <ThemedButton
            title={saving ? 'Saving…' : 'Save Location'}
            variant="gradient"
            onPress={() => selected && onConfirm(selected.lat, selected.lng)}
            disabled={!selected || saving}
            loading={saving}
            fullWidth
          />
        </View>
      </View>
    </Modal>
  );
};

export default LocationPickerModal;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: spacing.xl,
  },
  closeText: { fontSize: 20, color: colors.text.primary },
  headerTitle: { ...typography.h4, color: colors.text.primary },
  hint: {
    ...typography.bodySmall,
    color: colors.text.muted,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  footer: { padding: spacing.md },
});
