/**
 * VendorRescueSales.js
 * Stage 11 — Vendor's own Rescue Sales: list, interested-buyer view, and
 * buyer selection. Creation happens from the IoT condition alert in
 * VendorExportDashboard.js (CreateRescueSaleModal), not from here — this
 * screen is for managing sales already published.
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
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import api from '../../services/api';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import ThemedCard from '../../components/ThemedCard';
import ThemedButton from '../../components/ThemedButton';
import { getConditionMeta, getRiskLabel } from '../../utils/condition';
import RerouteReviewModal from './vendorHomeComponents/RerouteReviewModal';

const STATUS_COLORS = {
  DRAFT: colors.text.muted,
  PUBLISHED: colors.success,
  EXPIRED: colors.text.muted,
  CLOSED: colors.text.muted,
  CANCELLED: colors.error,
};

const SaleCard = ({ sale, onPress }) => {
  const meta = getConditionMeta(sale.conditionStatus);
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
      <ThemedCard variant="elevated" style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.itemName}>{sale.itemName}</Text>
          <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[sale.status] || colors.text.muted) + '20' }]}>
            <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[sale.status] || colors.text.muted }]}>{sale.status}</Text>
          </View>
        </View>
        <Text style={styles.meta}>{sale.availableQuantity} {sale.unit} · ₹{sale.price}/{sale.unit}</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.conditionTag, { color: meta.color }]}>{meta.icon} {getRiskLabel(sale.riskStatus)}</Text>
          <Text style={styles.eligibleCount}>{sale.eligibleCustomerCount ?? '—'} notified</Text>
        </View>
        <Text style={styles.expiry}>Until {new Date(sale.validUntil).toLocaleString()}</Text>
      </ThemedCard>
    </TouchableOpacity>
  );
};

const BuyerRow = ({ buyer, onSelect, canSelect }) => (
  <View style={styles.buyerRow}>
    <View style={{ flex: 1 }}>
      <Text style={styles.buyerName}>{buyer.name}</Text>
      <Text style={styles.buyerMeta}>
        Approx. distance: {buyer.approxDistanceKm != null ? `${buyer.approxDistanceKm} km` : 'unknown'}
      </Text>
      {(buyer.status === 'INTERESTED' || buyer.status === 'SELECTED') && buyer.mobileNo && (
        <Text style={styles.buyerMeta}>📞 {buyer.mobileNo}</Text>
      )}
      <Text style={[styles.buyerStatus, buyer.status === 'SELECTED' && { color: colors.success }]}>
        {buyer.status}
      </Text>
    </View>
    {canSelect && buyer.status === 'INTERESTED' && (
      <ThemedButton title="Select" variant="primary" size="small" onPress={() => onSelect(buyer.customerId)} />
    )}
  </View>
);

const REROUTE_STATUS_LABELS = {
  VENDOR_CONFIRMED: 'Confirmed — notifying driver',
  DRIVER_NOTIFIED: 'Driver notified — awaiting acknowledgement',
  ACTIVE: 'Driver acknowledged — en route',
  ISSUE_REPORTED: 'Driver reported an issue',
  COMPLETED: 'Rescue delivery completed',
  CANCELLED: 'Cancelled',
};

const RescueSaleDetailModal = ({ saleId, onClose, onChanged }) => {
  const [sale, setSale] = useState(undefined);
  const [buyers, setBuyers] = useState(undefined);
  const [reroute, setReroute] = useState(undefined); // undefined = loading, null = none
  const [busy, setBusy] = useState(false);
  const [showRouteReview, setShowRouteReview] = useState(false);

  const load = useCallback(async () => {
    try {
      const [saleRes, buyersRes, rerouteRes] = await Promise.all([
        api.get(`/api/vendor/rescue-sales/${saleId}`),
        api.get(`/api/vendor/rescue-sales/${saleId}/interested-buyers`),
        api.get(`/api/vendor/rescue-sales/${saleId}/reroute`),
      ]);
      setSale(saleRes.data);
      setBuyers(buyersRes.data || []);
      setReroute(rerouteRes.data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load rescue sale details.');
      onClose();
    }
  }, [saleId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSelect = async (customerId) => {
    setBusy(true);
    try {
      await api.post(`/api/vendor/rescue-sales/${saleId}/select-buyer`, { customerId });
      await load();
      onChanged?.();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to select buyer.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = () => {
    Alert.alert('Cancel Rescue Sale', 'This will stop new interest and notifications for this sale. Continue?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel it',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await api.post(`/api/vendor/rescue-sales/${saleId}/cancel`);
            await load();
            onChanged?.();
          } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to cancel rescue sale.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (sale === undefined) {
    return (
      <Modal visible animationType="slide" onRequestClose={onClose}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Modal>
    );
  }

  const meta = getConditionMeta(sale.conditionStatus);
  const canSelect = sale.status === 'PUBLISHED';

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{sale.itemName}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.scroll}>
          <ThemedCard variant="outlined" style={[styles.card, { backgroundColor: meta.bg, borderColor: meta.color }]}>
            <Text style={[styles.conditionText, { color: meta.color }]}>{meta.icon} {getRiskLabel(sale.riskStatus)}</Text>
            <Text style={styles.reasonText}>{sale.conditionReason}</Text>
          </ThemedCard>

          <ThemedCard variant="outlined" style={styles.card}>
            <Text style={styles.detailLine}>Status: {sale.status}</Text>
            <Text style={styles.detailLine}>{sale.availableQuantity} {sale.unit} at ₹{sale.price}/{sale.unit}</Text>
            <Text style={styles.detailLine}>Radius: {sale.searchRadiusKm} km</Text>
            <Text style={styles.detailLine}>Notified: {sale.eligibleCustomerCount ?? 0} customer(s)</Text>
            <Text style={styles.detailLine}>Until: {new Date(sale.validUntil).toLocaleString()}</Text>
          </ThemedCard>

          <Text style={styles.sectionTitle}>Interested Buyers ({buyers?.length || 0})</Text>
          <ThemedCard variant="outlined" style={styles.card}>
            {buyers === undefined ? (
              <ActivityIndicator color={colors.primary} />
            ) : buyers.length === 0 ? (
              <Text style={styles.emptyText}>No customers have expressed interest yet.</Text>
            ) : (
              buyers.map((b) => (
                <BuyerRow key={b.customerId} buyer={b} onSelect={handleSelect} canSelect={canSelect} />
              ))
            )}
          </ThemedCard>

          {/* Stage 12 — reroute planning, only once a buyer is selected. */}
          {sale.selectedCustomer && (
            <>
              <Text style={styles.sectionTitle}>Rescue Delivery Route</Text>
              <ThemedCard variant="outlined" style={styles.card}>
                {reroute === undefined ? (
                  <ActivityIndicator color={colors.primary} />
                ) : reroute ? (
                  <>
                    <Text style={styles.detailLine}>{REROUTE_STATUS_LABELS[reroute.status] || reroute.status}</Text>
                    <Text style={styles.detailLine}>{reroute.route.distanceKm} km · ETA {reroute.route.durationMinutes} min</Text>
                    {reroute.status === 'ISSUE_REPORTED' && (
                      <Text style={[styles.detailLine, { color: colors.warning }]}>Reason: {reroute.issueReason}</Text>
                    )}
                  </>
                ) : sale.status === 'PUBLISHED' ? (
                  <ThemedButton
                    title="Plan Rescue Route"
                    variant="gradient"
                    onPress={() => setShowRouteReview(true)}
                  />
                ) : (
                  <Text style={styles.emptyText}>This rescue sale is no longer active.</Text>
                )}
              </ThemedCard>
            </>
          )}

          {['DRAFT', 'PUBLISHED'].includes(sale.status) && (
            <ThemedButton
              title="Cancel Rescue Sale"
              variant="outline"
              onPress={handleCancel}
              loading={busy}
              fullWidth
              style={{ marginTop: spacing.md, marginBottom: spacing.xxl }}
            />
          )}
        </ScrollView>
      </View>

      {showRouteReview && (
        <RerouteReviewModal
          rescueSaleId={saleId}
          onClose={() => setShowRouteReview(false)}
          onConfirmed={() => {
            setShowRouteReview(false);
            load();
            onChanged?.();
          }}
        />
      )}
    </Modal>
  );
};

