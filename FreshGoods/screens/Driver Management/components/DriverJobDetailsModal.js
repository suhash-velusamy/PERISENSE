/**
 * DriverJobDetailsModal.js
 * Full job details for a Driver — organized into the sections Stage 7 §2
 * asks for (Shipment / Trip / Vendor / Vehicle / Customer / Payment), plus
 * an IoT summary, live-location freshness, and the backend-sourced
 * timeline. Also carries the same Accept/Reject/Start/Complete actions as
 * DriverAssignedExports.js so this can be opened as a single "everything
 * about this job" screen without losing the ability to act on it — but the
 * primary fast-path for those actions stays the inline card in
 * DriverAssignedExports.js (Stage 7 §15: don't add navigation depth to
 * reach Start/Complete).
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Linking,
} from 'react-native';
import api from '../../services/api';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import ThemedCard from '../../components/ThemedCard';
import ThemedButton from '../../components/ThemedButton';
import { getFreshness, formatMinutesAgo, FRESHNESS } from '../../utils/freshness';
import { getConditionMeta, getRiskLabel } from '../../utils/condition';
import DriverRerouteScreen from './placeholdersubcomponents/DriverRerouteScreen';

const EVENT_LABELS = {
  SHIPMENT_CREATED: 'Shipment created',
  DRIVER_ASSIGNED: 'Driver assigned',
  DRIVER_ACCEPTED: 'Driver accepted',
  DRIVER_REJECTED: 'Driver rejected',
  DELIVERY_STARTED: 'Delivery started',
  DELIVERY_COMPLETED: 'Delivery completed',
  SHIPMENT_CANCELLED: 'Shipment cancelled',
  SHIPMENT_STATUS_CHANGED: 'Status changed',
};

const DetailRow = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const DriverJobDetailsModal = ({ item, onClose, onChanged, onChatWithVendor }) => {
  const [job, setJob] = useState(item);
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [latestReading, setLatestReading] = useState(undefined); // undefined = loading, null = none
  const [condition, setCondition] = useState(undefined); // undefined = loading, null = unavailable
  const [location, setLocation] = useState(undefined);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [reroute, setReroute] = useState(undefined); // undefined = loading, null = none
  const [showReroute, setShowReroute] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/api/driver/export/${job._id}/events`);
        setEvents(res.data || []);
      } catch (err) {
        console.error('Failed to load job events:', err);
      } finally {
        setLoadingEvents(false);
      }
    })();

    if (!job.device) {
      setLatestReading(null);
      setCondition(null);
    } else {
      (async () => {
        try {
          const res = await api.get(`/api/driver/device/sensor-data/${job._id}`);
          const readings = res.data || [];
          setLatestReading(readings.length > 0 ? readings[readings.length - 1] : null);
        } catch (err) {
          setLatestReading(null);
        }
      })();

      (async () => {
        try {
          const res = await api.get(`/api/driver/device/condition/${job._id}`);
          setCondition(res.data);
        } catch (err) {
          setCondition(null);
        }
      })();
    }

    if (job.status === 'IN_TRANSIT' || job.status === 'COMPLETED') {
      (async () => {
        try {
          const res = await api.get(`/api/driver/device/location-data/${job._id}`);
          const locations = res.data || [];
          setLocation(locations.length > 0 ? locations[locations.length - 1] : null);
        } catch (err) {
          setLocation(null);
        }
      })();
    } else {
      setLocation(null);
    }

    if (job.status === 'IN_TRANSIT') {
      (async () => {
        try {
          const res = await api.get(`/api/driver/export/${job._id}/reroute`);
          setReroute(res.data);
        } catch (err) {
          setReroute(null);
        }
      })();
    } else {
      setReroute(null);
    }
  }, [job._id, job.status]);

  const handleCallVendor = () => {
    if (job.vendorId?.mobileNo) {
      Linking.openURL(`tel:${job.vendorId.mobileNo}`);
    }
  };

  const runAction = async (fn, successMessage) => {
    setActionLoading(true);
    try {
      const res = await fn();
      Alert.alert('Success', successMessage);
      setJob(res.data.export || res.data);
      onChanged?.();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Action failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = () =>
    runAction(() => api.put(`/api/driver/export/accept/${job._id}`), 'Job accepted.');

  const handleReject = () => {
    if (!rejectReason.trim()) {
      Alert.alert('Reason required', 'Please explain why you are rejecting this job.');
      return;
    }
    runAction(
      () => api.put(`/api/driver/export/reject/${job._id}`, { reason: rejectReason.trim() }),
      'Job rejected.'
    ).then(() => setShowRejectBox(false));
  };

  const handleStart = () =>
    runAction(() => api.put(`/api/driver/export/start/${job._id}`), 'Delivery started.');

  const handleComplete = () =>
    runAction(() => api.put(`/api/driver/export/complete/${job._id}`), 'Delivery completed.');

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{job.itemName}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.scroll}>
          {/* Stage 12 — rescue reroute banner. Only shown when this job
              actually has one; no-op for every ordinary delivery. */}
          {reroute && reroute.status !== 'COMPLETED' && reroute.status !== 'CANCELLED' && (
            <TouchableOpacity onPress={() => setShowReroute(true)}>
              <View style={[styles.rerouteBanner, reroute.status === 'ISSUE_REPORTED' && styles.rerouteBannerIssue]}>
                <Text style={styles.rerouteBannerTitle}>
                  {reroute.status === 'DRIVER_NOTIFIED' ? '🚨 New Rescue Route Assigned' : reroute.status === 'ISSUE_REPORTED' ? '⚠ Issue reported — waiting on vendor' : '🚨 Rescue route in progress'}
                </Text>
                <Text style={styles.rerouteBannerHint}>Tap to view route{reroute.status === 'DRIVER_NOTIFIED' ? ' and acknowledge' : ''} →</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Shipment */}
          <Text style={styles.sectionTitle}>Shipment</Text>
          <ThemedCard variant="outlined" style={styles.card}>
            <DetailRow label="Product" value={job.itemName} />
            <DetailRow label="Quantity" value={`${job.quantity} ${job.unit || ''}`.trim()} />
            <DetailRow label="Status" value={job.status} />
            <DetailRow label="Created" value={job.createdAt ? new Date(job.createdAt).toLocaleString() : 'N/A'} />
            {job.status === 'REJECTED' && (
              <DetailRow label="Rejection Reason" value={job.rejectionReason || 'No reason given'} />
            )}
          </ThemedCard>

          {/* Trip */}
          <Text style={styles.sectionTitle}>Trip</Text>
          <ThemedCard variant="outlined" style={styles.card}>
            <DetailRow
              label="Pickup"
              value={job.startLocation ? `${job.startLocation.latitude.toFixed(4)}, ${job.startLocation.longitude.toFixed(4)}` : 'N/A'}
            />
            <DetailRow
              label="Destination"
              value={job.endLocation ? `${job.endLocation.latitude.toFixed(4)}, ${job.endLocation.longitude.toFixed(4)}` : 'N/A'}
            />
            <DetailRow
              label="Trip Duration"
              value={`${new Date(job.startDate).toLocaleDateString()} → ${new Date(job.endDate).toLocaleDateString()}`}
            />
            <DetailRow
              label="Expected Drop Time"
              value={job.expectedDropTime ? new Date(job.expectedDropTime).toLocaleString() : 'Not set'}
            />
            {job.instructions && <DetailRow label="Instructions" value={job.instructions} />}
          </ThemedCard>

          {/* Vendor */}
          <Text style={styles.sectionTitle}>Vendor</Text>
          <ThemedCard variant="outlined" style={styles.card}>
            <DetailRow label="Name" value={job.vendorId?.name || 'N/A'} />
            {job.vendorId?.mobileNo && <DetailRow label="Contact" value={job.vendorId.mobileNo} />}
            <View style={styles.actionsRow}>
              {job.vendorId?.mobileNo && (
                <ThemedButton title="Call" variant="outline" size="small" icon="📞" onPress={handleCallVendor} style={styles.actionBtn} />
              )}
              {onChatWithVendor && job.vendorId && (
                <ThemedButton
                  title="Message"
                  variant="primary"
                  size="small"
                  icon="💬"
                  onPress={() => onChatWithVendor(job.vendorId._id, job.vendorId.name)}
                  style={styles.actionBtn}
                />
              )}
            </View>
          </ThemedCard>

          {/* Vehicle */}
          <Text style={styles.sectionTitle}>Vehicle</Text>
          <ThemedCard variant="outlined" style={styles.card}>
            <DetailRow label="Vehicle Number" value={job.vehicle?.vehicleNumber || 'N/A'} />
            {job.vehicle?.brand && <DetailRow label="Brand" value={job.vehicle.brand} />}
            {job.vehicle?.capacity && <DetailRow label="Capacity" value={job.vehicle.capacity} />}
            <DetailRow label="IoT Device" value={job.device?.deviceName || 'No device linked'} />
          </ThemedCard>

          {/* Customer — only what's needed to complete the delivery */}
          {job.customer && (
            <>
              <Text style={styles.sectionTitle}>Customer</Text>
              <ThemedCard variant="outlined" style={styles.card}>
                <DetailRow label="Name" value={job.customer.name} />
              </ThemedCard>
            </>
          )}

          {/* Payment — driver's own salary only, not vendor pricing */}
          <Text style={styles.sectionTitle}>Payment</Text>
          <ThemedCard variant="outlined" style={styles.card}>
            <DetailRow label="Your Salary" value={job.driverSalary != null ? `₹${job.driverSalary}` : 'N/A'} />
          </ThemedCard>

          {/* Location (IN_TRANSIT / COMPLETED only) */}
          {(job.status === 'IN_TRANSIT' || job.status === 'COMPLETED') && (
            <>
              <Text style={styles.sectionTitle}>Location</Text>
              <ThemedCard variant="outlined" style={styles.card}>
                {location === undefined ? (
                  <ActivityIndicator color={colors.primary} />
                ) : location === null ? (
                  <Text style={styles.emptyText}>Location unavailable</Text>
                ) : (() => {
                  const freshness = getFreshness(location.timestamp);
                  return (
                    <DetailRow
                      label={freshness.status === FRESHNESS.RECENT ? 'Live' : 'Last Known'}
                      value={`${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)} (${formatMinutesAgo(freshness.minutesAgo)})`}
                    />
                  );
                })()}
              </ThemedCard>
            </>
          )}

          {/* IoT */}
          <Text style={styles.sectionTitle}>IoT Device</Text>
          {job.device && condition && (() => {
            const meta = getConditionMeta(condition.conditionStatus);
            return (
              <View style={[styles.conditionBanner, { backgroundColor: meta.bg, borderColor: meta.color }]}>
                <View style={styles.conditionHeaderRow}>
                  <Text style={[styles.conditionStatusText, { color: meta.color }]}>
                    {meta.icon} {meta.label.toUpperCase()}
                  </Text>
                  <Text style={[styles.conditionRiskText, { color: meta.color }]}>
                    {getRiskLabel(condition.riskStatus)}
                  </Text>
                </View>
                <Text style={styles.conditionReasonText}>{condition.reason}</Text>
              </View>
            );
          })()}
          <ThemedCard variant="outlined" style={styles.card}>
            {!job.device ? (
              <Text style={styles.emptyText}>No IoT device linked to this vehicle.</Text>
            ) : latestReading === undefined ? (
              <ActivityIndicator color={colors.primary} />
            ) : latestReading === null ? (
              <Text style={styles.emptyText}>No recent sensor data available.</Text>
            ) : (
              <>
                <DetailRow label="Temperature" value={`${latestReading.temperature}°C`} />
                <DetailRow label="Humidity" value={`${latestReading.humidity}%`} />
                <DetailRow label="Ethylene" value={`${latestReading.ethyleneLevel} ppm`} />
                {(() => {
                  const freshness = getFreshness(latestReading.timestamp);
                  return (
                    <DetailRow
                      label="Last Updated"
                      value={`${new Date(latestReading.timestamp).toLocaleTimeString()} (${freshness.status === FRESHNESS.RECENT ? 'Recent' : 'Stale'})`}
                    />
                  );
                })()}
              </>
            )}
          </ThemedCard>

          {/* Timeline */}
          <Text style={styles.sectionTitle}>Timeline</Text>
          <ThemedCard variant="outlined" style={styles.card}>
            {loadingEvents ? (
              <ActivityIndicator color={colors.primary} />
            ) : events.length === 0 ? (
              <Text style={styles.emptyText}>No events recorded yet.</Text>
            ) : (
              events.map((e) => (
                <View key={e._id} style={styles.timelineRow}>
                  <Text style={styles.timelineLabel}>{EVENT_LABELS[e.eventType] || e.eventType}</Text>
                  <Text style={styles.timelineTime}>{new Date(e.timestamp).toLocaleString()}</Text>
                </View>
              ))
            )}
          </ThemedCard>

          {/* Actions — same legal-transition rules as DriverAssignedExports.js */}
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionsSection}>
            {actionLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : job.status === 'ASSIGNED' ? (
              showRejectBox ? (
                <View style={styles.rejectBox}>
                  <TextInput
                    style={styles.reasonInput}
                    placeholder="Reason for rejecting (required)"
                    value={rejectReason}
                    onChangeText={setRejectReason}
                    multiline
                  />
                  <View style={styles.actionsRow}>
                    <ThemedButton title="Cancel" variant="outline" size="small" onPress={() => setShowRejectBox(false)} style={styles.actionBtn} />
                    <ThemedButton
                      title="Confirm Reject"
                      variant="danger"
                      size="small"
                      onPress={handleReject}
                      disabled={!rejectReason.trim()}
                      style={styles.actionBtn}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.actionsRow}>
                  <ThemedButton title="Accept" variant="success" onPress={handleAccept} style={styles.actionBtn} />
                  <ThemedButton title="Reject" variant="danger" onPress={() => setShowRejectBox(true)} style={styles.actionBtn} />
                </View>
              )
            ) : job.status === 'ACCEPTED' ? (
              <ThemedButton title="Start Delivery" variant="primary" fullWidth onPress={handleStart} />
            ) : job.status === 'IN_TRANSIT' ? (
              <ThemedButton title="Complete Delivery" variant="success" fullWidth onPress={handleComplete} />
            ) : job.status === 'COMPLETED' ? (
              <Text style={styles.completedText}>Completed ✓</Text>
            ) : (
              <Text style={styles.emptyText}>No action available for this job.</Text>
            )}
          </View>

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </View>

      {showReroute && (
        <Modal visible animationType="slide" onRequestClose={() => setShowReroute(false)}>
          <DriverRerouteScreen
            exportId={job._id}
            onBack={() => {
              setShowReroute(false);
              // Refresh the banner's status after acknowledging/reporting.
              (async () => {
                try {
                  const res = await api.get(`/api/driver/export/${job._id}/reroute`);
                  setReroute(res.data);
                } catch {
                  // leave previous state
                }
              })();
            }}
          />
        </Modal>
      )}
    </Modal>
  );
};

