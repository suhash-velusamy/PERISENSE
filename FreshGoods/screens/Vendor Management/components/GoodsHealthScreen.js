/**
 * GoodsHealthScreen.js
 * Vendor entry point for "Goods Health", reached directly from the
 * Vendor Dashboard sidebar. Lists active (IN_TRANSIT) shipments — reusing
 * the existing GET /api/vendor/export/passedstatus/:vendorId endpoint,
 * previously unused by the frontend — and hands off to the existing
 * MonitorHealthView (vendorHomeComponents/monitorHealthView.js, already
 * used from the Shipments tab) for the actual sensor/condition detail.
 * No new condition calculation, threshold, or sensor API — this only adds
 * a direct path to functionality that already existed.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';
import { colors, spacing, borderRadius, typography, shadows, getStatusColor, getStatusBgColor } from '../../theme';
import ThemedCard from '../../components/ThemedCard';
import MonitorHealthView from './vendorHomeComponents/monitorHealthView';

const ShipmentCard = ({ item, onPress }) => {
  const statusColor = getStatusColor(item.status);
  const statusBg = getStatusBgColor(item.status);
  return (
    <ThemedCard variant="elevated" style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>📦 {item.itemName}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.cardLine} numberOfLines={1}>Driver: {item.driver?.name || 'N/A'}</Text>
      <Text style={styles.cardLine} numberOfLines={1}>Vehicle: {item.vehicle?.vehicleNumber || 'N/A'}</Text>
      <Text style={styles.cardHint}>Tap to view Goods Health →</Text>
    </ThemedCard>
  );
};

const GoodsHealthScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [selectedExport, setSelectedExport] = useState(null);

  const fetchActiveShipments = useCallback(async () => {
    try {
      setError(null);
      const vendorId = await AsyncStorage.getItem('userId');
      const res = await api.get(`/api/vendor/export/passedstatus/${vendorId}`);
      setShipments(res.data || []);
    } catch (err) {
      console.error('Failed to fetch active shipments:', err);
      setError('Unable to load active shipments. Try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveShipments();
  }, [fetchActiveShipments]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchActiveShipments();
  };

  if (selectedExport) {
    return <MonitorHealthView selectedExport={selectedExport} onBack={() => setSelectedExport(null)} />;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
    >
      <Text style={styles.heading}>Goods Health</Text>
      <Text style={styles.subheading}>Sensor monitoring for active shipments</Text>

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.stateText}>Loading active shipments...</Text>
        </View>
      ) : error ? (
        <View style={styles.stateContainer}>
          <Text style={styles.stateIcon}>⚠️</Text>
          <Text style={styles.stateText}>{error}</Text>
        </View>
      ) : shipments.length === 0 ? (
        <View style={styles.stateContainer}>
          <Text style={styles.stateIcon}>📭</Text>
          <Text style={styles.stateText}>No active shipments to monitor</Text>
          <Text style={styles.stateSubtext}>Goods Health appears here once a shipment is in transit.</Text>
        </View>
      ) : (
        shipments.map((item) => (
          <ShipmentCard key={item._id} item={item} onPress={() => setSelectedExport(item)} />
        ))
      )}
    </ScrollView>
  );
};

export default GoodsHealthScreen;

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: colors.background.primary,
    flexGrow: 1,
  },
  heading: {
    ...typography.h3,
    color: colors.text.primary,
  },
  subheading: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    marginBottom: spacing.md,
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.full,
  },
  statusText: {
    ...typography.captionMedium,
  },
  cardLine: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
  },
  cardHint: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  stateContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  stateIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  stateText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  stateSubtext: {
    ...typography.bodySmall,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
