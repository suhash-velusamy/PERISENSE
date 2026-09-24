/**
 * VendorHomePlaceHolder.js
 * Vendor operational dashboard — real shipment counts, active operations,
 * an attention section, and a notifications preview. Every number here
 * comes from GET /api/vendor/exports/:vendorId; nothing is invented.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  AnimatedCounter,
  PulseView,
} from '../../components/AnimatedComponents';
import MonitorHealthView from './vendorHomeComponents/monitorHealthView';
import ExportLocationView from './vendorHomeComponents/exportLocationView';

// ═══════════════════════════════════════════════════════════════════
// STAT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════
const StatCard = ({ icon, value, label, color, delay = 0 }) => (
  <SlideInView delay={delay} style={styles.statCard}>
    <View style={[styles.statIconBg, { backgroundColor: color + '15' }]}>
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
// ACTIVE SHIPMENT CARD
// ═══════════════════════════════════════════════════════════════════
const ActiveShipmentCard = ({ item, onPress, onMonitor, onViewLocation, isExpanded }) => {
  const statusColor = getStatusColor(item.status);
  const statusBg = getStatusBgColor(item.status);

  return (
    <ThemedCard variant="elevated" style={styles.exportCard} onPress={onPress}>
      <View style={styles.exportHeader}>
        <View style={styles.exportTitleSection}>
          <Text style={styles.exportTitle} numberOfLines={1}>📦 {item.itemName}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
          </View>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Driver</Text>
          <Text style={styles.summaryValue} numberOfLines={1}>{item.driver?.name || 'N/A'}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Vehicle</Text>
          <Text style={styles.summaryValue} numberOfLines={1}>{item.vehicle?.vehicleNumber || 'N/A'}</Text>
        </View>
      </View>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Destination</Text>
          <Text style={styles.summaryValue} numberOfLines={1}>
            {item.endLocation ? `${item.endLocation.latitude.toFixed(3)}, ${item.endLocation.longitude.toFixed(3)}` : 'N/A'}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Expected Drop</Text>
          <Text style={styles.summaryValue} numberOfLines={1}>
            {item.expectedDropTime ? new Date(item.expectedDropTime).toLocaleString() : 'Not set'}
          </Text>
        </View>
      </View>

      {isExpanded && (
        <FadeInView style={styles.expandedSection}>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary + '15' }]}
              onPress={onMonitor}
            >
              <Text style={styles.actionBtnIcon}>📊</Text>
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>IoT Data</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.accent + '15' }]}
              onPress={onViewLocation}
            >
              <Text style={styles.actionBtnIcon}>📍</Text>
              <Text style={[styles.actionBtnText, { color: colors.accent }]}>Live Location</Text>
            </TouchableOpacity>
          </View>
        </FadeInView>
      )}

      <View style={styles.expandIndicator}>
        <Text style={styles.expandIcon}>{isExpanded ? '▲' : '▼'}</Text>
      </View>
    </ThemedCard>
  );
};

// ═══════════════════════════════════════════════════════════════════
// ATTENTION ITEM
// ═══════════════════════════════════════════════════════════════════
const AttentionItem = ({ icon, text, color }) => (
  <View style={styles.attentionItem}>
    <Text style={[styles.attentionIcon, { color }]}>{icon}</Text>
    <Text style={styles.attentionText}>{text}</Text>
  </View>
);

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
const VendorHomePlaceHolder = ({ onChatWithDriver }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [activeView, setActiveView] = useState('main');
  const [selectedExport, setSelectedExport] = useState(null);
  const [vendorName, setVendorName] = useState('Vendor');
  const [allExports, setAllExports] = useState([]);
  const [attentionItems, setAttentionItems] = useState([]);
  const [attentionLoading, setAttentionLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const counts = {
    total: allExports.length,
    ASSIGNED: allExports.filter((e) => e.status === 'ASSIGNED').length,
    ACCEPTED: allExports.filter((e) => e.status === 'ACCEPTED').length,
    IN_TRANSIT: allExports.filter((e) => e.status === 'IN_TRANSIT').length,
    COMPLETED: allExports.filter((e) => e.status === 'COMPLETED').length,
    REJECTED: allExports.filter((e) => e.status === 'REJECTED').length,
    CANCELLED: allExports.filter((e) => e.status === 'CANCELLED').length,
  };
  const activeShipments = allExports.filter((e) => e.status === 'IN_TRANSIT');

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/api/user/notifications');
      const data = res.data || [];
      setNotifications(data.slice(0, 5));
      setUnreadCount(data.filter((n) => !n.read).length);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, []);

  const fetchAttention = useCallback(async (inTransit) => {
    setAttentionLoading(true);
    const items = [];

    // Real, already-known facts — no extra network calls needed.
    allExports
      .filter((e) => e.status === 'REJECTED')
      .forEach((e) => {
        items.push({
          key: `rejected-${e._id}`,
          icon: '🚫',
          color: colors.error,
          text: `Driver rejected "${e.itemName}"${e.rejectionReason ? `: ${e.rejectionReason}` : ''}`,
        });
      });

    inTransit
      .filter((e) => !e.device)
      .forEach((e) => {
        items.push({
          key: `noiot-${e._id}`,
          icon: '📡',
          color: colors.warning,
          text: `IoT data unavailable for "${e.itemName}" — no device linked`,
        });
      });

    // Location availability for active shipments — bounded to the actual
    // in-transit set (typically small), not a blanket background scan.
    const withDevice = inTransit.filter((e) => e.device);
    await Promise.all(
      withDevice.map(async (e) => {
        try {
          const res = await api.get(`/api/vendor/device/location-data/${e._id}`);
          if (!res.data || res.data.length === 0) {
            items.push({
              key: `noloc-${e._id}`,
              icon: '📍',
              color: colors.warning,
              text: `Location unavailable for "${e.itemName}"`,
            });
          }
        } catch (err) {
          items.push({
            key: `locerr-${e._id}`,
            icon: '📍',
            color: colors.warning,
            text: `Location unavailable for "${e.itemName}"`,
          });
        }
      })
    );

    setAttentionItems(items);
    setAttentionLoading(false);
  }, [allExports]);

  const fetchExports = useCallback(async () => {
    try {
      setError(null);
      const vendorId = await AsyncStorage.getItem('userId');
      const name = await AsyncStorage.getItem('userName');
      if (name) setVendorName(name);

      const res = await api.get(`/api/vendor/exports/${vendorId}`);
      const data = res.data || [];
      setAllExports(data);
    } catch (error) {
      console.error('Failed to fetch export data:', error);
      setError('Unable to load dashboard. Try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchExports();
    fetchNotifications();
  }, [fetchExports, fetchNotifications]);

  useEffect(() => {
    if (!loading) {
      fetchAttention(allExports.filter((e) => e.status === 'IN_TRANSIT'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, allExports]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchExports();
    fetchNotifications();
  };

  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const handleMonitorHealth = (exp) => {
    setSelectedExport(exp);
    setActiveView('monitor');
  };

  const handleViewLocation = (exp) => {
    setSelectedExport(exp);
    setActiveView('location');
  };

  const handleBack = () => {
    setSelectedExport(null);
    setActiveView('main');
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Sub-views
  if (activeView === 'monitor' && selectedExport) {
    return <MonitorHealthView selectedExport={selectedExport} onBack={handleBack} />;
  }
  if (activeView === 'location' && selectedExport) {
    return <ExportLocationView selectedExport={selectedExport} onBack={handleBack} />;
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <PulseView>
          <View style={styles.loadingIcon}>
            <Text style={styles.loadingEmoji}>🏪</Text>
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
        <ThemedButton title="Retry" variant="primary" onPress={fetchExports} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* Welcome Header */}
        <FadeInView>
          <LinearGradient
            colors={gradients.forest}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.welcomeName}>{vendorName} 👋</Text>
            <Text style={styles.headerSubtext}>
              {counts.total === 0 ? "You haven't created any shipments yet" : "Here's your operations overview"}
            </Text>
          </LinearGradient>
        </FadeInView>

        {/* Shipment Summary — every canonical status, real counts */}
        <View style={styles.statsGrid}>
          <StatCard icon="📦" value={counts.total} label="Total" color={colors.primary} delay={0} />
          <StatCard icon="📝" value={counts.ASSIGNED} label="Assigned" color={colors.warning} delay={50} />
          <StatCard icon="👍" value={counts.ACCEPTED} label="Accepted" color={colors.info} delay={100} />
          <StatCard icon="🚚" value={counts.IN_TRANSIT} label="In Transit" color={colors.tertiary} delay={150} />
          <StatCard icon="✅" value={counts.COMPLETED} label="Completed" color={colors.success} delay={200} />
          <StatCard icon="🚫" value={counts.REJECTED} label="Rejected" color={colors.error} delay={250} />
          <StatCard icon="⛔" value={counts.CANCELLED} label="Cancelled" color={colors.text.muted} delay={300} />
        </View>

        {/* Needs Attention */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Needs Attention</Text>
          <ThemedCard variant="outlined" style={styles.attentionCard}>
            {attentionLoading ? (
              <Text style={styles.attentionLoadingText}>Checking active shipments...</Text>
            ) : attentionItems.length === 0 ? (
              <Text style={styles.noIssuesText}>No active issues.</Text>
            ) : (
              attentionItems.map((it) => (
                <AttentionItem key={it.key} icon={it.icon} text={it.text} color={it.color} />
              ))
            )}
          </ThemedCard>
        </View>

        {/* Recent Notifications */}
        {notifications.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🔔 Recent Notifications</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount} unread</Text>
                </View>
              )}
            </View>
            <ThemedCard variant="outlined" style={styles.attentionCard}>
              {notifications.map((n) => (
                <View key={n._id} style={styles.notifRow}>
                  <View style={[styles.notifDot, !n.read && styles.notifDotUnread]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifTitle}>{n.title}</Text>
                    <Text style={styles.notifMessage} numberOfLines={2}>{n.message}</Text>
                  </View>
                </View>
              ))}
            </ThemedCard>
          </View>
        )}

        {/* Active Operations */}
        <View style={styles.exportsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🚚 Active Operations</Text>
            <Text style={styles.exportCount}>{activeShipments.length} in transit</Text>
          </View>

          {activeShipments.length === 0 ? (
            <FadeInView>
              <ThemedCard variant="outlined" style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyTitle}>No Active Shipments</Text>
                <Text style={styles.emptySubtext}>
                  Shipments currently in transit will appear here.
                </Text>
              </ThemedCard>
            </FadeInView>
          ) : (
            activeShipments.map((item, index) => (
              <SlideInView key={item._id} delay={index * 80}>
                <ActiveShipmentCard
                  item={item}
                  isExpanded={expandedIndex === index}
                  onPress={() => toggleExpand(index)}
                  onMonitor={() => handleMonitorHealth(item)}
                  onViewLocation={() => handleViewLocation(item)}
                />
              </SlideInView>
            ))
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  loadingEmoji: {
    fontSize: 40,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: 'center',
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  greeting: {
    ...typography.bodySmall,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  welcomeName: {
    ...typography.h1,
    color: colors.text.light,
    marginTop: spacing.xs,
  },
  headerSubtext: {
    ...typography.body,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: spacing.sm,
    marginTop: -spacing.xl,
  },
  statCard: {
    width: '31%',
    margin: '1.16%',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    alignItems: 'center',
    ...shadows.sm,
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statIcon: {
    fontSize: 16,
  },
  statValue: {
    ...typography.h4,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.xxs,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
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
  },
  attentionCard: {
    padding: spacing.md,
  },
  attentionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
  },
  attentionIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  attentionText: {
    ...typography.bodySmall,
    color: colors.text.primary,
    flex: 1,
  },
  attentionLoadingText: {
    ...typography.bodySmall,
    color: colors.text.muted,
    fontStyle: 'italic',
  },
  noIssuesText: {
    ...typography.body,
    color: colors.success,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.round,
  },
  unreadBadgeText: {
    ...typography.caption,
    color: colors.text.light,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
  },
  notifDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border.light,
    marginRight: spacing.sm,
    marginTop: 6,
  },
  notifDotUnread: {
    backgroundColor: colors.primary,
  },
  notifTitle: {
    ...typography.bodySmallMedium,
    color: colors.text.primary,
  },
  notifMessage: {
    ...typography.caption,
    color: colors.text.muted,
  },
  exportsSection: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  exportCount: {
    ...typography.caption,
    color: colors.text.muted,
  },
  exportCard: {
    marginBottom: spacing.md,
  },
  exportHeader: {
    marginBottom: spacing.md,
  },
  exportTitleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exportTitle: {
    ...typography.h4,
    color: colors.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  statusText: {
    ...typography.captionMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },
  summaryValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginTop: 2,
  },
  expandedSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
  },
  actionBtnIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  actionBtnText: {
    ...typography.buttonSmall,
  },
  expandIndicator: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  expandIcon: {
    color: colors.text.muted,
    fontSize: 12,
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
  },
  bottomPadding: {
    height: spacing.xxl,
  },
});

export default VendorHomePlaceHolder;
