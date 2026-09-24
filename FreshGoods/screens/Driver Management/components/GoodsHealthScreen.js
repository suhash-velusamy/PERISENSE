/**
 * GoodsHealthScreen.js
 * Driver entry point for "Goods Health", reached directly from the Driver
 * Dashboard sidebar. Reuses the same GET /api/driver/export/driver/:driverId
 * fetch and IN_TRANSIT derivation already used by DriverHomePlaceholder.js
 * for its "Current Delivery" card, and hands off to the existing
 * DriverExportHealth (placeholdersubcomponents/DriverExportHealth.js,
 * already used from the Driver Dashboard) for the actual sensor/condition
 * detail. No new condition calculation, threshold, or sensor API.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';
import { colors, spacing, typography } from '../../theme';
import DriverExportHealth from './placeholdersubcomponents/DriverExportHealth';

const GoodsHealthScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [allJobs, setAllJobs] = useState([]);

  const fetchJobs = useCallback(async () => {
    try {
      setError(null);
      const driverId = await AsyncStorage.getItem('userId');
      const res = await api.get(`/api/driver/export/driver/${driverId}`);
      setAllJobs(res.data || []);
    } catch (err) {
      console.error('Failed to fetch driver jobs:', err);
      setError('Unable to load your deliveries. Try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const currentDelivery = allJobs.find((j) => j.status === 'IN_TRANSIT') || null;

  if (loading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.stateText}>Loading your deliveries...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <ScrollView
        contentContainerStyle={styles.stateContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchJobs(); }} colors={[colors.primary]} />}
      >
        <Text style={styles.stateIcon}>⚠️</Text>
        <Text style={styles.stateText}>{error}</Text>
      </ScrollView>
    );
  }

  if (!currentDelivery) {
    return (
      <ScrollView
        contentContainerStyle={styles.stateContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchJobs(); }} colors={[colors.primary]} />}
      >
        <Text style={styles.stateIcon}>📭</Text>
        <Text style={styles.stateText}>No active delivery to monitor</Text>
        <Text style={styles.stateSubtext}>Goods Health appears here once a delivery is in transit.</Text>
      </ScrollView>
    );
  }

  return (
    <DriverExportHealth
      exportId={currentDelivery._id}
      onBack={() => navigation.goBack()}
    />
  );
};

export default GoodsHealthScreen;

const styles = StyleSheet.create({
  stateContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background.primary,
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
