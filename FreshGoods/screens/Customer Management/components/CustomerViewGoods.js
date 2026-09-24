/**
 * CustomerViewGoods.js
 * Browse ongoing exports with enhanced UI and filtering
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
  TextInput,
  Animated,
} from 'react-native';
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
import {
  SlideInView,
  FadeInView,
  AnimatedPressable,
} from '../../components/AnimatedComponents';

// ═══════════════════════════════════════════════════════════════════
// FILTER TAB COMPONENT
// ═══════════════════════════════════════════════════════════════════
const FilterTab = ({ label, isActive, onPress, count }) => (
  <TouchableOpacity
    style={[styles.filterTab, isActive && styles.filterTabActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
      {label}
    </Text>
    {count !== undefined && (
      <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
        <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>
          {count}
        </Text>
      </View>
    )}
  </TouchableOpacity>
);

// ═══════════════════════════════════════════════════════════════════
// EXPORT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════
const ExportCard = ({ exportItem, onPress, index }) => {
  const statusColor = getStatusColor(exportItem.status);
  const statusBg = getStatusBgColor(exportItem.status);

  return (
    <SlideInView delay={index * 80} style={styles.cardWrapper}>
      <AnimatedPressable onPress={onPress}>
        <ThemedCard variant="elevated" style={styles.exportCard}>
          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {exportItem.status || 'Active'}
            </Text>
          </View>

          {/* Product Info */}
          <View style={styles.exportHeader}>
            <View style={styles.productIconContainer}>
              <LinearGradient
                colors={[statusColor + '30', statusColor + '10']}
                style={styles.productIcon}
              >
                <Text style={styles.productEmoji}>📦</Text>
              </LinearGradient>
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={1}>
                {exportItem.itemName || exportItem.productName || 'Goods Shipment'}
              </Text>
              <Text style={styles.quantity}>
                {exportItem.quantity || '-'} {exportItem.unit || 'units'}
              </Text>
            </View>
          </View>

          {/* Route Info */}
          <View style={styles.routeContainer}>
            <View style={styles.routePoint}>
              <View style={[styles.routeDot, { backgroundColor: colors.success }]} />
              <Text style={styles.routeText} numberOfLines={1}>
                {exportItem.startLocation?.name ||
                  exportItem.routes?.[0] ||
                  'Origin'}
              </Text>
            </View>
            <View style={styles.routeArrow}>
              <Text style={styles.arrowText}>→</Text>
            </View>
            <View style={styles.routePoint}>
              <View style={[styles.routeDot, { backgroundColor: colors.error }]} />
              <Text style={styles.routeText} numberOfLines={1}>
                {exportItem.endLocation?.name ||
                  exportItem.routes?.[exportItem.routes?.length - 1] ||
                  'Destination'}
              </Text>
            </View>
          </View>

          {/* Details Row */}
          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Text style={styles.detailIcon}>🏪</Text>
              <Text style={styles.detailText} numberOfLines={1}>
                {exportItem.vendorId?.name || 'Vendor'}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailIcon}>🚚</Text>
              <Text style={styles.detailText} numberOfLines={1}>
                {exportItem.driver?.name || 'Driver'}
              </Text>
            </View>
          </View>

          {/* Track Button */}
          <TouchableOpacity style={styles.trackButton} onPress={onPress}>
            <LinearGradient
              colors={gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.trackButtonGradient}
            >
              <Text style={styles.trackButtonText}>Track Shipment</Text>
              <Text style={styles.trackButtonArrow}>→</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ThemedCard>
      </AnimatedPressable>
    </SlideInView>
  );
};

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
const CustomerViewGoods = ({ onTrack }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exports, setExports] = useState([]);
  const [filteredExports, setFilteredExports] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [error, setError] = useState(null);

  const fetchExports = useCallback(async () => {
    try {
      const response = await api.get('/api/customer/exports/available');
      setExports(response.data || []);
      setFilteredExports(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching exports:', err);
      setError('Unable to load available goods. Try again.');
      setExports([]);
      setFilteredExports([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchExports();
  }, [fetchExports]);

  // Apply filters
  useEffect(() => {
    let result = [...exports];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (exp) =>
          exp.itemName?.toLowerCase().includes(query) ||
          exp.productName?.toLowerCase().includes(query) ||
          exp.vendorId?.name?.toLowerCase().includes(query) ||
          exp.driver?.name?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (activeFilter !== 'all') {
      result = result.filter(
        (exp) => exp.status?.toLowerCase() === activeFilter
      );
    }

    setFilteredExports(result);
  }, [searchQuery, activeFilter, exports]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchExports();
  }, [fetchExports]);

  const handleExportPress = (exportItem) => {
    if (onTrack) {
      onTrack(exportItem);
    } else {
      console.log('Selected export:', exportItem._id);
    }
  };

  const getFilterCounts = () => {
    return {
      all: exports.length,
      started: exports.filter((e) => e.status?.toLowerCase() === 'in_transit').length,
      assigned: exports.filter((e) => e.status?.toLowerCase() === 'assigned').length,
      completed: exports.filter((e) => e.status?.toLowerCase() === 'completed').length,
    };
  };

  const filterCounts = getFilterCounts();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading available goods...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <FadeInView style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by product, vendor, driver..."
            placeholderTextColor={colors.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </FadeInView>

      {/* Filter Tabs */}
      <FadeInView delay={100} style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { key: 'all', label: 'All', count: filterCounts.all },
            { key: 'in_transit', label: 'In Transit', count: filterCounts.started },
            { key: 'assigned', label: 'Assigned', count: filterCounts.assigned },
            { key: 'completed', label: 'Completed', count: filterCounts.completed },
          ]}
          renderItem={({ item }) => (
            <FilterTab
              label={item.label}
              count={item.count}
              isActive={activeFilter === item.key}
              onPress={() => setActiveFilter(item.key)}
            />
          )}
          contentContainerStyle={styles.filterList}
        />
      </FadeInView>

      {/* Results Count */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {filteredExports.length} shipment
          {filteredExports.length !== 1 ? 's' : ''} found
        </Text>
      </View>

      {/* Export List */}
      <FlatList
        data={filteredExports}
        keyExtractor={(item) => item._id || Math.random().toString()}
        renderItem={({ item, index }) => (
          <ExportCard
            exportItem={item}
            index={index}
            onPress={() => handleExportPress(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <FadeInView style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>{error ? '⚠️' : '📭'}</Text>
            <Text style={styles.emptyTitle}>{error ? 'Unable to load goods' : 'No Shipments Found'}</Text>
            <Text style={styles.emptySubtext}>
              {error
                ? error
                : searchQuery || activeFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Pull down to refresh'}
            </Text>
            {error && (
              <TouchableOpacity style={styles.retryButton} onPress={fetchExports}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            )}
          </FadeInView>
        }
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
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    ...shadows.sm,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    ...typography.body,
    color: colors.text.primary,
  },
  clearButton: {
    padding: spacing.sm,
  },
  clearText: {
    color: colors.text.muted,
    fontSize: 16,
  },
  filterContainer: {
    paddingBottom: spacing.sm,
  },
  filterList: {
    paddingHorizontal: spacing.md,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: borderRadius.round,
    backgroundColor: colors.background.secondary,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  filterTabTextActive: {
    color: colors.text.light,
    fontWeight: '600',
  },
  filterBadge: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.round,
    backgroundColor: colors.border.light,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  filterBadgeText: {
    ...typography.caption,
    color: colors.text.muted,
  },
  filterBadgeTextActive: {
    color: colors.text.light,
  },
  resultsHeader: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  resultsCount: {
    ...typography.caption,
    color: colors.text.muted,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  cardWrapper: {
    marginBottom: spacing.md,
  },
  exportCard: {
    position: 'relative',
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
  exportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  productIconContainer: {
    marginRight: spacing.md,
  },
  productIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productEmoji: {
    fontSize: 24,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    ...typography.h4,
    color: colors.text.primary,
  },
  quantity: {
    ...typography.bodySmall,
    color: colors.text.muted,
    marginTop: 2,
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  routePoint: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  routeText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    flex: 1,
  },
  routeArrow: {
    paddingHorizontal: spacing.sm,
  },
  arrowText: {
    color: colors.text.muted,
    fontSize: 16,
  },
  detailsRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  detailItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIcon: {
    fontSize: 14,
    marginRight: spacing.sm,
  },
  detailText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    flex: 1,
  },
  trackButton: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  trackButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 4,
  },
  trackButtonText: {
    ...typography.button,
    color: colors.text.light,
    marginRight: spacing.sm,
  },
  trackButtonArrow: {
    color: colors.text.light,
    fontSize: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primaryLight + '20',
    borderRadius: borderRadius.round,
  },
  retryButtonText: {
    ...typography.buttonSmall,
    color: colors.primary,
  },
});

export default CustomerViewGoods;
