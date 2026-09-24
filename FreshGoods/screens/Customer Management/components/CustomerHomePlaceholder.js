/**
 * CustomerDashboard.js (formerly CustomerHomePlaceholder.js)
 * Customer home screen — shows the authenticated customer's own active
 * shipments, recent shipment history, and recent notifications. Every
 * section is backed by a real endpoint; nothing here is fabricated, and a
 * failed fetch surfaces an error state instead of falling back to mock data
 * (Stage 8 Phase 1).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
} from '../../components/AnimatedComponents';
import LocationPickerModal from './LocationPickerModal';

const ACTIVE_STATUSES = ['ASSIGNED', 'ACCEPTED', 'IN_TRANSIT'];
const RECENT_STATUSES = ['COMPLETED', 'CANCELLED', 'REJECTED'];

// ═══════════════════════════════════════════════════════════════════
// ACTIVE SHIPMENT CARD
// ═══════════════════════════════════════════════════════════════════
const ActiveShipmentCard = ({ item, onPress, delay = 0 }) => {
  const statusColor = getStatusColor(item.status);
  const statusBg = getStatusBgColor(item.status);
  const destination = item.routes?.length ? item.routes[item.routes.length - 1] : 'Destination pending';

  return (
    <SlideInView delay={delay}>
      <TouchableOpacity onPress={() => onPress(item)} activeOpacity={0.85}>
        <ThemedCard variant="elevated" style={styles.deliveryCard}>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
          </View>

          <View style={styles.deliveryHeader}>
            <View style={styles.productIcon}>
              <Text style={styles.productEmoji}>📦</Text>
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={1}>
                {item.itemName || 'Shipment'}
              </Text>
              <Text style={styles.vendorName} numberOfLines={1}>
                🏪 {item.vendorId?.name || 'Vendor'} · {item.quantity ?? '-'} {item.unit || ''}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText} numberOfLines={1}>📍 {destination}</Text>
          </View>
          {item.expectedDropTime && (
            <Text style={styles.metaText}>
              🕒 Expected: {new Date(item.expectedDropTime).toLocaleString()}
            </Text>
          )}
        </ThemedCard>
      </TouchableOpacity>
    </SlideInView>
  );
};

// ═══════════════════════════════════════════════════════════════════
// RECENT SHIPMENT ROW
// ═══════════════════════════════════════════════════════════════════
const RecentShipmentRow = ({ item, onPress }) => {
  const statusColor = getStatusColor(item.status);
  const statusBg = getStatusBgColor(item.status);
  return (
    <TouchableOpacity onPress={() => onPress(item)} activeOpacity={0.85} style={styles.recentRow}>
      <View style={styles.recentInfo}>
        <Text style={styles.recentName} numberOfLines={1}>{item.itemName || 'Shipment'}</Text>
        <Text style={styles.recentVendor} numberOfLines={1}>{item.vendorId?.name || 'Vendor'}</Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
        <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
      </View>
    </TouchableOpacity>
  );
};

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATION PREVIEW ROW
// ═══════════════════════════════════════════════════════════════════
const NotificationRow = ({ item, onPress }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.notifRow}>
    {!item.read && <View style={styles.unreadDot} />}
    <View style={styles.notifTextWrap}>
      <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.notifMessage} numberOfLines={1}>{item.message}</Text>
    </View>
  </TouchableOpacity>
);

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
const CustomerDashboard = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [profile, setProfile] = useState(null);

  const [shipments, setShipments] = useState([]);
  const [shipmentsError, setShipmentsError] = useState(null);

  const [notifications, setNotifications] = useState([]);
  const [notificationsError, setNotificationsError] = useState(null);

  // Preferred Location — optional prompt, dismissible for this session only
  // (never persisted as "never ask again"; the customer can still set it
  // any time from Profile). Never blocks any other part of the dashboard.
  const [locationPromptDismissed, setLocationPromptDismissed] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  const fetchAll = useCallback(async () => {
    const userId = await AsyncStorage.getItem('userId');

    const results = await Promise.allSettled([
      userId ? api.get(`/api/customer/profile/${userId}`) : Promise.reject(new Error('Not logged in')),
      api.get('/api/customer/my-shipments'),
      api.get('/api/user/notifications'),
    ]);

    const [profileRes, shipmentsRes, notificationsRes] = results;

    if (profileRes.status === 'fulfilled') {
      setProfile(profileRes.value.data);
    }

    if (shipmentsRes.status === 'fulfilled') {
      setShipments(shipmentsRes.value.data || []);
      setShipmentsError(null);
    } else {
      setShipmentsError('Unable to load your shipments. Try again.');
    }

    if (notificationsRes.status === 'fulfilled') {
      setNotifications(notificationsRes.value.data || []);
      setNotificationsError(null);
    } else {
      setNotificationsError('Unable to load notifications.');
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, [fetchAll]);

  const handleOpenShipment = (item) => {
    onNavigate?.('shipmentDetails', { exportId: item._id, exportData: item });
  };

  const handleSaveLocation = async (latitude, longitude) => {
    setSavingLocation(true);
    try {
      await api.put('/api/customer/location', { latitude, longitude });
      setProfile((prev) => ({
        ...prev,
        location: { type: 'Point', coordinates: [longitude, latitude] },
        locationUpdatedAt: new Date().toISOString(),
      }));
      setLocationModalVisible(false);
    } catch (err) {
      console.error('Failed to save preferred location:', err);
    } finally {
      setSavingLocation(false);
    }
  };

  const hasPreferredLocation = Array.isArray(profile?.location?.coordinates)
    && profile.location.coordinates.length === 2;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  const activeShipments = shipments.filter((s) => ACTIVE_STATUSES.includes(s.status));
  const recentShipments = shipments
    .filter((s) => RECENT_STATUSES.includes(s.status))
    .slice(0, 5);
  const recentNotifications = notifications.slice(0, 5);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Welcome Section */}
        <FadeInView duration={500}>
          <LinearGradient
            colors={gradients.forest}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.welcomeSection}
          >
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>{profile?.name || 'Customer'} 👋</Text>
            {(profile?.district || profile?.state) && (
              <View style={styles.locationBadge}>
                <Text style={styles.locationIcon}>📍</Text>
                <Text style={styles.locationText}>
                  {[profile?.district, profile?.state].filter(Boolean).join(', ')}
                </Text>
              </View>
            )}
          </LinearGradient>
        </FadeInView>

        {/* Optional Preferred Location prompt — never blocks anything else */}
        {!hasPreferredLocation && !locationPromptDismissed && (
          <FadeInView delay={100} style={styles.section}>
            <ThemedCard variant="outlined" style={styles.locationPromptCard}>
              <View style={styles.locationPromptHeader}>
                <Text style={styles.locationPromptIcon}>📍</Text>
                <View style={styles.locationPromptTextWrap}>
                  <Text style={styles.locationPromptTitle}>Set your preferred delivery location</Text>
                  <Text style={styles.locationPromptSubtitle}>
                    Optional — helps vendors and rescue sales find you. You can skip this for now.
                  </Text>
                </View>
              </View>
              <View style={styles.locationPromptActions}>
                <ThemedButton
                  title="Set Location"
                  variant="primary"
                  size="small"
                  onPress={() => setLocationModalVisible(true)}
                  style={{ flex: 1, marginRight: spacing.sm }}
                />
                <ThemedButton
                  title="Skip for now"
                  variant="ghost"
                  size="small"
                  onPress={() => setLocationPromptDismissed(true)}
                  style={{ flex: 1 }}
                />
              </View>
            </ThemedCard>
          </FadeInView>
        )}

        {/* My Active Shipments */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🚚 My Active Shipments</Text>
            {activeShipments.length > 0 && (
              <TouchableOpacity onPress={() => onNavigate?.('myShipments')}>
                <Text style={styles.seeAllLink}>See All</Text>
              </TouchableOpacity>
            )}
          </View>

          {shipmentsError ? (
            <ThemedCard variant="outlined" style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>⚠️</Text>
              <Text style={styles.emptySubtext}>{shipmentsError}</Text>
              <TouchableOpacity style={styles.browseButton} onPress={onRefresh}>
                <Text style={styles.browseButtonText}>Retry</Text>
              </TouchableOpacity>
            </ThemedCard>
          ) : activeShipments.length > 0 ? (
            activeShipments
              .slice(0, 5)
              .map((item, index) => (
                <ActiveShipmentCard key={item._id} item={item} onPress={handleOpenShipment} delay={index * 80} />
              ))
          ) : (
            <FadeInView delay={200}>
              <ThemedCard variant="outlined" style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyTitle}>No active shipments.</Text>
                <TouchableOpacity style={styles.browseButton} onPress={() => onNavigate?.('viewGoods')}>
                  <Text style={styles.browseButtonText}>Browse Available Goods</Text>
                </TouchableOpacity>
              </ThemedCard>
            </FadeInView>
          )}
        </View>

        {/* Recent Shipments */}
        {!shipmentsError && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🕘 Recent Shipments</Text>
            {recentShipments.length > 0 ? (
              <ThemedCard variant="elevated" style={styles.recentCard}>
                {recentShipments.map((item, index) => (
                  <View key={item._id}>
                    <RecentShipmentRow item={item} onPress={handleOpenShipment} />
                    {index < recentShipments.length - 1 && <View style={styles.rowDivider} />}
                  </View>
                ))}
              </ThemedCard>
            ) : (
              <Text style={styles.emptyInlineText}>No recent shipment activity yet.</Text>
            )}
          </View>
        )}

        {/* Notifications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🔔 Notifications</Text>
            {notifications.length > 0 && (
              <TouchableOpacity onPress={() => onNavigate?.('notifications')}>
                <Text style={styles.seeAllLink}>See All</Text>
              </TouchableOpacity>
            )}
          </View>

          {notificationsError ? (
            <Text style={styles.emptyInlineText}>{notificationsError}</Text>
          ) : recentNotifications.length > 0 ? (
            <ThemedCard variant="elevated" style={styles.recentCard}>
              {recentNotifications.map((item, index) => (
                <View key={item._id}>
                  <NotificationRow item={item} onPress={() => onNavigate?.('notifications')} />
                  {index < recentNotifications.length - 1 && <View style={styles.rowDivider} />}
                </View>
              ))}
            </ThemedCard>
          ) : (
            <Text style={styles.emptyInlineText}>No notifications yet.</Text>
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <LocationPickerModal
        visible={locationModalVisible}
        initialCoords={null}
        onClose={() => setLocationModalVisible(false)}
        onConfirm={handleSaveLocation}
        saving={savingLocation}
      />
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.muted,
    marginTop: spacing.md,
  },
  welcomeSection: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  greeting: {
    ...typography.bodySmall,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  userName: {
    ...typography.h1,
    color: colors.text.light,
    marginTop: spacing.xs,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.round,
    alignSelf: 'flex-start',
  },
  locationIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  locationText: {
    ...typography.bodySmall,
    color: colors.text.light,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  locationPromptCard: {
    padding: spacing.md,
  },
  locationPromptHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  locationPromptIcon: {
    fontSize: 22,
    marginRight: spacing.sm,
  },
  locationPromptTextWrap: {
    flex: 1,
  },
  locationPromptTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  locationPromptSubtitle: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  locationPromptActions: {
    flexDirection: 'row',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  seeAllLink: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  deliveryCard: {
    marginBottom: spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    marginBottom: spacing.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  statusText: {
    ...typography.captionMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deliveryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  productIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  productEmoji: {
    fontSize: 22,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    ...typography.h4,
    color: colors.text.primary,
  },
  vendorName: {
    ...typography.bodySmall,
    color: colors.text.muted,
    marginTop: 2,
  },
  metaRow: {
    marginTop: spacing.xs,
  },
  metaText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginTop: 2,
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyInlineText: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  browseButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primaryLight + '20',
    borderRadius: borderRadius.round,
  },
  browseButtonText: {
    ...typography.buttonSmall,
    color: colors.primary,
  },
  recentCard: {
    padding: 0,
    overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  recentInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  recentName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  recentVendor: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.md,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: spacing.sm,
  },
  notifTextWrap: {
    flex: 1,
  },
  notifTitle: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  notifTitleUnread: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  notifMessage: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  bottomPadding: {
    height: spacing.xxl,
  },
});

export default CustomerDashboard;
