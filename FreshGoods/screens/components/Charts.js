/**
 * Charts.js
 * Custom chart components without external dependencies
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
    colors,
    gradients,
    spacing,
    borderRadius,
    typography,
} from '../theme';

// ═══════════════════════════════════════════════════════════════════
// BAR CHART COMPONENT
// ═══════════════════════════════════════════════════════════════════
export const BarChart = ({
    data = [],
    height = 200,
    barWidth = 30,
    spacing: barSpacing = 16,
    showLabels = true,
    showValues = true,
    animated = true,
}) => {
    const maxValue = Math.max(...data.map((d) => d.value), 1);
    const animatedValues = useRef(data.map(() => new Animated.Value(0))).current;

    useEffect(() => {
        if (animated) {
            const animations = animatedValues.map((anim, index) =>
                Animated.timing(anim, {
                    toValue: data[index]?.value || 0,
                    duration: 800,
                    delay: index * 100,
                    useNativeDriver: false,
                })
            );
            Animated.parallel(animations).start();
        }
    }, [data, animated]);

    return (
        <View style={[styles.barChartContainer, { height }]}>
            {/* Y-axis labels */}
            <View style={styles.yAxis}>
                <Text style={styles.axisLabel}>{maxValue}</Text>
                <Text style={styles.axisLabel}>{Math.round(maxValue / 2)}</Text>
                <Text style={styles.axisLabel}>0</Text>
            </View>

            {/* Bars */}
            <View style={styles.barsContainer}>
                {data.map((item, index) => {
                    const barHeight = animated
                        ? animatedValues[index].interpolate({
                            inputRange: [0, maxValue],
                            outputRange: [0, height - 40],
                        })
                        : ((item.value / maxValue) * (height - 40));

                    return (
                        <View key={index} style={[styles.barWrapper, { marginHorizontal: barSpacing / 2 }]}>
                            <View style={styles.barBackground}>
                                <Animated.View
                                    style={[
                                        styles.bar,
                                        {
                                            width: barWidth,
                                            height: barHeight,
                                            backgroundColor: item.color || colors.primary,
                                        },
                                    ]}
                                >
                                    {showValues && (
                                        <Text style={styles.barValue}>{item.value}</Text>
                                    )}
                                </Animated.View>
                            </View>
                            {showLabels && (
                                <Text style={styles.barLabel} numberOfLines={1}>
                                    {item.label}
                                </Text>
                            )}
                        </View>
                    );
                })}
            </View>
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════
// HORIZONTAL BAR CHART
// ═══════════════════════════════════════════════════════════════════
export const HorizontalBarChart = ({
    data = [],
    barHeight = 24,
    animated = true,
}) => {
    const maxValue = Math.max(...data.map((d) => d.value), 1);
    const animatedValues = useRef(data.map(() => new Animated.Value(0))).current;

    useEffect(() => {
        if (animated) {
            const animations = animatedValues.map((anim, index) =>
                Animated.timing(anim, {
                    toValue: (data[index]?.value / maxValue) * 100,
                    duration: 800,
                    delay: index * 100,
                    useNativeDriver: false,
                })
            );
            Animated.parallel(animations).start();
        }
    }, [data, animated]);

    return (
        <View style={styles.horizontalContainer}>
            {data.map((item, index) => (
                <View key={index} style={styles.horizontalRow}>
                    <Text style={styles.horizontalLabel} numberOfLines={1}>
                        {item.label}
                    </Text>
                    <View style={styles.horizontalBarBg}>
                        <Animated.View
                            style={[
                                styles.horizontalBar,
                                {
                                    height: barHeight,
                                    width: animated
                                        ? animatedValues[index].interpolate({
                                            inputRange: [0, 100],
                                            outputRange: ['0%', '100%'],
                                        })
                                        : `${(item.value / maxValue) * 100}%`,
                                    backgroundColor: item.color || colors.primary,
                                },
                            ]}
                        />
                    </View>
                    <Text style={styles.horizontalValue}>{item.value}</Text>
                </View>
            ))}
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════
// PROGRESS RING
// ═══════════════════════════════════════════════════════════════════
export const ProgressRing = ({
    progress = 0,
    size = 120,
    strokeWidth = 10,
    color = colors.primary,
    label = '',
    animated = true,
}) => {
    const animatedProgress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (animated) {
            Animated.timing(animatedProgress, {
                toValue: progress,
                duration: 1000,
                useNativeDriver: false,
            }).start();
        }
    }, [progress, animated]);

    const displayProgress = animated ? animatedProgress : progress;

    return (
        <View style={[styles.ringContainer, { width: size, height: size }]}>
            {/* Background ring */}
            <View
                style={[
                    styles.ringBackground,
                    {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        borderWidth: strokeWidth,
                    },
                ]}
            />
            {/* Progress indicator */}
            <View style={styles.ringContent}>
                <Text style={styles.ringValue}>{Math.round(progress)}%</Text>
                {label && <Text style={styles.ringLabel}>{label}</Text>}
            </View>
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════
// PIE CHART (SIMPLIFIED)
// ═══════════════════════════════════════════════════════════════════
export const SimplePieChart = ({ data = [], size = 150 }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);

    return (
        <View style={styles.pieContainer}>
            <View style={[styles.pie, { width: size, height: size }]}>
                {data.map((item, index) => {
                    const percentage = (item.value / total) * 100;
                    return (
                        <View
                            key={index}
                            style={[
                                styles.pieSegment,
                                {
                                    backgroundColor: item.color || colors.primary,
                                    width: `${percentage}%`,
                                },
                            ]}
                        />
                    );
                })}
            </View>
            {/* Legend */}
            <View style={styles.legend}>
                {data.map((item, index) => (
                    <View key={index} style={styles.legendItem}>
                        <View
                            style={[
                                styles.legendDot,
                                { backgroundColor: item.color || colors.primary },
                            ]}
                        />
                        <Text style={styles.legendLabel}>{item.label}</Text>
                        <Text style={styles.legendValue}>{item.value}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════════════════════════════
export const StatCard = ({
    title,
    value,
    subtitle,
    icon,
    trend,
    trendValue,
    color = colors.primary,
}) => (
    <View style={styles.statCard}>
        <View style={styles.statHeader}>
            <View style={[styles.statIconBg, { backgroundColor: color + '20' }]}>
                <Text style={styles.statIcon}>{icon}</Text>
            </View>
            {trend && (
                <View
                    style={[
                        styles.trendBadge,
                        { backgroundColor: trend === 'up' ? colors.successBg : colors.errorBg },
                    ]}
                >
                    <Text
                        style={[
                            styles.trendText,
                            { color: trend === 'up' ? colors.success : colors.error },
                        ]}
                    >
                        {trend === 'up' ? '↑' : '↓'} {trendValue}%
                    </Text>
                </View>
            )}
        </View>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
        {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
);

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
    // Bar Chart
    barChartContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    yAxis: {
        justifyContent: 'space-between',
        marginRight: spacing.sm,
        height: '100%',
        paddingBottom: 24,
    },
    axisLabel: {
        ...typography.caption,
        color: colors.text.muted,
        width: 30,
        textAlign: 'right',
    },
    barsContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    barWrapper: {
        alignItems: 'center',
    },
    barBackground: {
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    bar: {
        borderTopLeftRadius: borderRadius.sm,
        borderTopRightRadius: borderRadius.sm,
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    barValue: {
        ...typography.captionMedium,
        color: colors.text.light,
        marginTop: spacing.xs,
    },
    barLabel: {
        ...typography.caption,
        color: colors.text.muted,
        marginTop: spacing.xs,
        maxWidth: 50,
        textAlign: 'center',
    },

    // Horizontal Bar
    horizontalContainer: {
        flex: 1,
    },
    horizontalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    horizontalLabel: {
        ...typography.bodySmall,
        color: colors.text.secondary,
        width: 80,
    },
    horizontalBarBg: {
        flex: 1,
        height: 24,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.sm,
        overflow: 'hidden',
        marginHorizontal: spacing.sm,
    },
    horizontalBar: {
        borderRadius: borderRadius.sm,
    },
    horizontalValue: {
        ...typography.bodyMedium,
        color: colors.text.primary,
        width: 40,
        textAlign: 'right',
    },

    // Progress Ring
    ringContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    ringBackground: {
        position: 'absolute',
        borderColor: colors.border.light,
    },
    ringContent: {
        alignItems: 'center',
    },
    ringValue: {
        ...typography.h2,
        color: colors.text.primary,
    },
    ringLabel: {
        ...typography.caption,
        color: colors.text.muted,
    },

    // Pie Chart
    pieContainer: {
        alignItems: 'center',
    },
    pie: {
        flexDirection: 'row',
        borderRadius: 1000,
        overflow: 'hidden',
        marginBottom: spacing.md,
    },
    pieSegment: {
        height: '100%',
    },
    legend: {
        width: '100%',
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: spacing.sm,
    },
    legendLabel: {
        ...typography.bodySmall,
        color: colors.text.secondary,
        flex: 1,
    },
    legendValue: {
        ...typography.bodyMedium,
        color: colors.text.primary,
    },

    // Stat Card
    statCard: {
        backgroundColor: colors.background.card,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        minWidth: 140,
    },
    statHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.sm,
    },
    statIconBg: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statIcon: {
        fontSize: 20,
    },
    trendBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.round,
    },
    trendText: {
        ...typography.captionMedium,
    },
    statValue: {
        ...typography.stat,
        marginBottom: spacing.xxs,
    },
    statTitle: {
        ...typography.bodyMedium,
        color: colors.text.primary,
    },
    statSubtitle: {
        ...typography.caption,
        color: colors.text.muted,
        marginTop: 2,
    },
});

export default {
    BarChart,
    HorizontalBarChart,
    ProgressRing,
    SimplePieChart,
    StatCard,
};
