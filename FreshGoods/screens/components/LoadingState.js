/**
 * LoadingState - Reusable loading, empty, and error state components
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../theme';

/**
 * Loading spinner with optional message
 */
export const LoadingSpinner = ({ message = 'Loading...', size = 'large' }) => (
    <View style={styles.container}>
        <ActivityIndicator size={size} color={colors.primary} />
        {message && <Text style={styles.loadingText}>{message}</Text>}
    </View>
);

/**
 * Empty state with icon and message
 */
export const EmptyState = ({
    icon = '📭',
    title = 'No Data',
    message = 'Nothing to show here',
    actionLabel,
    onAction
}) => (
    <View style={styles.container}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {actionLabel && onAction && (
            <TouchableOpacity style={styles.actionButton} onPress={onAction}>
                <Text style={styles.actionText}>{actionLabel}</Text>
            </TouchableOpacity>
        )}
    </View>
);

/**
 * Error state with retry option
 */
export const ErrorState = ({
    message = 'Something went wrong',
    onRetry
}) => (
    <View style={styles.container}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.message}>{message}</Text>
        {onRetry && (
            <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
                <Text style={styles.retryText}>Try Again</Text>
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
    loadingText: {
        ...typography.body,
        color: colors.text.secondary,
        marginTop: spacing.md,
    },
    icon: {
        fontSize: 64,
        marginBottom: spacing.md,
    },
    title: {
        ...typography.h3,
        color: colors.text.dark,
        marginBottom: spacing.xs,
    },
    errorTitle: {
        ...typography.h3,
        color: colors.error,
        marginBottom: spacing.xs,
    },
    message: {
        ...typography.body,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    actionButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.round,
    },
    actionText: {
        ...typography.button,
        color: colors.text.light,
    },
    retryButton: {
        backgroundColor: colors.error,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.round,
    },
    retryText: {
        ...typography.button,
        color: colors.text.light,
    },
});

export default { LoadingSpinner, EmptyState, ErrorState };
