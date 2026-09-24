/**
 * AdvancedFilters.js
 * Filter exports by date range, status, and more
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
    colors,
    gradients,
    spacing,
    borderRadius,
    typography,
    shadows,
} from '../theme';
import ThemedButton from './ThemedButton';

// ═══════════════════════════════════════════════════════════════════
// STATUS OPTIONS
// ═══════════════════════════════════════════════════════════════════
const STATUS_OPTIONS = [
    { value: 'all', label: 'All', color: colors.text.primary },
    { value: 'ASSIGNED', label: 'Pending', color: colors.warning },
    { value: 'ACCEPTED', label: 'Accepted', color: colors.info },
    { value: 'IN_TRANSIT', label: 'In Transit', color: colors.tertiary },
    { value: 'COMPLETED', label: 'Completed', color: colors.success },
];

const DATE_RANGE_OPTIONS = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'custom', label: 'Custom Range' },
];

const SORT_OPTIONS = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'quantity_high', label: 'Quantity (High to Low)' },
    { value: 'quantity_low', label: 'Quantity (Low to High)' },
];

// ═══════════════════════════════════════════════════════════════════
// CHIP COMPONENT
// ═══════════════════════════════════════════════════════════════════
const Chip = ({ label, selected, onPress, color }) => (
    <TouchableOpacity
        style={[
            styles.chip,
            selected && { backgroundColor: color || colors.primary, borderColor: color || colors.primary },
        ]}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <Text
            style={[
                styles.chipText,
                selected && { color: colors.text.light },
            ]}
        >
            {label}
        </Text>
    </TouchableOpacity>
);

// ═══════════════════════════════════════════════════════════════════
// OPTION ROW
// ═══════════════════════════════════════════════════════════════════
const OptionRow = ({ label, selected, onPress }) => (
    <TouchableOpacity
        style={[styles.optionRow, selected && styles.optionRowSelected]}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
            {label}
        </Text>
        {selected && <Text style={styles.checkmark}>✓</Text>}
    </TouchableOpacity>
);

// ═══════════════════════════════════════════════════════════════════
// FILTER BUTTON
// ═══════════════════════════════════════════════════════════════════
export const FilterButton = ({ onPress, activeCount = 0 }) => (
    <TouchableOpacity style={styles.filterButton} onPress={onPress}>
        <Text style={styles.filterIcon}>⚡</Text>
        <Text style={styles.filterButtonText}>Filters</Text>
        {activeCount > 0 && (
            <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeCount}</Text>
            </View>
        )}
    </TouchableOpacity>
);

// ═══════════════════════════════════════════════════════════════════
// MAIN FILTER MODAL
// ═══════════════════════════════════════════════════════════════════
const AdvancedFilters = ({
    visible,
    onClose,
    filters,
    onApply,
}) => {
    const [localFilters, setLocalFilters] = useState(filters || {
        status: 'all',
        dateRange: 'all',
        sortBy: 'newest',
    });

    const updateFilter = (key, value) => {
        setLocalFilters((prev) => ({ ...prev, [key]: value }));
    };

    const handleReset = () => {
        setLocalFilters({
            status: 'all',
            dateRange: 'all',
            sortBy: 'newest',
        });
    };

    const handleApply = () => {
        onApply(localFilters);
        onClose();
    };

    const activeCount = [
        localFilters.status !== 'all',
        localFilters.dateRange !== 'all',
        localFilters.sortBy !== 'newest',
    ].filter(Boolean).length;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={onClose}>
                            <Text style={styles.closeButton}>✕</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Filters</Text>
                        <TouchableOpacity onPress={handleReset}>
                            <Text style={styles.resetButton}>Reset</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Status Filter */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Status</Text>
                            <View style={styles.chipsRow}>
                                {STATUS_OPTIONS.map((option) => (
                                    <Chip
                                        key={option.value}
                                        label={option.label}
                                        selected={localFilters.status === option.value}
                                        onPress={() => updateFilter('status', option.value)}
                                        color={option.color}
                                    />
                                ))}
                            </View>
                        </View>

                        {/* Date Range */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Date Range</Text>
                            {DATE_RANGE_OPTIONS.map((option) => (
                                <OptionRow
                                    key={option.value}
                                    label={option.label}
                                    selected={localFilters.dateRange === option.value}
                                    onPress={() => updateFilter('dateRange', option.value)}
                                />
                            ))}
                        </View>

                        {/* Sort By */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Sort By</Text>
                            {SORT_OPTIONS.map((option) => (
                                <OptionRow
                                    key={option.value}
                                    label={option.label}
                                    selected={localFilters.sortBy === option.value}
                                    onPress={() => updateFilter('sortBy', option.value)}
                                />
                            ))}
                        </View>
                    </ScrollView>

                    {/* Apply Button */}
                    <View style={styles.applyContainer}>
                        <ThemedButton
                            title={`Apply Filters${activeCount > 0 ? ` (${activeCount})` : ''}`}
                            variant="gradient"
                            onPress={handleApply}
                            fullWidth
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
};

// ═══════════════════════════════════════════════════════════════════
// FILTER UTILITIES
// ═══════════════════════════════════════════════════════════════════
export const applyFilters = (data, filters) => {
    let result = [...data];

    // Status filter
    if (filters.status && filters.status !== 'all') {
        result = result.filter((item) => item.status === filters.status);
    }

    // Date range filter
    if (filters.dateRange && filters.dateRange !== 'all') {
        const now = new Date();
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));

        result = result.filter((item) => {
            const itemDate = new Date(item.createdAt || item.timestamp);

            switch (filters.dateRange) {
                case 'today':
                    return itemDate >= startOfDay;
                case 'week':
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    return itemDate >= weekAgo;
                case 'month':
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    return itemDate >= monthAgo;
                default:
                    return true;
            }
        });
    }

    // Sort
    if (filters.sortBy) {
        result.sort((a, b) => {
            switch (filters.sortBy) {
                case 'newest':
                    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
                case 'oldest':
                    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
                case 'quantity_high':
                    return (b.quantity || 0) - (a.quantity || 0);
                case 'quantity_low':
                    return (a.quantity || 0) - (b.quantity || 0);
                default:
                    return 0;
            }
        });
    }

    return result;
};

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.background.card,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        maxHeight: '80%',
        paddingBottom: spacing.xl,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
    },
    closeButton: {
        fontSize: 20,
        color: colors.text.muted,
        padding: spacing.sm,
    },
    modalTitle: {
        ...typography.h3,
        color: colors.text.primary,
    },
    resetButton: {
        ...typography.bodyMedium,
        color: colors.primary,
        padding: spacing.sm,
    },
    section: {
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
    },
    sectionTitle: {
        ...typography.overline,
        color: colors.text.muted,
        marginBottom: spacing.md,
    },
    chipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    chip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.round,
        borderWidth: 1,
        borderColor: colors.border.medium,
        backgroundColor: colors.background.secondary,
    },
    chipText: {
        ...typography.bodySmall,
        color: colors.text.secondary,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        borderRadius: borderRadius.md,
    },
    optionRowSelected: {
        backgroundColor: colors.background.secondary,
    },
    optionText: {
        ...typography.body,
        color: colors.text.secondary,
    },
    optionTextSelected: {
        color: colors.primary,
        fontWeight: '600',
    },
    checkmark: {
        fontSize: 18,
        color: colors.primary,
    },
    applyContainer: {
        padding: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border.light,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.round,
        borderWidth: 1,
        borderColor: colors.border.light,
    },
    filterIcon: {
        fontSize: 14,
        marginRight: spacing.xs,
    },
    filterButtonText: {
        ...typography.bodySmall,
        color: colors.text.primary,
    },
    filterBadge: {
        marginLeft: spacing.sm,
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.round,
    },
    filterBadgeText: {
        ...typography.captionMedium,
        color: colors.text.light,
    },
});

export default AdvancedFilters;
