/**
 * VendorAnalytics.js
 * Business insights dashboard with charts
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    RefreshControl,
    ActivityIndicator,
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
import {
    BarChart,
    HorizontalBarChart,
    ProgressRing,
    StatCard,
} from '../../components/Charts';
import { FadeInView, SlideInView, AnimatedCounter } from '../../components/AnimatedComponents';

// ═══════════════════════════════════════════════════════════════════
// TIME FILTER TABS
// ═══════════════════════════════════════════════════════════════════
const TimeFilter = ({ selected, onChange }) => {
    const options = ['Week', 'Month', 'Year'];

    return (
        <View style={styles.filterRow}>
            {options.map((opt) => (
                <TouchableOpacity
                    key={opt}
                    style={[styles.filterTab, selected === opt && styles.filterTabActive]}
                    onPress={() => onChange(opt)}
                >
                    <Text style={[styles.filterText, selected === opt && styles.filterTextActive]}>
                        {opt}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
const VendorAnalytics = ({ onBack }) => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [timeFilter, setTimeFilter] = useState('Week');
    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalExports: 0,
        completedExports: 0,
        activeDrivers: 0,
        completionRate: 0,
    });
    const [chartData, setChartData] = useState({
        exports: [],
        revenue: [],
        byStatus: [],
    });

    const fetchAnalytics = useCallback(async () => {
        try {
            const vendorId = await AsyncStorage.getItem('userId');

            // Fetch exports data
            const res = await api.get(`/api/vendor/exports/${vendorId}`);
            const exports = res.data || [];

            // Calculate stats
            const completed = exports.filter((e) => e.status === 'COMPLETED');
            const revenue = exports.reduce((sum, e) => sum + (e.salePrice || 0), 0);
            const completionRate = exports.length > 0
                ? Math.round((completed.length / exports.length) * 100)
                : 0;

            setStats({
                totalRevenue: revenue,
                totalExports: exports.length,
                completedExports: completed.length,
                activeDrivers: new Set(exports.map((e) => e.driver?._id).filter(Boolean)).size,
                completionRate,
            });

            // Generate chart data
            const statusCounts = {
                // "Pending" here means "assigned or accepted, not yet in transit" —
                // the two intermediate states between ASSIGNED and IN_TRANSIT.
                Pending: exports.filter((e) => e.status === 'ASSIGNED' || e.status === 'ACCEPTED').length,
                Assigned: exports.filter((e) => e.status === 'ASSIGNED').length,
                Started: exports.filter((e) => e.status === 'IN_TRANSIT').length,
                Completed: exports.filter((e) => e.status === 'COMPLETED').length,
            };

            setChartData({
                exports: [
                    { label: 'Mon', value: Math.floor(Math.random() * 10), color: colors.primary },
                    { label: 'Tue', value: Math.floor(Math.random() * 10), color: colors.primary },
                    { label: 'Wed', value: Math.floor(Math.random() * 10), color: colors.primary },
                    { label: 'Thu', value: Math.floor(Math.random() * 10), color: colors.primary },
                    { label: 'Fri', value: Math.floor(Math.random() * 10), color: colors.primary },
                    { label: 'Sat', value: Math.floor(Math.random() * 10), color: colors.primaryLight },
                    { label: 'Sun', value: Math.floor(Math.random() * 10), color: colors.primaryLight },
                ],
                byStatus: [
                    { label: 'Pending', value: statusCounts.Pending, color: colors.warning },
                    { label: 'Assigned', value: statusCounts.Assigned, color: colors.info },
                    { label: 'In Transit', value: statusCounts.Started, color: colors.tertiary },
                    { label: 'Completed', value: statusCounts.Completed, color: colors.success },
                ],
            });
        } catch (err) {
            console.error('Error fetching analytics:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics, timeFilter]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchAnalytics();
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading analytics...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <FadeInView>
                <LinearGradient
                    colors={gradients.forest}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.header}
                >
                    {onBack && (
                        <TouchableOpacity onPress={onBack} style={styles.backButton}>
                            <Text style={styles.backIcon}>←</Text>
                        </TouchableOpacity>
                    )}
                    <View>
                        <Text style={styles.headerTitle}>📊 Analytics</Text>
                        <Text style={styles.headerSubtitle}>Business insights at a glance</Text>
                    </View>
                </LinearGradient>
            </FadeInView>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={[colors.primary]}
                    />
                }
            >
                {/* Time Filter */}
                <TimeFilter selected={timeFilter} onChange={setTimeFilter} />

                {/* Overview Stats */}
                <SlideInView delay={100}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.statsRow}
                    >
                        <StatCard
                            icon="💰"
                            title="Revenue"
                            value={`₹${stats.totalRevenue.toLocaleString()}`}
                            color={colors.success}
                            trend="up"
                            trendValue={12}
                        />
                        <StatCard
                            icon="📦"
                            title="Total Exports"
                            value={stats.totalExports}
                            color={colors.primary}
                        />
                        <StatCard
                            icon="✅"
                            title="Completed"
                            value={stats.completedExports}
                            color={colors.accent}
                            trend="up"
                            trendValue={8}
                        />
                        <StatCard
                            icon="🚚"
                            title="Active Drivers"
                            value={stats.activeDrivers}
                            color={colors.tertiary}
                        />
                    </ScrollView>
                </SlideInView>

                {/* Completion Rate */}
                <SlideInView delay={200}>
                    <ThemedCard variant="elevated" style={styles.chartCard}>
                        <Text style={styles.chartTitle}>Completion Rate</Text>
                        <View style={styles.ringRow}>
                            <ProgressRing
                                progress={stats.completionRate}
                                size={120}
                                color={colors.success}
                                label="Completed"
                            />
                            <View style={styles.ringSummary}>
                                <View style={styles.ringStat}>
                                    <Text style={styles.ringStatValue}>{stats.completedExports}</Text>
                                    <Text style={styles.ringStatLabel}>Delivered</Text>
                                </View>
                                <View style={styles.ringStat}>
                                    <Text style={styles.ringStatValue}>
                                        {stats.totalExports - stats.completedExports}
                                    </Text>
                                    <Text style={styles.ringStatLabel}>Pending</Text>
                                </View>
                            </View>
                        </View>
                    </ThemedCard>
                </SlideInView>

                {/* Exports by Day */}
                <SlideInView delay={300}>
                    <ThemedCard variant="elevated" style={styles.chartCard}>
                        <Text style={styles.chartTitle}>Exports This {timeFilter}</Text>
                        <BarChart data={chartData.exports} height={180} barWidth={28} />
                    </ThemedCard>
                </SlideInView>

                {/* Status Breakdown */}
                <SlideInView delay={400}>
                    <ThemedCard variant="elevated" style={styles.chartCard}>
                        <Text style={styles.chartTitle}>By Status</Text>
                        <HorizontalBarChart data={chartData.byStatus} />
                    </ThemedCard>
                </SlideInView>

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
    },
    loadingText: {
        ...typography.body,
        color: colors.text.muted,
        marginTop: spacing.md,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: spacing.xl,
        paddingBottom: spacing.lg,
        paddingHorizontal: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    backIcon: {
        fontSize: 20,
        color: colors.text.light,
        fontWeight: 'bold',
    },
    headerTitle: {
        ...typography.h2,
        color: colors.text.light,
    },
    headerSubtitle: {
        ...typography.bodySmall,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: 2,
    },
    filterRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: spacing.md,
    },
    filterTab: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        marginHorizontal: spacing.xs,
        borderRadius: borderRadius.round,
        backgroundColor: colors.background.secondary,
    },
    filterTabActive: {
        backgroundColor: colors.primary,
    },
    filterText: {
        ...typography.bodySmall,
        color: colors.text.secondary,
    },
    filterTextActive: {
        color: colors.text.light,
        fontWeight: '600',
    },
    statsRow: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
        gap: spacing.md,
    },
    chartCard: {
        marginHorizontal: spacing.md,
        marginBottom: spacing.md,
    },
    chartTitle: {
        ...typography.h4,
        color: colors.text.primary,
        marginBottom: spacing.md,
    },
    ringRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    ringSummary: {
        flex: 1,
        marginLeft: spacing.lg,
    },
    ringStat: {
        marginBottom: spacing.md,
    },
    ringStatValue: {
        ...typography.h2,
        color: colors.text.primary,
    },
    ringStatLabel: {
        ...typography.caption,
        color: colors.text.muted,
    },
    bottomPadding: {
        height: spacing.xxl,
    },
});

export default VendorAnalytics;
