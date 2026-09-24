import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../theme';

/**
 * Loading state component - shows spinner with optional message
 */
export const LoadingState = ({ message = 'Loading...' }) => (
    <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{message}</Text>
    </View>
);

/**
 * Error state component - shows error with retry button
 */
export const ErrorState = ({ message = 'Something went wrong', onRetry }) => (
    <View style={styles.container}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{message}</Text>
        {onRetry && (
            <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
                <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
        )}
    </View>
);

/**
 * Empty state component - shows when no data available
 */
export const EmptyState = ({
    icon = '📭',
    title = 'No data found',
    message = 'There is nothing to display here yet.',
    action,
    actionText = 'Add New'
}) => (
    <View style={styles.container}>
        <Text style={styles.emptyIcon}>{icon}</Text>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyMessage}>{message}</Text>
        {action && (
            <TouchableOpacity style={styles.actionButton} onPress={action}>
                <Text style={styles.actionText}>{actionText}</Text>
            </TouchableOpacity>
        )}
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },

    // Loading styles
    loadingText: {
        marginTop: spacing.md,
        ...typography.body,
        color: colors.text.dark,
    },

    // Error styles
    errorIcon: {
        fontSize: 48,
        marginBottom: spacing.md,
    },
    errorText: {
        ...typography.body,
        color: colors.error,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    retryButton: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.round,
    },
    retryText: {
        ...typography.button,
        color: colors.text.light,
    },

    // Empty styles
    emptyIcon: {
        fontSize: 64,
        marginBottom: spacing.md,
    },
    emptyTitle: {
        ...typography.h3,
        color: colors.text.dark,
        marginBottom: spacing.sm,
    },
    emptyMessage: {
        ...typography.body,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    actionButton: {
        backgroundColor: colors.secondary,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.round,
    },
    actionText: {
        ...typography.button,
        color: colors.text.light,
    },
});