const ServiceRequestsEntry = ({ onPress }) => (
  <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
    <ThemedCard variant="elevated" style={styles.serviceRequestsCard}>
      <View style={styles.serviceRequestsRow}>
        <Text style={styles.serviceRequestsIcon}>📋</Text>
        <Text style={styles.serviceRequestsText}>Service Requests</Text>
        <Text style={styles.serviceRequestsChevron}>›</Text>
      </View>
    </ThemedCard>
  </TouchableOpacity>
);

const VendorRescueSales = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sales, setSales] = useState([]);
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [error, setError] = useState(null);

  const fetchSales = useCallback(async () => {
    try {
      const res = await api.get('/api/vendor/rescue-sales');
      setSales(res.data || []);
      setError(null);
    } catch (err) {
      setError('Unable to load rescue sales.');
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
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sales}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <SaleCard sale={item} onPress={() => setSelectedSaleId(item._id)} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={<ServiceRequestsEntry onPress={() => navigation.navigate('ServiceRequests')} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>{error ? '⚠️' : '🚨'}</Text>
            <Text style={styles.emptyTitle}>{error || 'No rescue sales yet'}</Text>
            <Text style={styles.emptySubtext}>
              {error ? '' : 'When a shipment shows a WARNING or CRITICAL condition, you can create a rescue sale from its details.'}
            </Text>
          </View>
        }
      />

      {selectedSaleId && (
        <RescueSaleDetailModal
          saleId={selectedSaleId}
          onClose={() => setSelectedSaleId(null)}
          onChanged={fetchSales}
        />
      )}
    </View>
  );
};

