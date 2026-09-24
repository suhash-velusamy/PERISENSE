/**
 * CustomerRescueOpportunities.js
 * Stage 11 — nearby Rescue Sale discovery. Deliberately separate from
 * CustomerViewGoods.js (normal shipment browsing): rescue opportunities are
 * a distinct workflow with their own branding, not folded invisibly into
 * the regular goods list (Phase 12).
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
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
} from '../../theme';
import ThemedCard from '../../components/ThemedCard';
import { getConditionMeta, getRiskLabel } from '../../utils/condition';

const RescueCard = ({ item, onPress }) => {
  const meta = getConditionMeta(item.conditionStatus);
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
      <ThemedCard variant="elevated" style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.badge}>🚨 Fresh Goods Rescue</Text>
          <View style={[styles.riskBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.riskBadgeText, { color: meta.color }]}>{getRiskLabel(item.riskStatus)}</Text>
          </View>
        </View>
        <Text style={styles.itemName}>{item.itemName}</Text>
        <Text style={styles.quantityPrice}>
          {item.availableQuantity} {item.unit} available · ₹{item.price}/{item.unit}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>📍 ~{item.approxDistanceKm} km away</Text>
          <Text style={styles.metaText}>⏰ Until {new Date(item.validUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
        <View style={styles.viewButton}>
          <Text style={styles.viewButtonText}>View Details →</Text>
        </View>
      </ThemedCard>
    </TouchableOpacity>
  );
};

const CustomerRescueOpportunities = ({ onOpen }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sales, setSales] = useState([]);
  const [error, setError] = useState(null);
  const [notEligibleReason, setNotEligibleReason] = useState(null);

  const fetchSales = useCallback(async () => {
    try {
      setError(null);
      setNotEligibleReason(null);
      const customerId = await AsyncStorage.getItem('userId');
      const [salesRes, profileRes] = await Promise.all([
        api.get('/api/customer/rescue-sales'),
        customerId ? api.get(`/api/customer/profile/${customerId}`).catch(() => null) : Promise.resolve(null),
      ]);
      setSales(salesRes.data || []);
      if ((salesRes.data || []).length === 0 && profileRes?.data && !profileRes.data.rescueOptIn) {
        setNotEligibleReason('Enable location access to discover nearby rescue opportunities.');
      }
    } catch (err) {
      console.error('Error fetching rescue sales:', err);
      setError('Unable to load rescue opportunities.');
      setSales([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSales();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading rescue opportunities...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.forest} style={styles.headerBanner}>
        <Text style={styles.headerTitle}>🚨 Rescue Opportunities</Text>
        <Text style={styles.headerSubtitle}>
          Fresh goods from nearby vendors, offered at a discount to prevent wastage.
        </Text>
      </LinearGradient>

      <FlatList
        data={sales}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <RescueCard item={item} onPress={() => onOpen(item._id)} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>{error ? '⚠️' : '📭'}</Text>
            <Text style={styles.emptyTitle}>
              {error ? 'Unable to load rescue opportunities' : notEligibleReason ? 'Location access needed' : 'No rescue opportunities nearby'}
            </Text>
            <Text style={styles.emptySubtext}>
              {error || notEligibleReason || 'Check back later — nearby rescue sales will appear here.'}
            </Text>
            {notEligibleReason && (
              <Text style={styles.emptyHint}>Enable it from Profile → Rescue Sale Notifications.</Text>
            )}
            {error && (
              <TouchableOpacity style={styles.retryButton} onPress={fetchSales}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
};

export default CustomerRescueOpportunities;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { ...typography.body, color: colors.text.muted, marginTop: spacing.md },
  headerBanner: {
    padding: spacing.lg,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  headerTitle: { ...typography.h3, color: colors.text.light, marginBottom: spacing.xs },
  headerSubtitle: { ...typography.bodySmall, color: 'rgba(255,255,255,0.85)' },
  listContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.md },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  badge: { ...typography.captionMedium, color: colors.error },
  riskBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.round,
  },
  riskBadgeText: { ...typography.caption, fontWeight: '700' },
  itemName: { ...typography.h4, color: colors.text.primary, marginBottom: 2 },
  quantityPrice: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.sm },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  metaText: { ...typography.bodySmall, color: colors.text.muted },
  viewButton: {
    alignSelf: 'flex-end',
  },
  viewButtonText: { ...typography.buttonSmall, color: colors.primary },
  emptyContainer: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyIcon: { fontSize: 56, marginBottom: spacing.md },
  emptyTitle: { ...typography.h4, color: colors.text.primary, marginBottom: spacing.sm, textAlign: 'center' },
  emptySubtext: { ...typography.body, color: colors.text.muted, textAlign: 'center' },
  emptyHint: { ...typography.bodySmall, color: colors.primary, marginTop: spacing.sm, textAlign: 'center' },
  retryButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primaryLight + '20',
    borderRadius: borderRadius.round,
  },
  retryButtonText: { ...typography.buttonSmall, color: colors.primary },
});
