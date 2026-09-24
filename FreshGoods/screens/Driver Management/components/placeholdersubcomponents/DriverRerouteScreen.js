/**
 * DriverRerouteScreen.js
 * Stage 12 — Driver's view of a Vendor-confirmed rescue reroute. Vendor
 * decides; Driver acknowledges and executes. There is NO business-level
 * reject here — only Acknowledge, and Report Issue for genuine operational
 * problems (server/services/rerouteService.js).
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import api from '../../../services/api';
import { colors, spacing, borderRadius, typography, shadows } from '../../../theme';
import ThemedCard from '../../../components/ThemedCard';
import ThemedButton from '../../../components/ThemedButton';
import LeafletMapView from '../../../components/LeafletMapView';
import { getRiskLabel } from '../../../utils/condition';

const ISSUE_REASONS = ['Vehicle problem', 'Road blocked', 'Unsafe route', 'Destination inaccessible', 'Emergency', 'Other'];

const DriverRerouteScreen = ({ exportId, onBack }) => {
  const [reroute, setReroute] = useState(undefined); // undefined = loading, null = none
  const [actionLoading, setActionLoading] = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueReason, setIssueReason] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/api/driver/export/${exportId}/reroute`);
      setReroute(res.data);
    } catch (err) {
      console.error('Failed to load reroute:', err);
      setReroute(null);
    }
  }, [exportId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAcknowledge = async () => {
    setActionLoading(true);
    try {
      await api.post(`/api/driver/export/${exportId}/reroute/acknowledge`);
      await load();
      Alert.alert('Acknowledged', "You've acknowledged the rescue route. Follow it to complete the delivery.");
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to acknowledge reroute.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReportIssue = async () => {
    if (!issueReason.trim()) {
      Alert.alert('Reason required', 'Please describe the issue before submitting.');
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/api/driver/export/${exportId}/reroute/report-issue`, { reason: issueReason.trim() });
      await load();
      setShowIssueForm(false);
      setIssueReason('');
      Alert.alert('Issue Reported', 'The vendor has been notified and will decide the next action.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to report issue.');
    } finally {
      setActionLoading(false);
    }
  };

  if (reroute === undefined) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (reroute === null) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyIcon}>🚨</Text>
        <Text style={styles.emptyText}>No rescue route assigned for this delivery.</Text>
        <TouchableOpacity onPress={onBack} style={{ marginTop: spacing.lg }}>
          <Text style={styles.backLink}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const polyline = reroute.route.polyline;
  const markers = [
    { lat: polyline[0][0], lng: polyline[0][1], color: '#007AFF', label: 'V' },
    { lat: polyline[polyline.length - 1][0], lng: polyline[polyline.length - 1][1], color: '#dc3545', label: '🚨', popup: reroute.destinationLabel || 'Rescue destination' },
  ];
  const polylines = [{ coordinates: polyline.map(([lat, lng]) => ({ lat, lng })), color: '#dc3545' }];

  const canAcknowledge = reroute.status === 'DRIVER_NOTIFIED';
  const canReportIssue = ['DRIVER_NOTIFIED', 'ACTIVE'].includes(reroute.status);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🚨 New Rescue Route</Text>
      </View>

      <View style={styles.mapContainer}>
        <LeafletMapView center={{ lat: markers[0].lat, lng: markers[0].lng }} zoom={11} markers={markers} polylines={polylines} />
      </View>

      <ThemedCard variant="outlined" style={styles.card}>
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{reroute.route.distanceKm} km</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{reroute.route.durationMinutes} min</Text>
            <Text style={styles.statLabel}>ETA</Text>
          </View>
        </View>
        {reroute.destinationLabel && <Text style={styles.destinationLabel}>📍 Near {reroute.destinationLabel}</Text>}
      </ThemedCard>

      <ThemedCard variant="outlined" style={styles.card}>
        <Text style={styles.sectionTitle}>Status</Text>
        <Text style={styles.statusText}>{reroute.status.replace(/_/g, ' ')}</Text>
        {reroute.status === 'ISSUE_REPORTED' && (
          <Text style={styles.issueText}>⚠ Issue reported: {reroute.issueReason}. Waiting on the vendor.</Text>
        )}
        {reroute.status === 'COMPLETED' && <Text style={styles.completedText}>✅ Rescue delivery completed.</Text>}
      </ThemedCard>

      {showIssueForm ? (
        <ThemedCard variant="outlined" style={styles.card}>
          <Text style={styles.sectionTitle}>Report an Issue</Text>
          <View style={styles.reasonChips}>
            {ISSUE_REASONS.map((r) => (
              <TouchableOpacity key={r} style={[styles.chip, issueReason === r && styles.chipSelected]} onPress={() => setIssueReason(r)}>
                <Text style={[styles.chipText, issueReason === r && styles.chipTextSelected]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Describe the issue..."
            value={issueReason}
            onChangeText={setIssueReason}
            multiline
          />
          <View style={styles.actionsRow}>
            <ThemedButton title="Cancel" variant="outline" onPress={() => setShowIssueForm(false)} style={styles.actionBtn} />
            <ThemedButton title="Submit" variant="primary" onPress={handleReportIssue} loading={actionLoading} style={styles.actionBtn} />
          </View>
        </ThemedCard>
      ) : (
        <View style={styles.actionsContainer}>
          {canAcknowledge && (
            <ThemedButton title="Acknowledge" variant="gradient" onPress={handleAcknowledge} loading={actionLoading} fullWidth style={{ marginBottom: spacing.sm }} />
          )}
          {canReportIssue && (
            <ThemedButton title="Report Issue" variant="outline" onPress={() => setShowIssueForm(true)} fullWidth />
          )}
        </View>
      )}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
};

export default DriverRerouteScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { ...typography.body, color: colors.text.muted, textAlign: 'center' },
  backLink: { ...typography.button, color: colors.primary },
  header: { padding: spacing.md, paddingTop: spacing.xl },
  backText: { color: colors.primary, marginBottom: spacing.sm, ...typography.body },
  headerTitle: { ...typography.h3, color: colors.text.primary },
  mapContainer: { height: 260, marginHorizontal: spacing.md, borderRadius: borderRadius.md, overflow: 'hidden', marginBottom: spacing.md },
  card: { marginHorizontal: spacing.md, marginBottom: spacing.md },
  statRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statValue: { ...typography.h3, color: colors.text.primary },
  statLabel: { ...typography.caption, color: colors.text.muted, marginTop: 2 },
  destinationLabel: { ...typography.bodySmall, color: colors.text.secondary, marginTop: spacing.sm, textAlign: 'center' },
  sectionTitle: { ...typography.captionMedium, color: colors.text.muted, marginBottom: spacing.xs, textTransform: 'uppercase' },
  statusText: { ...typography.h4, color: colors.text.primary },
  issueText: { ...typography.bodySmall, color: colors.warning, marginTop: spacing.sm },
  completedText: { ...typography.bodySmall, color: colors.success, marginTop: spacing.sm },
  actionsContainer: { marginHorizontal: spacing.md },
  reasonChips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.round,
    borderWidth: 1, borderColor: colors.border.light, marginRight: spacing.xs, marginBottom: spacing.xs,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text.secondary },
  chipTextSelected: { color: colors.text.light },
  input: {
    borderWidth: 1, borderColor: colors.border.light, borderRadius: borderRadius.md,
    padding: spacing.sm + 4, ...typography.body, color: colors.text.primary, minHeight: 60, marginBottom: spacing.md,
  },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { flex: 1 },
});
