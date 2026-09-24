/**
 * DriverProfile.js
 * Enhanced driver profile with stats, earnings, and work history
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Animated,
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
} from '../../theme';
import ThemedCard from '../../components/ThemedCard';
import {
  SlideInView,
  FadeInView,
  AnimatedCounter,
  AnimatedProgressBar,
} from '../../components/AnimatedComponents';

// ═══════════════════════════════════════════════════════════════════
// STAT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════
const StatCard = ({ icon, value, label, color, bgColor, delay = 0 }) => (
  <SlideInView delay={delay} style={[styles.statCard, { backgroundColor: bgColor }]}>
    <View style={styles.statIconContainer}>
      <Text style={styles.statIcon}>{icon}</Text>
    </View>
    <AnimatedCounter
      value={value}
      duration={1200}
      style={[styles.statValue, { color }]}
    />
    <Text style={styles.statLabel}>{label}</Text>
  </SlideInView>
);

// ═══════════════════════════════════════════════════════════════════
// INFO ROW COMPONENT
// ═══════════════════════════════════════════════════════════════════
const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoIcon}>{icon}</Text>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || 'N/A'}</Text>
    </View>
  </View>
);

// ═══════════════════════════════════════════════════════════════════
// RECENT DELIVERY CARD
// ═══════════════════════════════════════════════════════════════════
const DeliveryHistoryItem = ({ item, index }) => {
  const statusColor = getStatusColor(item.status);

  return (
    <SlideInView delay={index * 80} style={styles.deliveryItem}>
      <View style={styles.deliveryLeft}>
        <View style={[styles.deliveryIcon, { backgroundColor: statusColor + '15' }]}>
          <Text style={styles.deliveryEmoji}>📦</Text>
        </View>
        <View style={styles.deliveryInfo}>
          <Text style={styles.deliveryName} numberOfLines={1}>
            {item.itemName}
          </Text>
          <Text style={styles.deliveryVendor}>
            {item.vendorId?.name || 'Vendor'}
          </Text>
        </View>
      </View>
      <View style={styles.deliveryRight}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {item.status === 'COMPLETED' ? '✓ Done' : item.status}
          </Text>
        </View>
        <Text style={styles.deliveryDate}>
          {new Date(item.endDate || item.startDate).toLocaleDateString()}
        </Text>
      </View>
    </SlideInView>
  );
};

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
const DriverProfile = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [driver, setDriver] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    rating: 4.8,
  });
  const [recentExports, setRecentExports] = useState([]);

  const fetchDriverData = useCallback(async () => {
    try {
      const driverId = await AsyncStorage.getItem('userId');
      if (!driverId) return;

      const [profileRes, exportsRes] = await Promise.all([
        api.get(`/api/driver/profile/${driverId}`).catch(() => null),
        api.get(`/api/driver/export/driver/${driverId}`).catch(() => null),
      ]);

      if (profileRes?.data) {
        setDriver(profileRes.data);
      }

      if (exportsRes?.data) {
        const exports = exportsRes.data || [];

        setStats({
          total: exports.length,
          completed: exports.filter((e) => e.status === 'COMPLETED').length,
          inProgress: exports.filter((e) => e.status === 'IN_TRANSIT').length,
          pending: exports.filter((e) => e.status === 'ACCEPTED').length,
          rating: 4.8,
        });

        setRecentExports(
          exports
            .filter((e) => e.status === 'COMPLETED')
            .sort((a, b) => new Date(b.endDate) - new Date(a.endDate))
            .slice(0, 5)
        );
      }
    } catch (err) {
      console.error('Error fetching driver data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDriverData();
  }, [fetchDriverData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDriverData();
  };

  const getInitials = (name) => {
    return name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'D';
  };

  const getCompletionRate = () => {
    if (stats.total === 0) return 0;
    return Math.round((stats.completed / stats.total) * 100);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.primary]}
        />
      }
    >
      {/* Profile Header */}
      <FadeInView>
        <LinearGradient
          colors={gradients.forest}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(driver?.name)}</Text>
            </View>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingIcon}>⭐</Text>
              <Text style={styles.ratingText}>{stats.rating}</Text>
            </View>
          </View>
          <Text style={styles.userName}>{driver?.name || 'Driver'}</Text>
          <Text style={styles.userEmail}>{driver?.email}</Text>

          {/* Active Badge */}
          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>Active Driver</Text>
          </View>
        </LinearGradient>
      </FadeInView>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <StatCard
          icon="📦"
          value={stats.total}
          label="Total Jobs"
          color={colors.primary}
          bgColor="#E0F2FE"
          delay={0}
        />
        <StatCard
          icon="✅"
          value={stats.completed}
          label="Completed"
          color={colors.success}
          bgColor="#D1FAE5"
          delay={100}
        />
        <StatCard
          icon="🚚"
          value={stats.inProgress}
          label="In Progress"
          color={colors.tertiary}
          bgColor="#FEF3C7"
          delay={200}
        />
        <StatCard
          icon="⏳"
          value={stats.pending}
          label="Pending"
          color={colors.error}
          bgColor="#FEE2E2"
          delay={300}
        />
      </View>

      {/* Completion Rate Card */}
      <FadeInView delay={200}>
        <ThemedCard variant="elevated" style={styles.rateCard}>
          <View style={styles.rateHeader}>
            <Text style={styles.rateTitle}>Completion Rate</Text>
            <Text style={styles.ratePercent}>{getCompletionRate()}%</Text>
          </View>
          <AnimatedProgressBar
            progress={getCompletionRate()}
            color={colors.success}
            height={10}
          />
          <Text style={styles.rateSubtext}>
            {stats.completed} of {stats.total} deliveries completed
          </Text>
        </ThemedCard>
      </FadeInView>

      {/* Driver Information */}
      <FadeInView delay={300}>
        <ThemedCard variant="elevated" style={styles.infoCard}>
          <Text style={styles.cardTitle}>🚚 Driver Information</Text>
          <InfoRow icon="📱" label="Phone" value={driver?.mobileNo} />
          <InfoRow icon="🪪" label="License No" value={driver?.licenseNo} />
          <InfoRow icon="📍" label="State" value={driver?.state} />
          <InfoRow icon="🏙️" label="District" value={driver?.district} />
        </ThemedCard>
      </FadeInView>

      {/* Recent Deliveries */}
      <FadeInView delay={400}>
        <ThemedCard variant="elevated" style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <Text style={styles.cardTitle}>📋 Recent Deliveries</Text>
            {recentExports.length > 0 && (
              <TouchableOpacity>
                <Text style={styles.seeAllLink}>See All</Text>
              </TouchableOpacity>
            )}
          </View>

          {recentExports.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No completed deliveries yet</Text>
            </View>
          ) : (
            recentExports.map((item, index) => (
              <DeliveryHistoryItem
                key={item._id || index}
                item={item}
                index={index}
              />
            ))
          )}
        </ThemedCard>
      </FadeInView>

      <View style={styles.bottomPadding} />
    </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.text.muted,
    marginTop: spacing.md,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.text.light,
  },
  ratingBadge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    borderWidth: 2,
    borderColor: '#fff',
  },
  ratingIcon: {
    fontSize: 12,
    marginRight: 2,
  },
  ratingText: {
    ...typography.captionMedium,
    color: colors.text.dark,
  },
  userName: {
    ...typography.h2,
    color: colors.text.light,
    marginBottom: spacing.xs,
  },
  userEmail: {
    ...typography.bodySmall,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: spacing.md,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.round,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: spacing.sm,
  },
  activeText: {
    ...typography.captionMedium,
    color: colors.text.light,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: spacing.sm,
    marginTop: -spacing.xl,
  },
  statCard: {
    width: '48%',
    margin: '1%',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  statIconContainer: {
    marginBottom: spacing.xs,
  },
  statIcon: {
    fontSize: 24,
  },
  statValue: {
    ...typography.stat,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.xxs,
  },
  rateCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  rateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  rateTitle: {
    ...typography.h4,
    color: colors.text.primary,
  },
  ratePercent: {
    ...typography.h3,
    color: colors.success,
  },
  rateSubtext: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  infoCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  cardTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  infoIcon: {
    fontSize: 18,
    marginRight: spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },
  infoValue: {
    ...typography.body,
    color: colors.text.primary,
    marginTop: 2,
  },
  historyCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  seeAllLink: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  deliveryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  deliveryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deliveryIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  deliveryEmoji: {
    fontSize: 18,
  },
  deliveryInfo: {
    flex: 1,
  },
  deliveryName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  deliveryVendor: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  deliveryRight: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.round,
    marginBottom: spacing.xxs,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  deliveryDate: {
    ...typography.caption,
    color: colors.text.muted,
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.muted,
  },
  bottomPadding: {
    height: spacing.xxl,
  },
});

export default DriverProfile;