export default VendorRescueSales;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  serviceRequestsCard: { marginBottom: spacing.md },
  serviceRequestsRow: { flexDirection: 'row', alignItems: 'center' },
  serviceRequestsIcon: { fontSize: 20, marginRight: spacing.md },
  serviceRequestsText: { ...typography.bodyMedium, color: colors.text.primary, flex: 1 },
  serviceRequestsChevron: { fontSize: 24, color: colors.text.muted },
  card: { marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  itemName: { ...typography.h4, color: colors.text.primary, flex: 1 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.round },
  statusBadgeText: { ...typography.caption, fontWeight: '700' },
  meta: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.xs },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  conditionTag: { ...typography.bodySmall, fontWeight: '600' },
  eligibleCount: { ...typography.bodySmall, color: colors.text.muted },
  expiry: { ...typography.caption, color: colors.text.muted },
  emptyContainer: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { ...typography.h4, color: colors.text.primary, marginBottom: spacing.sm, textAlign: 'center' },
  emptySubtext: { ...typography.body, color: colors.text.muted, textAlign: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, paddingTop: spacing.xl },
  closeText: { fontSize: 20, color: colors.text.primary },
  headerTitle: { ...typography.h4, color: colors.text.primary, flex: 1, textAlign: 'center' },
  scroll: { flex: 1, paddingHorizontal: spacing.md },
  conditionText: { ...typography.h4, marginBottom: spacing.xs },
  reasonText: { ...typography.bodySmall, color: colors.text.secondary },
  detailLine: { ...typography.body, color: colors.text.primary, marginBottom: 4 },
  sectionTitle: { ...typography.captionMedium, color: colors.text.muted, marginBottom: spacing.sm, marginTop: spacing.sm, textTransform: 'uppercase' },
  emptyText: { ...typography.body, color: colors.text.muted },
  buyerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  buyerName: { ...typography.body, color: colors.text.primary, fontWeight: '600' },
  buyerMeta: { ...typography.bodySmall, color: colors.text.muted },
  buyerStatus: { ...typography.caption, color: colors.text.muted, marginTop: 2, fontWeight: '700' },
});
