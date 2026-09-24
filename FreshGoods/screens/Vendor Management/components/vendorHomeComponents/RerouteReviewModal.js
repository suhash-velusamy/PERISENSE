/**
 * RerouteReviewModal.js
 * Stage 12 — Vendor route preview + confirm. Reuses the existing Leaflet
 * map component (no new map provider) and the existing rescue-sale/
 * shipment ownership already enforced server-side. The Vendor decides;
 * there is no Driver approval gate on this action (Core Business
 * Decision — see server/services/rerouteService.js).
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import api from '../../../services/api';
import { colors, spacing, borderRadius, typography, shadows } from '../../../theme';
import ThemedCard from '../../../components/ThemedCard';
import ThemedButton from '../../../components/ThemedButton';
import LeafletMapView from '../../../components/LeafletMapView';
import { getConditionMeta, getRiskLabel } from '../../../utils/condition';

const ERROR_MESSAGES = {
  LOCATION_UNRELIABLE: "The vehicle's current location is stale or unavailable, so a route cannot be planned right now. Try again once the vehicle reports a fresh location.",
  BUYER_LOCATION_UNAVAILABLE: "The selected buyer's location is unavailable, so a route cannot be planned.",
  NO_BUYER_SELECTED: 'Select a buyer for this rescue sale before planning a route.',
  RESCUE_SALE_NOT_ACTIVE: 'This rescue sale is no longer active.',
  INVALID_SHIPMENT_STATUS: 'This shipment is no longer eligible for a rescue reroute.',
  ROUTE_CALCULATION_FAILED: 'The routing service could not calculate a route. Please try again shortly.',
  ROUTE_TIMEOUT: 'The routing service timed out. Please try again.',
  NO_ROUTE_FOUND: 'No drivable route could be found to this destination.',
  ROUTING_NOT_CONFIGURED: 'Routing is not currently available. Please contact support.',
  REROUTE_ALREADY_EXISTS: 'An active reroute already exists for this shipment.',
};

const RerouteReviewModal = ({ rescueSaleId, onClose, onConfirmed }) => {
  const [preview, setPreview] = useState(undefined); // undefined = loading, null = error
  const [errorMessage, setErrorMessage] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const loadPreview = useCallback(async () => {
    setPreview(undefined);
    setErrorMessage(null);
    try {
      const res = await api.post(`/api/vendor/rescue-sales/${rescueSaleId}/route-preview`);
      setPreview(res.data);
    } catch (err) {
      const code = err.response?.data?.code;
      setErrorMessage(ERROR_MESSAGES[code] || err.message || 'Failed to plan rescue route.');
      setPreview(null);
    }
  }, [rescueSaleId]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await api.post(`/api/vendor/rescue-sales/${rescueSaleId}/confirm-reroute`);
      Alert.alert('Reroute Confirmed', 'The driver has been notified of the new rescue delivery route.');
      onConfirmed?.();
    } catch (err) {
      const code = err.response?.data?.code;
      Alert.alert('Could not confirm reroute', ERROR_MESSAGES[code] || err.message || 'Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  const meta = preview ? getConditionMeta(preview.reason?.conditionStatus) : null;

  // Map center/markers derived only from the route polyline + original
  // destination — never a separately-labeled "customer coordinates" field
  // (see rerouteService.js's toClientRoute comment for why).
  const markers = preview
    ? [
        { lat: preview.route.polyline[0][0], lng: preview.route.polyline[0][1], color: '#007AFF', label: 'V' },
        {
          lat: preview.route.polyline[preview.route.polyline.length - 1][0],
          lng: preview.route.polyline[preview.route.polyline.length - 1][1],
          color: '#dc3545',
          label: '🚨',
          popup: preview.destinationLabel || 'Rescue destination',
        },
      ]
    : [];
  const polylines = preview
    ? [{ coordinates: preview.route.polyline.map(([lat, lng]) => ({ lat, lng })), color: '#dc3545' }]
    : [];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🚨 Plan Rescue Route</Text>
          <View style={{ width: 24 }} />
        </View>

        {preview === undefined ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Calculating route...</Text>
          </View>
        ) : preview === null ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <ThemedButton title="Retry" variant="outline" onPress={loadPreview} style={{ marginTop: spacing.lg }} />
          </View>
        ) : (
          <ScrollView style={styles.scroll}>
            <View style={styles.mapContainer}>
              <LeafletMapView center={{ lat: markers[0].lat, lng: markers[0].lng }} zoom={11} markers={markers} polylines={polylines} />
            </View>

            <ThemedCard variant="outlined" style={[styles.card, { backgroundColor: meta.bg, borderColor: meta.color }]}>
              <Text style={[styles.conditionText, { color: meta.color }]}>
                {meta.icon} {getRiskLabel(preview.reason?.riskStatus)}
              </Text>
              <Text style={styles.reasonText}>{preview.reason?.conditionReason}</Text>
            </ThemedCard>

            <ThemedCard variant="outlined" style={styles.card}>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{preview.route.distanceKm} km</Text>
                  <Text style={styles.statLabel}>Distance</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{preview.route.durationMinutes} min</Text>
                  <Text style={styles.statLabel}>ETA</Text>
                </View>
              </View>
              {preview.destinationLabel && (
                <Text style={styles.destinationLabel}>📍 Near {preview.destinationLabel}</Text>
              )}
            </ThemedCard>

            {preview.conflictingReroute && (
              <ThemedCard variant="outlined" style={[styles.card, { borderColor: colors.error }]}>
                <Text style={{ color: colors.error }}>
                  An active reroute already exists for this shipment (status: {preview.conflictingReroute.status}).
                </Text>
              </ThemedCard>
            )}

            <ThemedButton
              title={confirming ? 'Confirming...' : 'Confirm Reroute'}
              variant="gradient"
              onPress={handleConfirm}
              loading={confirming}
              disabled={!!preview.conflictingReroute}
              fullWidth
              style={{ marginTop: spacing.lg, marginBottom: spacing.xxl }}
            />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

export default RerouteReviewModal;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md, paddingTop: spacing.xl,
  },
  closeText: { fontSize: 20, color: colors.text.primary },
  headerTitle: { ...typography.h4, color: colors.text.primary },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  loadingText: { ...typography.body, color: colors.text.muted, marginTop: spacing.md },
  errorIcon: { fontSize: 48, marginBottom: spacing.md },
  errorText: { ...typography.body, color: colors.text.secondary, textAlign: 'center' },
  scroll: { flex: 1, paddingHorizontal: spacing.md },
  mapContainer: { height: 280, borderRadius: borderRadius.md, overflow: 'hidden', marginBottom: spacing.md },
  card: { marginBottom: spacing.md },
  conditionText: { ...typography.h4, marginBottom: spacing.xs },
  reasonText: { ...typography.bodySmall, color: colors.text.secondary },
  statRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statValue: { ...typography.h3, color: colors.text.primary },
  statLabel: { ...typography.caption, color: colors.text.muted, marginTop: 2 },
  destinationLabel: { ...typography.bodySmall, color: colors.text.secondary, marginTop: spacing.sm, textAlign: 'center' },
});
