/**
 * DriverHomePlaceholder.js
 * Driver operational dashboard — Assigned Jobs, a prominent Current
 * Delivery card, and recent Completed work. Every field comes from
 * GET /api/driver/export/driver/:driverId; nothing is invented.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import {
  colors,
  gradients,
  spacing,
  borderRadius,
  typography,
  shadows,
  getStatusColor,
  getStatusBgColor,
} from '../../theme';
import ThemedCard from '../../components/ThemedCard';
import ThemedButton from '../../components/ThemedButton';
import {
  SlideInView,
  FadeInView,
  PulseView,
} from '../../components/AnimatedComponents';
import { getFreshness, formatMinutesAgo, FRESHNESS } from '../../utils/freshness';
import DriverExportHealth from './placeholdersubcomponents/DriverExportHealth';
import DriverRouteMap from './placeholdersubcomponents/DriverRouteMap';
import DriverJobDetailsModal from './DriverJobDetailsModal';

// ═══════════════════════════════════════════════════════════════════
// ASSIGNED JOB CARD (ASSIGNED / ACCEPTED)
// ═══════════════════════════════════════════════════════════════════
const JobCard = ({ item, onPress }) => {
  const statusColor = getStatusColor(item.status);
  const statusBg = getStatusBgColor(item.status);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <ThemedCard variant="elevated" style={styles.jobCard}>
        <View style={styles.jobCardHeader}>
          <Text style={styles.jobCardTitle} numberOfLines={1}>📦 {item.itemName}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.jobCardLine} numberOfLines={1}>
          {item.quantity} {item.unit || ''} · {item.vendorId?.name || 'Vendor'}
        </Text>
        <Text style={styles.jobCardLine} numberOfLines={1}>
          To: {item.endLocation ? `${item.endLocation.latitude.toFixed(3)}, ${item.endLocation.longitude.toFixed(3)}` : 'N/A'}
        </Text>
        <Text style={styles.jobCardLine} numberOfLines={1}>
          Expected drop: {item.expectedDropTime ? new Date(item.expectedDropTime).toLocaleString() : 'Not set'}
        </Text>
      </ThemedCard>
    </TouchableOpacity>
  );
};

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
const DriverHomePlaceholder = ({ onViewAllJobs, onChatWithVendor }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [driverName, setDriverName] = useState('Driver');
  const [allJobs, setAllJobs] = useState([]);
  const [screen, setScreen] = useState('home'); // 'home' | 'health' | 'route'
  const [detailsItem, setDetailsItem] = useState(null);
  const [endingTrip, setEndingTrip] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [locationStatus, setLocationStatus] = useState(undefined); // undefined = loading

  const currentDelivery = allJobs.find((j) => j.status === 'IN_TRANSIT') || null;
  const assignedJobs = allJobs.filter((j) => j.status === 'ASSIGNED' || j.status === 'ACCEPTED');
  const recentCompleted = allJobs
    .filter((j) => j.status === 'COMPLETED')
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 5);

  const fetchJobs = useCallback(async () => {
    try {
      setError(null);
      const driverId = await AsyncStorage.getItem('userId');
      const name = await AsyncStorage.getItem('userName');
      if (name) setDriverName(name);
      if (!driverId) return;

      const res = await api.get(`/api/driver/export/driver/${driverId}`);
      setAllJobs(res.data || []);
    } catch (err) {
      console.error('Error fetching driver jobs:', err);
      setError('Unable to load your dashboard. Try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Once we know which shipment is IN_TRANSIT, fetch its real start time
  // (from the backend event log, not a guess) and current location status.
  useEffect(() => {
    if (!currentDelivery) {
      setStartedAt(null);
      setLocationStatus(undefined);
      return;
    }
    (async () => {
      try {
        const res = await api.get(`/api/driver/export/${currentDelivery._id}/events`);
        const startEvent = (res.data || []).find((e) => e.eventType === 'DELIVERY_STARTED');
        setStartedAt(startEvent?.timestamp || null);
      } catch (err) {
        setStartedAt(null);
      }
    })();
    (async () => {
      try {
        const res = await api.get(`/api/driver/device/location-data/${currentDelivery._id}`);
        const locations = res.data || [];
        setLocationStatus(locations.length > 0 ? locations[locations.length - 1] : null);
      } catch (err) {
        setLocationStatus(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDelivery?._id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchJobs();
  };

  const handleCompleteCurrent = () => {
    if (!currentDelivery) return;
    Alert.alert(
      '🏁 Complete Delivery',
      'Are you sure you want to mark this delivery as completed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            setEndingTrip(true);
            try {
              await api.put(`/api/driver/export/complete/${currentDelivery._id}`);
              Alert.alert('Success', 'Delivery completed.');
              fetchJobs();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to complete delivery.');
            } finally {
              setEndingTrip(false);
            }
          },
        },
      ]
    );
  };

  const handleCallVendor = () => {
    if (currentDelivery?.vendorId?.mobileNo) {
      Linking.openURL(`tel:${currentDelivery.vendorId.mobileNo}`);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Sub-screens (reuse the existing, working IoT + map components)
  if (screen === 'health' && currentDelivery) {
    return <DriverExportHealth exportId={currentDelivery._id} onBack={() => setScreen('home')} />;
  }
  if (screen === 'route' && currentDelivery) {
    return <DriverRouteMap exportId={currentDelivery._id} onBack={() => setScreen('home')} />;
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <PulseView>
          <View style={styles.loadingIcon}>
            <Text style={styles.loadingEmoji}>🚚</Text>
          </View>
        </PulseView>
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.loadingText}>{error}</Text>
        <ThemedButton title="Retry" variant="primary" onPress={fetchJobs} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        <FadeInView>
          <LinearGradient colors={gradients.forest} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.welcomeCard}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.welcomeName}>{driverName} 👋</Text>
          </LinearGradient>
        </FadeInView>

        {/* CURRENT DELIVERY — the one thing that matters most right now */}
        {currentDelivery ? (
          <SlideInView delay={80}>
            <ThemedCard variant="elevated" style={styles.currentCard}>
              <Text style={styles.currentLabel}>ACTIVE DELIVERY</Text>
              <Text style={styles.currentTitle}>{currentDelivery.itemName}</Text>
              <Text style={styles.currentSubtitle}>{currentDelivery.quantity} {currentDelivery.unit || ''}</Text>

              <View style={styles.currentInfoRow}>
                <Text style={styles.currentInfoLabel}>To</Text>
                <Text style={styles.currentInfoValue} numberOfLines={1}>
                  {currentDelivery.endLocation
                    ? `${currentDelivery.endLocation.latitude.toFixed(4)}, ${currentDelivery.endLocation.longitude.toFixed(4)}`
                    : 'N/A'}
                </Text>
              </View>
              <View style={styles.currentInfoRow}>
                <Text style={styles.currentInfoLabel}>Vehicle</Text>
                <Text style={styles.currentInfoValue}>{currentDelivery.vehicle?.vehicleNumber || 'N/A'}</Text>
              </View>
              {currentDelivery.customer?.name && (
                <View style={styles.currentInfoRow}>
                  <Text style={styles.currentInfoLabel}>Customer</Text>
                  <Text style={styles.currentInfoValue}>{currentDelivery.customer.name}</Text>
                </View>
              )}
              <View style={styles.currentInfoRow}>
                <Text style={styles.currentInfoLabel}>Status</Text>
                <Text style={[styles.currentInfoValue, { color: colors.success, fontWeight: '700' }]}>IN TRANSIT</Text>
              </View>
              <View style={styles.currentInfoRow}>
                <Text style={styles.currentInfoLabel}>Started</Text>
                <Text style={styles.currentInfoValue}>{startedAt ? new Date(startedAt).toLocaleString() : 'Unknown'}</Text>
              </View>
              <View style={styles.currentInfoRow}>
                <Text style={styles.currentInfoLabel}>Expected Drop</Text>
                <Text style={styles.currentInfoValue}>
                  {currentDelivery.expectedDropTime ? new Date(currentDelivery.expectedDropTime).toLocaleString() : 'Not set'}
                </Text>
              </View>
              <View style={styles.currentInfoRow}>
                <Text style={styles.currentInfoLabel}>Location</Text>
                {locationStatus === undefined ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : locationStatus === null ? (
                  <Text style={[styles.currentInfoValue, { color: colors.text.muted, fontStyle: 'italic' }]}>Unavailable</Text>
                ) : (() => {
                  const freshness = getFreshness(locationStatus.timestamp);
                  return (
                    <Text style={[styles.currentInfoValue, { color: freshness.status === FRESHNESS.RECENT ? colors.success : colors.warning }]}>
                      {freshness.status === FRESHNESS.RECENT ? 'Live' : 'Stale'} ({formatMinutesAgo(freshness.minutesAgo)})
                    </Text>
                  );
                })()}
              </View>

              <View style={styles.currentActionsGrid}>
                <ThemedButton title="View Location" variant="outline" size="small" icon="📍" onPress={() => setScreen('route')} style={styles.currentActionBtn} />
                <ThemedButton title="View Details" variant="outline" size="small" icon="ℹ️" onPress={() => setDetailsItem(currentDelivery)} style={styles.currentActionBtn} />
                {currentDelivery.vendorId?.mobileNo && (
                  <ThemedButton title="Call Vendor" variant="outline" size="small" icon="📞" onPress={handleCallVendor} style={styles.currentActionBtn} />
                )}
              </View>
              <ThemedButton
                title={endingTrip ? 'Completing...' : '🏁 Complete Delivery'}
                variant="danger"
                fullWidth
                onPress={handleCompleteCurrent}
                loading={endingTrip}
                style={{ marginTop: spacing.md }}
              />
            </ThemedCard>
          </SlideInView>
        ) : (
          <SlideInView delay={80}>
            <ThemedCard variant="outlined" style={styles.noTripCard}>
              <Text style={styles.noTripIcon}>📭</Text>
              <Text style={styles.noTripTitle}>No active deliveries.</Text>
              <Text style={styles.noTripSubtext}>
                {assignedJobs.length > 0
                  ? `You have ${assignedJobs.length} job${assignedJobs.length === 1 ? '' : 's'} waiting below.`
                  : "You'll see new assignments here as soon as a vendor assigns one."}
              </Text>
            </ThemedCard>
          </SlideInView>
        )}

        {/* ASSIGNED JOBS — needs Accept/Reject/Start */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📋 Assigned Jobs</Text>
            {onViewAllJobs && (
              <TouchableOpacity onPress={onViewAllJobs}>
                <Text style={styles.viewAllLink}>View All</Text>
              </TouchableOpacity>
            )}
          </View>
          {assignedJobs.length === 0 ? (
            <ThemedCard variant="outlined" style={styles.emptyCard}>
              <Text style={styles.emptySubtext}>No jobs waiting on you right now.</Text>
            </ThemedCard>
          ) : (
            assignedJobs.map((item, index) => (
              <SlideInView key={item._id} delay={index * 60}>
                <JobCard item={item} onPress={() => setDetailsItem(item)} />
              </SlideInView>
            ))
          )}
        </View>

        {/* COMPLETED / RECENT */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✅ Recently Completed</Text>
          {recentCompleted.length === 0 ? (
            <ThemedCard variant="outlined" style={styles.emptyCard}>
              <Text style={styles.emptySubtext}>No completed deliveries yet.</Text>
            </ThemedCard>
          ) : (
            recentCompleted.map((item, index) => (
              <SlideInView key={item._id} delay={index * 60}>
                <TouchableOpacity onPress={() => setDetailsItem(item)} activeOpacity={0.8}>
                  <ThemedCard variant="outlined" style={styles.completedCard}>
                    <Text style={styles.completedItemName} numberOfLines={1}>{item.itemName}</Text>
                    <Text style={styles.completedItemSub}>
                      {item.quantity} {item.unit || ''} · Completed {new Date(item.updatedAt).toLocaleDateString()}
                    </Text>
                  </ThemedCard>
                </TouchableOpacity>
              </SlideInView>
            ))
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {detailsItem && (
        <DriverJobDetailsModal
          item={detailsItem}
          onClose={() => setDetailsItem(null)}
          onChanged={fetchJobs}
          onChatWithVendor={onChatWithVendor}
        />
      )}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary, padding: spacing.xl },
  loadingIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryLight + '20', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  loadingEmoji: { fontSize: 40 },
  errorIcon: { fontSize: 48, marginBottom: spacing.md },
  loadingText: { ...typography.body, color: colors.text.muted, textAlign: 'center' },
  welcomeCard: { padding: spacing.lg, margin: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.xl },
  greeting: { ...typography.bodySmall, color: 'rgba(255, 255, 255, 0.8)' },
  welcomeName: { ...typography.h1, color: colors.text.light, marginTop: spacing.xs },

  currentCard: { marginHorizontal: spacing.md, padding: spacing.lg, borderWidth: 2, borderColor: colors.success },
  currentLabel: { ...typography.overline, color: colors.success, fontWeight: '700', letterSpacing: 1 },
  currentTitle: { ...typography.h2, color: colors.text.primary, marginTop: spacing.xs },
  currentSubtitle: { ...typography.body, color: colors.text.muted, marginBottom: spacing.md },
  currentInfoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border.light },
  currentInfoLabel: { ...typography.bodySmall, color: colors.text.muted },
  currentInfoValue: { ...typography.bodySmallMedium, color: colors.text.primary, flex: 1, textAlign: 'right', marginLeft: spacing.md },
  currentActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  currentActionBtn: { flexGrow: 1, minWidth: '30%' },

  noTripCard: { marginHorizontal: spacing.md, padding: spacing.xl, alignItems: 'center' },
  noTripIcon: { fontSize: 48, marginBottom: spacing.sm },
  noTripTitle: { ...typography.h4, color: colors.text.primary, marginBottom: spacing.xs },
  noTripSubtext: { ...typography.body, color: colors.text.muted, textAlign: 'center' },

  section: { paddingHorizontal: spacing.md, marginTop: spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { ...typography.h4, color: colors.text.primary },
  viewAllLink: { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },
  emptyCard: { padding: spacing.lg, alignItems: 'center' },
  emptySubtext: { ...typography.body, color: colors.text.muted, textAlign: 'center' },

  jobCard: { marginBottom: spacing.sm, padding: spacing.md },
  jobCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  jobCardTitle: { ...typography.bodyMedium, color: colors.text.primary, flex: 1, marginRight: spacing.sm },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.round },
  statusText: { ...typography.caption, fontWeight: '700' },
  jobCardLine: { ...typography.bodySmall, color: colors.text.secondary, marginTop: 2 },

  completedCard: { marginBottom: spacing.sm, padding: spacing.md },
  completedItemName: { ...typography.bodyMedium, color: colors.text.primary },
  completedItemSub: { ...typography.caption, color: colors.text.muted, marginTop: 2 },

  bottomPadding: { height: spacing.xxl },
});

export default DriverHomePlaceholder;
