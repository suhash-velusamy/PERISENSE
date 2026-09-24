/**
 * ServiceRequestManager - Vendor service request management page
 * Features: List requests, accept/reject actions, status indicators
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Alert,
    RefreshControl,
} from 'react-native';
import api from '../../services/api';
import { LoadingSpinner, EmptyState, ErrorState } from '../../components/LoadingState';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';

const STATUS_COLORS = {
    pending: '#ffc107',
    accepted: '#28a745',
    rejected: '#dc3545',
    completed: '#17a2b8',
};

const STATUS_ICONS = {
    pending: '⏳',
    accepted: '✅',
    rejected: '❌',
    completed: '🎉',
};

const ServiceRequestManager = ({ vendorId }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const fetchRequests = useCallback(async () => {
        if (!vendorId) return;

        try {
            setError(null);
            const response = await api.get(`/api/vendor/service-requests/${vendorId}`);
            setRequests(response.data || []);
        } catch (err) {
            console.error('Failed to fetch service requests:', err);
            setError(err.message || 'Failed to load requests');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [vendorId]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchRequests();
    };

    const handleAction = async (requestId, action) => {
        const actionLabel = action === 'accept' ? 'Accept' : 'Reject';

        Alert.alert(
            `${actionLabel} Request`,
            `Are you sure you want to ${action} this request?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: actionLabel,
                    style: action === 'reject' ? 'destructive' : 'default',
                    onPress: async () => {
                        try {
                            await api.put(`/api/vendor/service-requests/${requestId}/${action}`);

                            // Update local state
                            setRequests(prev =>
                                prev.map(req =>
                                    req._id === requestId
                                        ? { ...req, status: action === 'accept' ? 'accepted' : 'rejected' }
                                        : req
                                )
                            );

                            Alert.alert('Success', `Request ${action}ed successfully`);
                        } catch (err) {
                            Alert.alert('Error', `Failed to ${action} request`);
                        }
                    },
                },
            ]
        );
    };

    const renderRequest = ({ item }) => (
        <View style={styles.card}>
            {/* Status badge */}
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] }]}>
                <Text style={styles.statusIcon}>{STATUS_ICONS[item.status]}</Text>
                <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
            </View>

            {/* Customer info */}
            <View style={styles.infoSection}>
                <Text style={styles.customerName}>
                    👤 {item.customer?.name || 'Unknown Customer'}
                </Text>
                <Text style={styles.serviceType}>
                    📋 {item.serviceType || 'General Inquiry'}
                </Text>
                <Text style={styles.message}>{item.message || 'No message provided'}</Text>
                <Text style={styles.timestamp}>
                    🕐 {new Date(item.createdAt).toLocaleDateString()} at{' '}
                    {new Date(item.createdAt).toLocaleTimeString()}
                </Text>
            </View>

            {/* Actions - only show for pending requests */}
            {item.status === 'pending' && (
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.acceptButton]}
                        onPress={() => handleAction(item._id, 'accept')}
                    >
                        <Text style={styles.actionText}>✓ Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => handleAction(item._id, 'reject')}
                    >
                        <Text style={[styles.actionText, styles.rejectText]}>✕ Reject</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    if (loading) {
        return <LoadingSpinner message="Loading service requests..." />;
    }

    if (error) {
        return <ErrorState message={error} onRetry={fetchRequests} />;
    }

    if (requests.length === 0) {
        return (
            <EmptyState
                icon="📭"
                title="No Service Requests"
                message="You don't have any service requests yet"
                actionLabel="Refresh"
                onAction={handleRefresh}
            />
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={requests}
                keyExtractor={(item) => item._id}
                renderItem={renderRequest}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={[colors.primary]}
                    />
                }
                ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
        </View>
    );
};

export default ServiceRequestManager;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    listContent: {
        padding: spacing.md,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        ...shadows.small,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.round,
        marginBottom: spacing.sm,
    },
    statusIcon: {
        fontSize: 12,
        marginRight: 4,
    },
    statusText: {
        ...typography.caption,
        color: '#fff',
        fontWeight: 'bold',
    },
    infoSection: {
        marginBottom: spacing.md,
    },
    customerName: {
        ...typography.h3,
        color: colors.text.dark,
        marginBottom: spacing.xs,
    },
    serviceType: {
        ...typography.body,
        color: colors.primary,
        marginBottom: spacing.xs,
    },
    message: {
        ...typography.body,
        color: colors.text.dark,
        marginBottom: spacing.sm,
        lineHeight: 22,
    },
    timestamp: {
        ...typography.caption,
        color: colors.text.secondary,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border.light,
        paddingTop: spacing.md,
    },
    actionButton: {
        flex: 1,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        alignItems: 'center',
    },
    acceptButton: {
        backgroundColor: colors.success,
    },
    rejectButton: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: colors.error,
    },
    actionText: {
        ...typography.button,
        color: '#fff',
    },
    rejectText: {
        color: colors.error,
    },
    separator: {
        height: spacing.md,
    },
});