export default DriverJobDetailsModal;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    paddingTop: spacing.xl,
    backgroundColor: colors.primary,
  },
  closeText: { fontSize: 20, color: colors.text.light, fontWeight: 'bold' },
  headerTitle: { ...typography.h4, color: colors.text.light, flex: 1, textAlign: 'center', marginHorizontal: spacing.sm },
  scroll: { flex: 1, padding: spacing.md },
  sectionTitle: { ...typography.bodyMedium, color: colors.text.primary, marginTop: spacing.md, marginBottom: spacing.xs },
  card: { marginBottom: spacing.sm },
  rerouteBanner: {
    backgroundColor: colors.errorBg || 'rgba(220,53,69,0.1)',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 12,
    padding: spacing.sm + 4,
    marginBottom: spacing.md,
  },
  rerouteBannerIssue: {
    backgroundColor: colors.warningBg || 'rgba(245,158,11,0.1)',
    borderColor: colors.warning,
  },
  rerouteBannerTitle: { ...typography.body, fontWeight: '700', color: colors.text.primary },
  rerouteBannerHint: { ...typography.caption, color: colors.text.muted, marginTop: 4 },
  conditionBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.sm + 4,
    marginBottom: spacing.sm,
  },
  conditionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conditionStatusText: {
    fontSize: 15,
    fontWeight: '700',
  },
  conditionRiskText: {
    fontSize: 12,
    fontWeight: '700',
  },
  conditionReasonText: {
    marginTop: 6,
    fontSize: 13,
    color: colors.text?.secondary || '#444',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border.light },
  rowLabel: { ...typography.bodySmall, color: colors.text.muted },
  rowValue: { ...typography.bodySmall, color: colors.text.primary, flex: 1, textAlign: 'right', marginLeft: spacing.md },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: { flex: 1 },
  actionsSection: { marginTop: spacing.sm },
  rejectBox: { gap: spacing.sm },
  reasonInput: {
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 70,
    textAlignVertical: 'top',
    ...typography.body,
  },
  emptyText: { ...typography.bodySmall, color: colors.text.muted, fontStyle: 'italic' },
  completedText: { ...typography.h4, color: colors.success, textAlign: 'center' },
  timelineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  timelineLabel: { ...typography.bodySmall, color: colors.text.primary },
  timelineTime: { ...typography.caption, color: colors.text.muted },
});
