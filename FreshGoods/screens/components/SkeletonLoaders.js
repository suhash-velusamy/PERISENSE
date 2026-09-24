/**
 * SkeletonLoaders.js
 * Shimmer effect loading components
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import {
    colors,
    spacing,
    borderRadius,
} from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════════
// SHIMMER ANIMATION WRAPPER
// ═══════════════════════════════════════════════════════════════════
const Shimmer = ({ children, style }) => {
    const shimmerValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.timing(shimmerValue, {
                toValue: 1,
                duration: 1500,
                useNativeDriver: true,
            })
        );
        animation.start();
        return () => animation.stop();
    }, [shimmerValue]);

    const translateX = shimmerValue.interpolate({
        inputRange: [0, 1],
        outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
    });

    return (
        <View style={[styles.shimmerContainer, style]}>
            {children}
            <Animated.View
                style={[
                    styles.shimmerOverlay,
                    { transform: [{ translateX }] },
                ]}
            />
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════
// SKELETON COMPONENTS
// ═══════════════════════════════════════════════════════════════════

// Basic skeleton box
export const SkeletonBox = ({ width = '100%', height = 20, borderRadius: radius = borderRadius.sm, style }) => (
    <Shimmer style={[styles.box, { width, height, borderRadius: radius }, style]} />
);

// Circle skeleton (for avatars)
export const SkeletonCircle = ({ size = 48, style }) => (
    <Shimmer style={[styles.box, { width: size, height: size, borderRadius: size / 2 }, style]} />
);

// Text line skeleton
export const SkeletonText = ({ width = '80%', style }) => (
    <Shimmer style={[styles.text, { width }, style]} />
);

// Card skeleton
export const SkeletonCard = ({ style }) => (
    <View style={[styles.card, style]}>
        <View style={styles.cardHeader}>
            <SkeletonCircle size={48} />
            <View style={styles.cardHeaderText}>
                <SkeletonText width="60%" />
                <SkeletonText width="40%" style={styles.mt} />
            </View>
        </View>
        <SkeletonText width="100%" style={styles.mtLg} />
        <SkeletonText width="90%" style={styles.mt} />
        <SkeletonText width="75%" style={styles.mt} />
    </View>
);

// List item skeleton
export const SkeletonListItem = ({ hasAvatar = true, style }) => (
    <View style={[styles.listItem, style]}>
        {hasAvatar && <SkeletonCircle size={40} style={styles.mr} />}
        <View style={styles.listItemContent}>
            <SkeletonText width="70%" />
            <SkeletonText width="50%" style={styles.mt} />
        </View>
        <SkeletonBox width={60} height={24} borderRadius={borderRadius.sm} />
    </View>
);

// Stats grid skeleton
export const SkeletonStatsGrid = ({ count = 4 }) => (
    <View style={styles.statsGrid}>
        {Array.from({ length: count }).map((_, i) => (
            <View key={i} style={styles.statBox}>
                <SkeletonBox width={40} height={40} borderRadius={10} />
                <SkeletonText width="60%" style={styles.mtLg} />
                <SkeletonText width="80%" style={styles.mt} />
            </View>
        ))}
    </View>
);

// Dashboard header skeleton
export const SkeletonDashboardHeader = () => (
    <View style={styles.dashboardHeader}>
        <View>
            <SkeletonText width={120} />
            <SkeletonText width={180} style={styles.mt} />
        </View>
        <SkeletonCircle size={48} />
    </View>
);

// Chart skeleton
export const SkeletonChart = ({ height = 200 }) => (
    <View style={[styles.chart, { height }]}>
        <View style={styles.chartBars}>
            {[0.6, 0.8, 0.5, 0.9, 0.7, 0.4, 0.8].map((h, i) => (
                <SkeletonBox
                    key={i}
                    width={24}
                    height={height * h * 0.7}
                    borderRadius={borderRadius.sm}
                />
            ))}
        </View>
        <View style={styles.chartLabels}>
            {Array.from({ length: 7 }).map((_, i) => (
                <SkeletonText key={i} width={24} />
            ))}
        </View>
    </View>
);

// Full screen list skeleton
export const SkeletonList = ({ itemCount = 5, hasAvatar = true }) => (
    <View style={styles.list}>
        {Array.from({ length: itemCount }).map((_, i) => (
            <SkeletonListItem key={i} hasAvatar={hasAvatar} />
        ))}
    </View>
);

// Profile skeleton
export const SkeletonProfile = () => (
    <View style={styles.profile}>
        <SkeletonCircle size={100} />
        <SkeletonText width={150} style={styles.mtLg} />
        <SkeletonText width={200} style={styles.mt} />
        <View style={styles.profileStats}>
            <View style={styles.profileStat}>
                <SkeletonBox width={50} height={30} />
                <SkeletonText width={60} style={styles.mt} />
            </View>
            <View style={styles.profileStat}>
                <SkeletonBox width={50} height={30} />
                <SkeletonText width={60} style={styles.mt} />
            </View>
            <View style={styles.profileStat}>
                <SkeletonBox width={50} height={30} />
                <SkeletonText width={60} style={styles.mt} />
            </View>
        </View>
    </View>
);

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
    shimmerContainer: {
        overflow: 'hidden',
        backgroundColor: colors.background.secondary,
    },
    shimmerOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        width: '50%',
        transform: [{ skewX: '-20deg' }],
    },
    box: {
        backgroundColor: colors.background.tertiary,
    },
    text: {
        height: 14,
        borderRadius: borderRadius.xs,
        backgroundColor: colors.background.tertiary,
    },
    mt: {
        marginTop: spacing.xs,
    },
    mtLg: {
        marginTop: spacing.md,
    },
    mr: {
        marginRight: spacing.md,
    },
    card: {
        backgroundColor: colors.background.card,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardHeaderText: {
        flex: 1,
        marginLeft: spacing.md,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
    },
    listItemContent: {
        flex: 1,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        padding: spacing.md,
    },
    statBox: {
        width: '48%',
        backgroundColor: colors.background.card,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
        alignItems: 'center',
    },
    dashboardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
    },
    chart: {
        backgroundColor: colors.background.card,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
    },
    chartBars: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-end',
        flex: 1,
    },
    chartLabels: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: spacing.sm,
    },
    list: {
        paddingHorizontal: spacing.md,
    },
    profile: {
        alignItems: 'center',
        padding: spacing.xl,
    },
    profileStats: {
        flexDirection: 'row',
        marginTop: spacing.xl,
        width: '100%',
        justifyContent: 'space-around',
    },
    profileStat: {
        alignItems: 'center',
    },
});

export default {
    SkeletonBox,
    SkeletonCircle,
    SkeletonText,
    SkeletonCard,
    SkeletonListItem,
    SkeletonStatsGrid,
    SkeletonDashboardHeader,
    SkeletonChart,
    SkeletonList,
    SkeletonProfile,
};
