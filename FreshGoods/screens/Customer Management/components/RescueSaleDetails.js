/**
 * RescueSaleDetails.js
 * Stage 11 — single Rescue Sale detail + "I'm Interested" / withdraw.
 * Expressing interest is NOT a purchase (Phase 15) — no payment, no
 * reservation, no automatic anything happens here.
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { colors, gradients, spacing, borderRadius, typography, shadows } from '../../theme';
import ThemedCard from '../../components/ThemedCard';
import ThemedButton from '../../components/ThemedButton';
import { getConditionMeta, getRiskLabel } from '../../utils/condition';

const DetailRow = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const RescueSaleDetails = ({ rescueSaleId, onBack }) => {
  const [sale, setSale] = useState(undefined); // undefined = loading, null = error/unavailable
  const [errorReason, setErrorReason] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSale = useCallback(async () => {
    try {
      const res = await api.get(`/api/customer/rescue-sales/${rescueSaleId}`);
      setSale(res.data);
      setErrorReason(null);
    } catch (err) {
      setSale(null);
      if (err.status === 404) {
        setErrorReason('This rescue sale is no longer available.');
      } else if (err.status === 403) {
        setErrorReason("You're outside the eligible range for this rescue sale.");
      } else {
        setErrorReason('Unable to load this rescue sale.');
      }
    }
  }, [rescueSaleId]);

  useEffect(() => {
    fetchSale();
  }, [fetchSale]);

  const handleInterest = async () => {
    setActionLoading(true);
    try {
      await api.post(`/api/customer/rescue-sales/${rescueSaleId}/interest`);
      await fetchSale();
      Alert.alert('Thanks!', "The vendor has been notified that you're interested. They may contact you to arrange pickup.");
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to record interest.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdraw = async () => {
    setActionLoading(true);
    try {
      await api.delete(`/api/customer/rescue-sales/${rescueSaleId}/interest`);
      await fetchSale();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to withdraw interest.');
    } finally {
      setActionLoading(false);
    }
  };

  if (sale === undefined) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (sale === null) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyIcon}>⚠️</Text>
        <Text style={styles.emptyText}>{errorReason}</Text>
        <TouchableOpacity onPress={onBack} style={{ marginTop: spacing.lg }}>
          <Text style={styles.backLink}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const meta = getConditionMeta(sale.conditionStatus);
  const isExpired = sale.status === 'EXPIRED';
  const isCancelled = sale.status === 'CANCELLED';
  const isActive = sale.status === 'PUBLISHED';
  const myStatus = sale.myInterestStatus;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <LinearGradient colors={gradients.forest} style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🚨 {sale.itemName}</Text>
      </LinearGradient>

      {isExpired && (
        <View style={styles.statusBanner}>
          <Text style={styles.statusBannerText}>This rescue sale has expired.</Text>
        </View>
      )}
      {isCancelled && (
        <View style={styles.statusBanner}>
          <Text style={styles.statusBannerText}>This rescue sale is no longer available.</Text>
        </View>
      )}

      <ThemedCard variant="elevated" style={styles.card}>
        <DetailRow label="Available" value={`${sale.availableQuantity} ${sale.unit}`} />
        <DetailRow label="Price" value={`₹${sale.price}/${sale.unit}`} />
        <DetailRow label="Approx. distance" value={`~${sale.approxDistanceKm} km`} />
        <DetailRow label="Available until" value={new Date(sale.validUntil).toLocaleString()} />
        {sale.description && <DetailRow label="Notes" value={sale.description} />}
      </ThemedCard>

      <ThemedCard variant="outlined" style={[styles.card, { backgroundColor: meta.bg, borderColor: meta.color }]}>
        <Text style={[styles.conditionText, { color: meta.color }]}>
          {meta.icon} {getRiskLabel(sale.riskStatus)}
        </Text>
        <Text style={styles.conditionHint}>
          This shipment's condition monitoring flagged it for rescue — goods are still usable but at
          risk if not sold quickly.
        </Text>
      </ThemedCard>

      {isActive && (
        <View style={styles.actionContainer}>
          {myStatus === 'INTERESTED' && (
            <>
              <Text style={styles.statusLabel}>✅ You've expressed interest</Text>
              <ThemedButton
                title="Withdraw Interest"
                variant="outline"
                onPress={handleWithdraw}
                loading={actionLoading}
                fullWidth
              />
            </>
          )}
          {myStatus === 'SELECTED' && (
            <Text style={styles.statusLabel}>🎉 You've been selected by the vendor!</Text>
          )}
          {myStatus === 'NOT_SELECTED' && (
            <Text style={styles.statusLabel}>The vendor selected another buyer for this sale.</Text>
          )}
          {(!myStatus || myStatus === 'WITHDRAWN') && (
            <ThemedButton
              title="I'm Interested"
              variant="gradient"
              onPress={handleInterest}
              loading={actionLoading}
              fullWidth
            />
          )}
        </View>
      )}
    </ScrollView>
  );
};

export default RescueSaleDetails;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  scrollContent: { paddingBottom: spacing.xxl },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { ...typography.body, color: colors.text.muted, textAlign: 'center' },
  backLink: { ...typography.button, color: colors.primary },
  header: { padding: spacing.lg, paddingTop: spacing.xl },
  backText: { color: colors.text.light, marginBottom: spacing.md, ...typography.body },
  headerTitle: { ...typography.h3, color: colors.text.light },
  statusBanner: {
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.errorBg,
  },
  statusBannerText: { ...typography.body, color: colors.error, textAlign: 'center' },
  card: { margin: spacing.md, marginBottom: 0, marginTop: spacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  rowLabel: { ...typography.bodySmall, color: colors.text.muted },
  rowValue: { ...typography.bodySmall, color: colors.text.primary, fontWeight: '600' },
  conditionText: { ...typography.h4, marginBottom: spacing.xs },
  conditionHint: { ...typography.bodySmall, color: colors.text.secondary },
  actionContainer: { margin: spacing.md, marginTop: spacing.lg },
  statusLabel: { ...typography.body, color: colors.text.primary, textAlign: 'center', marginBottom: spacing.md },
});
