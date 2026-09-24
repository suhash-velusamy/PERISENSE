/**
 * VendorExportDashboard.js
 * Enhanced export management dashboard with filter tabs and status updates
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
    Modal,
    Switch,
    ScrollView,
    Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import ThemedButton from '../../components/ThemedButton';
import {
    SlideInView,
    FadeInView,
    AnimatedCounter,
} from '../../components/AnimatedComponents';
import ExportLocationView from './vendorHomeComponents/exportLocationView';
import MonitorHealthView from './vendorHomeComponents/monitorHealthView';
import { getFreshness, formatMinutesAgo, FRESHNESS } from '../../utils/freshness';
import { getConditionMeta, getRiskLabel } from '../../utils/condition';
import CreateRescueSaleModal from './vendorHomeComponents/CreateRescueSaleModal';

const EVENT_LABELS = {
    SHIPMENT_CREATED: 'Shipment created',
    DRIVER_ASSIGNED: 'Driver assigned',
    DRIVER_ACCEPTED: 'Driver accepted',
    DRIVER_REJECTED: 'Driver rejected',
    DELIVERY_STARTED: 'Delivery started',
    DELIVERY_COMPLETED: 'Delivery completed',
    SHIPMENT_CANCELLED: 'Shipment cancelled',
    SHIPMENT_STATUS_CHANGED: 'Status changed',
};

// ═══════════════════════════════════════════════════════════════════
// FILTER TAB COMPONENT
// ═══════════════════════════════════════════════════════════════════
const FilterTab = ({ label, isActive, onPress, count, color }) => (
    <TouchableOpacity
        style={[
            styles.filterTab,
            isActive && { backgroundColor: color, borderColor: color },
        ]}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
            {label}
        </Text>
        <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
            <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>
                {count}
            </Text>
        </View>
    </TouchableOpacity>
);

// ═══════════════════════════════════════════════════════════════════
// EXPORT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════
const ExportCard = ({ item, onStart, onComplete, onOpenDetails, index }) => {
    const statusColor = getStatusColor(item.status);
    const statusBg = getStatusBgColor(item.status);
    const canStart = item.status === 'ACCEPTED';
    const canComplete = item.status === 'IN_TRANSIT';

    return (
        <SlideInView delay={index * 80}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => onOpenDetails(item)}>
                <ThemedCard variant="elevated" style={styles.exportCard}>
                    {/* Header */}
                    <View style={styles.cardHeader}>
                        <View style={styles.cardTitleSection}>
                            <Text style={styles.cardTitle}>📦 {item.itemName}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                                <Text style={[styles.statusText, { color: statusColor }]}>
                                    {item.status}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Info Grid */}
                    <View style={styles.infoGrid}>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Driver</Text>
                            <Text style={styles.infoValue}>{item.driver?.name || 'N/A'}</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Vehicle</Text>
                            <Text style={styles.infoValue}>{item.vehicle?.vehicleNumber || 'N/A'}</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Quantity</Text>
                            <Text style={styles.infoValue}>{item.quantity} {item.unit || ''}</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>End Date</Text>
                            <Text style={styles.infoValue}>
                                {new Date(item.endDate).toLocaleDateString()}
                            </Text>
                        </View>
                    </View>

                    {/* Route Preview */}
                    {item.routes && item.routes.length > 0 && (
                        <View style={styles.routePreview}>
                            <Text style={styles.routeIcon}>🛣️</Text>
                            <Text style={styles.routeText} numberOfLines={1}>
                                {item.routes[0]} → {item.routes[item.routes.length - 1]}
                            </Text>
                        </View>
                    )}

                    {/* Rejection reason */}
                    {item.status === 'REJECTED' && item.rejectionReason && (
                        <View style={styles.rejectionBox}>
                            <Text style={styles.rejectionLabel}>✕ Rejected by driver</Text>
                            <Text style={styles.rejectionText}>{item.rejectionReason}</Text>
                        </View>
                    )}

                    {/* Action Buttons */}
                    <View style={styles.cardActions}>
                        {canStart && (
                            <ThemedButton
                                title="Start Delivery"
                                variant="success"
                                size="small"
                                icon="🚀"
                                onPress={() => onStart(item)}
                                style={styles.actionBtn}
                            />
                        )}
                        {canComplete && (
                            <ThemedButton
                                title="Mark Complete"
                                variant="primary"
                                size="small"
                                icon="✅"
                                onPress={() => onComplete(item)}
                                style={styles.actionBtn}
                            />
                        )}
                        {!canStart && !canComplete && (
                            <View style={styles.statusInfo}>
                                <Text style={styles.statusInfoText}>
                                    {item.status === 'ASSIGNED'
                                        ? 'Waiting for driver acceptance'
                                        : item.status === 'COMPLETED'
                                            ? 'Delivery completed'
                                            : item.status === 'REJECTED'
                                                ? 'Rejected — reassign or delete to retry'
                                                : 'No action available'}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.detailsHint}>Tap for details, tracking permissions & timeline →</Text>
                </ThemedCard>
            </TouchableOpacity>
        </SlideInView>
    );
};

// ═══════════════════════════════════════════════════════════════════
// SHIPMENT DETAILS MODAL — full field set, tracking permissions, timeline
// ═══════════════════════════════════════════════════════════════════
const ShipmentDetailsModal = ({ item, onClose, onViewLocation, onChatWithDriver }) => {
    const [customers, setCustomers] = useState([]);
    const [permissions, setPermissions] = useState({}); // customerId -> boolean
    const [savingPermissions, setSavingPermissions] = useState(false);
    const [loadingCustomers, setLoadingCustomers] = useState(true);
    const [events, setEvents] = useState([]);
    const [loadingEvents, setLoadingEvents] = useState(true);
    const [latestReading, setLatestReading] = useState(undefined); // undefined = loading, null = none found
    const [showFullIoT, setShowFullIoT] = useState(false);
    const [condition, setCondition] = useState(undefined); // undefined = loading, null = unavailable
    const [showCreateRescueSale, setShowCreateRescueSale] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get('/chat/customers/get');
                setCustomers(res.data || []);
                const initial = {};
                (item.trackingViewers || []).forEach((v) => {
                    const id = v.customer?._id || v.customer;
                    initial[id] = v.allowed;
                });
                setPermissions(initial);
            } catch (err) {
                console.error('Failed to load customers:', err);
            } finally {
                setLoadingCustomers(false);
            }
        })();

        (async () => {
            try {
                const res = await api.get(`/api/vendor/export/${item._id}/events`);
                setEvents(res.data || []);
            } catch (err) {
                console.error('Failed to load shipment events:', err);
            } finally {
                setLoadingEvents(false);
            }
        })();

        // Only shipments with a linked device can have sensor readings at all.
        if (!item.device) {
            setLatestReading(null);
            setCondition(null);
        } else {
            (async () => {
                try {
                    const res = await api.get(`/api/vendor/device/sensor-data/${item._id}`);
                    const readings = res.data || [];
                    setLatestReading(readings.length > 0 ? readings[readings.length - 1] : null);
                } catch (err) {
                    console.error('Failed to load IoT summary:', err);
                    setLatestReading(null);
                }
            })();

            (async () => {
                try {
                    const res = await api.get(`/api/vendor/device/condition/${item._id}`);
                    setCondition(res.data);
                } catch (err) {
                    console.error('Failed to load condition status:', err);
                    setCondition(null);
                }
            })();
        }
    }, [item._id]);

    const savePermissions = async () => {
        setSavingPermissions(true);
        try {
            const viewers = Object.entries(permissions)
                .filter(([, allowed]) => allowed !== undefined)
                .map(([customerId, allowed]) => ({ customerId, allowed }));

            const before = {};
            (item.trackingViewers || []).forEach((v) => {
                before[v.customer?._id || v.customer] = v.allowed;
            });
            const granted = viewers.filter((v) => v.allowed && !before[v.customerId]).length;
            const revoked = viewers.filter((v) => !v.allowed && before[v.customerId]).length;

            await api.put(`/api/vendor/export/${item._id}/tracking-permissions`, { viewers });

            if (granted > 0 && revoked > 0) {
                Alert.alert('Saved', `Tracking access granted for ${granted}, revoked for ${revoked}.`);
            } else if (granted > 0) {
                Alert.alert('Tracking access granted.');
            } else if (revoked > 0) {
                Alert.alert('Tracking access revoked.');
            } else {
                Alert.alert('Saved', 'No changes to tracking permissions.');
            }
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to update tracking permissions. Please try again.');
        } finally {
            setSavingPermissions(false);
        }
    };

    const canViewLocation = item.status === 'IN_TRANSIT' || item.status === 'COMPLETED';

    const handleCallDriver = () => {
        if (item.driver?.mobileNo) {
            Linking.openURL(`tel:${item.driver.mobileNo}`);
        }
    };

    if (showFullIoT) {
        return (
            <Modal visible animationType="slide" onRequestClose={() => setShowFullIoT(false)}>
                <MonitorHealthView selectedExport={item} onBack={() => setShowFullIoT(false)} />
            </Modal>
        );
    }

    return (
        <Modal visible animationType="slide" onRequestClose={onClose}>
            <View style={styles.detailsModalContainer}>
                <LinearGradient colors={gradients.forest} style={styles.detailsModalHeader}>
                    <TouchableOpacity onPress={onClose}>
                        <Text style={styles.modalCloseText}>✕</Text>
                    </TouchableOpacity>
                    <Text style={styles.detailsModalTitle}>{item.itemName}</Text>
                    <View style={{ width: 24 }} />
                </LinearGradient>

                <ScrollView style={styles.detailsScroll}>
                    {/* Shipment */}
                    <Text style={styles.detailsSectionTitle}>Shipment</Text>
                    <ThemedCard variant="outlined" style={styles.detailsCard}>
                        <DetailRow label="Product" value={item.itemName} />
                        <DetailRow label="Quantity" value={`${item.quantity} ${item.unit || ''}`.trim()} />
                        <DetailRow label="Status" value={item.status} />
                        <DetailRow label="Created" value={item.createdAt ? new Date(item.createdAt).toLocaleString() : 'N/A'} />
                        {item.status === 'REJECTED' && (
                            <DetailRow label="Rejection Reason" value={item.rejectionReason || 'No reason given'} />
                        )}
                    </ThemedCard>

                    {/* Trip */}
                    <Text style={styles.detailsSectionTitle}>Trip</Text>
                    <ThemedCard variant="outlined" style={styles.detailsCard}>
                        <DetailRow
                            label="Start Location"
                            value={`${item.startLocation?.latitude?.toFixed(4)}, ${item.startLocation?.longitude?.toFixed(4)}`}
                        />
                        <DetailRow
                            label="Destination"
                            value={`${item.endLocation?.latitude?.toFixed(4)}, ${item.endLocation?.longitude?.toFixed(4)}`}
                        />
                        <DetailRow
                            label="Trip Duration"
                            value={`${new Date(item.startDate).toLocaleDateString()} → ${new Date(item.endDate).toLocaleDateString()}`}
                        />
                        <DetailRow
                            label="Expected Drop Time"
                            value={item.expectedDropTime ? new Date(item.expectedDropTime).toLocaleString() : 'Not set'}
                        />
                        {item.instructions && <DetailRow label="Instructions" value={item.instructions} />}
                    </ThemedCard>

                    {/* Driver */}
                    <Text style={styles.detailsSectionTitle}>Driver</Text>
                    <ThemedCard variant="outlined" style={styles.detailsCard}>
                        <DetailRow label="Name" value={item.driver?.name || 'Unassigned'} />
                        {item.driver?.mobileNo && <DetailRow label="Contact" value={item.driver.mobileNo} />}
                        <DetailRow
                            label="Assignment"
                            value={item.driver ? 'Assigned' : (item.status === 'REJECTED' ? 'Unassigned (rejected)' : 'Unassigned')}
                        />
                        {item.driver && (
                            <View style={styles.driverActionsRow}>
                                {item.driver.mobileNo && (
                                    <ThemedButton
                                        title="Call"
                                        variant="outline"
                                        size="small"
                                        icon="📞"
                                        onPress={handleCallDriver}
                                        style={styles.driverActionBtn}
                                    />
                                )}
                                {onChatWithDriver && (
                                    <ThemedButton
                                        title="Message"
                                        variant="primary"
                                        size="small"
                                        icon="💬"
                                        onPress={() => onChatWithDriver(item.driver._id, item.driver.name)}
                                        style={styles.driverActionBtn}
                                    />
                                )}
                            </View>
                        )}
                    </ThemedCard>

                    {/* Vehicle */}
                    <Text style={styles.detailsSectionTitle}>Vehicle</Text>
                    <ThemedCard variant="outlined" style={styles.detailsCard}>
                        <DetailRow label="Vehicle Number" value={item.vehicle?.vehicleNumber || 'N/A'} />
                        {item.vehicle?.brand && <DetailRow label="Brand" value={item.vehicle.brand} />}
                        {item.vehicle?.capacity && <DetailRow label="Capacity" value={item.vehicle.capacity} />}
                        <DetailRow label="IoT Device" value={item.device?.deviceName || 'No device linked'} />
                    </ThemedCard>

                    {/* Customer */}
                    <Text style={styles.detailsSectionTitle}>Customer</Text>
                    <ThemedCard variant="outlined" style={styles.detailsCard}>
                        <DetailRow label="Name" value={item.customer?.name || 'None assigned'} />
                        {item.customer?.mobileNo && <DetailRow label="Contact" value={item.customer.mobileNo} />}
                    </ThemedCard>

                    {/* Commercial */}
                    <Text style={styles.detailsSectionTitle}>Commercial</Text>
                    <ThemedCard variant="outlined" style={styles.detailsCard}>
                        <DetailRow label="Driver Salary" value={item.driverSalary != null ? `₹${item.driverSalary}` : 'N/A'} />
                    </ThemedCard>

                    {/* Live location */}
                    {canViewLocation && (
                        <ThemedButton
                            title="View Live Location"
                            variant="primary"
                            icon="📍"
                            onPress={() => onViewLocation(item)}
                            style={styles.detailsActionBtn}
                        />
                    )}

                    {/* IoT summary */}
                    <Text style={styles.detailsSectionTitle}>IoT Device</Text>
                    {item.device && condition && (() => {
                        const meta = getConditionMeta(condition.conditionStatus);
                        return (
                            <View style={[styles.conditionBanner, { backgroundColor: meta.bg, borderColor: meta.color }]}>
                                <View style={styles.conditionHeaderRow}>
                                    <Text style={[styles.conditionStatusText, { color: meta.color }]}>
                                        {meta.icon} {meta.label.toUpperCase()}
                                    </Text>
                                    <Text style={[styles.conditionRiskText, { color: meta.color }]}>
                                        {getRiskLabel(condition.riskStatus)}
                                    </Text>
                                </View>
                                <Text style={styles.conditionReasonText}>{condition.reason}</Text>
                                {item.status === 'IN_TRANSIT' && ['WARNING', 'CRITICAL'].includes(condition.conditionStatus) && (
                                    <ThemedButton
                                        title="Create Rescue Sale"
                                        variant="gradient"
                                        size="small"
                                        icon="🚨"
                                        onPress={() => setShowCreateRescueSale(true)}
                                        style={{ marginTop: spacing.sm }}
                                    />
                                )}
                            </View>
                        );
                    })()}
                    <ThemedCard variant="outlined" style={styles.detailsCard}>
                        {!item.device ? (
                            <Text style={styles.emptySubtext}>No IoT device linked to this shipment's vehicle.</Text>
                        ) : latestReading === undefined ? (
                            <ActivityIndicator color={colors.primary} />
                        ) : latestReading === null ? (
                            <Text style={styles.emptySubtext}>No recent sensor data available.</Text>
                        ) : (
                            <>
                                <DetailRow label="Device" value={item.device.deviceName} />
                                <DetailRow label="Temperature" value={`${latestReading.temperature}°C`} />
                                <DetailRow label="Humidity" value={`${latestReading.humidity}%`} />
                                <DetailRow label="Ethylene" value={`${latestReading.ethyleneLevel} ppm`} />
                                {(() => {
                                    const freshness = getFreshness(latestReading.timestamp);
                                    return (
                                        <DetailRow
                                            label="Last Updated"
                                            value={`${new Date(latestReading.timestamp).toLocaleTimeString()} (${freshness.status === FRESHNESS.RECENT ? 'Recent' : 'Stale'}, ${formatMinutesAgo(freshness.minutesAgo)})`}
                                        />
                                    );
                                })()}
                                <ThemedButton
                                    title="View Full Sensor History"
                                    variant="outline"
                                    size="small"
                                    onPress={() => setShowFullIoT(true)}
                                    style={styles.detailsActionBtn}
                                />
                            </>
                        )}
                    </ThemedCard>

                    {/* Tracking permissions */}
                    <Text style={styles.detailsSectionTitle}>Customer Tracking Permissions</Text>
                    <Text style={styles.detailsSectionSubtitle}>
                        Tracking is off by default. Toggle a customer on to let them see this
                        shipment's live status and location.
                    </Text>
                    <ThemedCard variant="outlined" style={styles.detailsCard}>
                        {loadingCustomers ? (
                            <ActivityIndicator color={colors.primary} />
                        ) : customers.length === 0 ? (
                            <Text style={styles.emptySubtext}>No customers found</Text>
                        ) : (
                            customers.map((c) => (
                                <View key={c._id} style={styles.permissionRow}>
                                    <Text style={styles.permissionName}>{c.name}</Text>
                                    <Switch
                                        value={!!permissions[c._id]}
                                        onValueChange={(val) =>
                                            setPermissions((p) => ({ ...p, [c._id]: val }))
                                        }
                                    />
                                </View>
                            ))
                        )}
                        <ThemedButton
                            title={savingPermissions ? 'Saving...' : 'Save Tracking Permissions'}
                            variant="gradient"
                            onPress={savePermissions}
                            disabled={savingPermissions || loadingCustomers}
                            loading={savingPermissions}
                            style={styles.detailsActionBtn}
                        />
                    </ThemedCard>

                    {/* Timeline */}
                    <Text style={styles.detailsSectionTitle}>Shipment Timeline</Text>
                    <ThemedCard variant="outlined" style={styles.detailsCard}>
                        {loadingEvents ? (
                            <ActivityIndicator color={colors.primary} />
                        ) : events.length === 0 ? (
                            <Text style={styles.emptySubtext}>No events recorded yet</Text>
                        ) : (
                            events.map((e) => (
                                <View key={e._id} style={styles.timelineRow}>
                                    <Text style={styles.timelineEventLabel}>
                                        {EVENT_LABELS[e.eventType] || e.eventType}
                                    </Text>
                                    <Text style={styles.timelineEventTime}>
                                        {new Date(e.timestamp).toLocaleString()}
                                    </Text>
                                </View>
                            ))
                        )}
                    </ThemedCard>

                    <View style={{ height: spacing.xxl }} />
                </ScrollView>
            </View>

            {showCreateRescueSale && (
                <CreateRescueSaleModal
                    shipment={item}
                    condition={condition}
                    onClose={() => setShowCreateRescueSale(false)}
                    onCreated={() => setShowCreateRescueSale(false)}
                />
            )}
        </Modal>
    );
};

const DetailRow = ({ label, value }) => (
    <View style={styles.detailRow}>
        <Text style={styles.detailRowLabel}>{label}</Text>
        <Text style={styles.detailRowValue}>{value}</Text>
    </View>
);

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
const VendorExportDashboard = ({ onChatWithDriver }) => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [exports, setExports] = useState([]);
    const [filteredExports, setFilteredExports] = useState([]);
    const [activeFilter, setActiveFilter] = useState('all');
    const [detailsItem, setDetailsItem] = useState(null);
    const [locationItem, setLocationItem] = useState(null);
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        assigned: 0,
        started: 0,
        completed: 0,
        rejected: 0,
        cancelled: 0,
    });

    const fetchExports = useCallback(async () => {
        try {
            const vendorId = await AsyncStorage.getItem('userId');
            if (!vendorId) return;

            const response = await api.get(`/api/vendor/exports/${vendorId}`);
            const data = response.data || [];
            setExports(data);
            setFilteredExports(data);

            // Calculate stats
            setStats({
                total: data.length,
                pending: data.filter((e) => e.status === 'ASSIGNED' || e.status === 'ACCEPTED').length,
                assigned: data.filter((e) => e.status === 'ASSIGNED').length,
                started: data.filter((e) => e.status === 'IN_TRANSIT').length,
                completed: data.filter((e) => e.status === 'COMPLETED').length,
                rejected: data.filter((e) => e.status === 'REJECTED').length,
                cancelled: data.filter((e) => e.status === 'CANCELLED').length,
            });
        } catch (err) {
            console.error('Error fetching exports:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchExports();
    }, [fetchExports]);

    // Apply filter
    useEffect(() => {
        if (activeFilter === 'all') {
            setFilteredExports(exports);
        } else {
            setFilteredExports(
                exports.filter((e) => e.status?.toLowerCase() === activeFilter)
            );
        }
    }, [activeFilter, exports]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchExports();
    };

    const handleStart = async (item) => {
        Alert.alert(
            'Start Delivery',
            `Are you sure you want to start delivery for "${item.itemName}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Start',
                    onPress: async () => {
                        try {
                            await api.put(`/api/vendor/export/start/${item._id}`);
                            Alert.alert('Success', 'Delivery started!');
                            fetchExports();
                        } catch (err) {
                            Alert.alert('Error', 'Failed to start delivery');
                        }
                    },
                },
            ]
        );
    };

    const handleComplete = async (item) => {
        Alert.alert(
            'Complete Delivery',
            `Mark "${item.itemName}" as completed?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Complete',
                    onPress: async () => {
                        try {
                            await api.put(`/api/vendor/export/complete/${item._id}`);
                            Alert.alert('Success', 'Delivery completed!');
                            fetchExports();
                        } catch (err) {
                            Alert.alert('Error', 'Failed to complete delivery');
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading exports...</Text>
            </View>
        );
    }

    if (locationItem) {
        return (
            <ExportLocationView
                selectedExport={locationItem}
                onBack={() => setLocationItem(null)}
            />
        );
    }

    return (
        <View style={styles.container}>
            {/* Stats Header */}
            <FadeInView>
                <LinearGradient
                    colors={gradients.forest}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.header}
                >
                    <Text style={styles.headerTitle}>Export Dashboard</Text>
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <AnimatedCounter
                                value={stats.total}
                                duration={1000}
                                style={styles.statValue}
                            />
                            <Text style={styles.statLabel}>Total</Text>
                        </View>
                        <View style={styles.statItem}>
                            <AnimatedCounter
                                value={stats.started}
                                duration={1000}
                                style={styles.statValue}
                            />
                            <Text style={styles.statLabel}>Active</Text>
                        </View>
                        <View style={styles.statItem}>
                            <AnimatedCounter
                                value={stats.completed}
                                duration={1000}
                                style={styles.statValue}
                            />
                            <Text style={styles.statLabel}>Done</Text>
                        </View>
                    </View>
                </LinearGradient>
            </FadeInView>

            {/* Filter Tabs */}
            <View style={styles.filterContainer}>
                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={[
                        { key: 'all', label: 'All', count: stats.total, color: colors.primary },
                        { key: 'assigned', label: 'Assigned', count: stats.assigned, color: colors.warning },
                        { key: 'accepted', label: 'Accepted', count: stats.pending - stats.assigned, color: colors.info },
                        { key: 'in_transit', label: 'In Transit', count: stats.started, color: colors.tertiary },
                        { key: 'completed', label: 'Completed', count: stats.completed, color: colors.success },
                        { key: 'rejected', label: 'Rejected', count: stats.rejected, color: colors.error },
                        { key: 'cancelled', label: 'Cancelled', count: stats.cancelled, color: colors.error },
                    ]}
                    renderItem={({ item }) => (
                        <FilterTab
                            label={item.label}
                            count={item.count}
                            color={item.color}
                            isActive={activeFilter === item.key}
                            onPress={() => setActiveFilter(item.key)}
                        />
                    )}
                    contentContainerStyle={styles.filterList}
                />
            </View>

            {/* Export List */}
            <FlatList
                data={filteredExports}
                keyExtractor={(item) => item._id}
                renderItem={({ item, index }) => (
                    <ExportCard
                        item={item}
                        index={index}
                        onStart={handleStart}
                        onComplete={handleComplete}
                        onOpenDetails={setDetailsItem}
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
                        <Text style={styles.emptyIcon}>📭</Text>
                        <Text style={styles.emptyTitle}>No Exports Found</Text>
                        <Text style={styles.emptySubtext}>
                            {activeFilter !== 'all'
                                ? 'Try selecting a different filter'
                                : 'Create a new export to get started'}
                        </Text>
                    </FadeInView>
                }
            />

            {detailsItem && (
                <ShipmentDetailsModal
                    item={detailsItem}
                    onClose={() => setDetailsItem(null)}
                    onViewLocation={(item) => {
                        setDetailsItem(null);
                        setLocationItem(item);
                    }}
                    onChatWithDriver={onChatWithDriver}
                />
            )}
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
    rejectionBox: {
        backgroundColor: colors.errorBg,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        marginBottom: spacing.md,
    },
    rejectionLabel: {
        ...typography.captionMedium,
        color: colors.error,
    },
    rejectionText: {
        ...typography.bodySmall,
        color: colors.text.secondary,
        marginTop: 2,
    },
    detailsHint: {
        ...typography.caption,
        color: colors.text.muted,
        textAlign: 'center',
        marginTop: spacing.sm,
    },
    detailsModalContainer: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    detailsModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.lg,
        paddingTop: spacing.xl,
    },
    modalCloseText: {
        fontSize: 20,
        color: colors.text.light,
        fontWeight: 'bold',
    },
    detailsModalTitle: {
        ...typography.h3,
        color: colors.text.light,
        flex: 1,
        textAlign: 'center',
    },
    detailsScroll: {
        flex: 1,
        padding: spacing.md,
    },
    driverActionsRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    driverActionBtn: {
        flex: 1,
    },
    detailsSectionTitle: {
        ...typography.bodyMedium,
        color: colors.text.primary,
        marginTop: spacing.md,
        marginBottom: spacing.xs,
    },
    detailsSectionSubtitle: {
        ...typography.caption,
        color: colors.text.muted,
        marginBottom: spacing.sm,
    },
    detailsCard: {
        marginBottom: spacing.md,
    },
    conditionBanner: {
        borderRadius: borderRadius.md || 12,
        borderWidth: 1,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    conditionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    conditionStatusText: {
        fontSize: 15,
        fontWeight: '700',
    },
    conditionRiskText: {
        fontSize: 12,
        fontWeight: '700',
    },
    conditionReasonText: {
        marginTop: 6,
        fontSize: 13,
        color: colors.text.secondary || '#444',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
    },
    detailRowLabel: {
        ...typography.bodySmall,
        color: colors.text.muted,
    },
    detailRowValue: {
        ...typography.bodySmall,
        color: colors.text.primary,
        flex: 1,
        textAlign: 'right',
        marginLeft: spacing.md,
    },
    detailsActionBtn: {
        marginTop: spacing.md,
    },
    permissionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
    },
    permissionName: {
        ...typography.body,
        color: colors.text.primary,
    },
    timelineRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.xs,
    },
    timelineEventLabel: {
        ...typography.bodySmall,
        color: colors.text.primary,
    },
    timelineEventTime: {
        ...typography.caption,
        color: colors.text.muted,
    },
    loadingText: {
        ...typography.body,
        color: colors.text.muted,
        marginTop: spacing.md,
    },
    header: {
        padding: spacing.lg,
        paddingBottom: spacing.xl,
    },
    headerTitle: {
        ...typography.h2,
        color: colors.text.light,
        marginBottom: spacing.md,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        ...typography.h1,
        color: colors.text.light,
    },
    statLabel: {
        ...typography.caption,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: spacing.xxs,
    },
    filterContainer: {
        marginTop: -spacing.md,
        marginBottom: spacing.sm,
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
        backgroundColor: colors.background.card,
        borderWidth: 1,
        borderColor: colors.border.light,
        ...shadows.sm,
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
    listContent: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.xxl,
    },
    exportCard: {
        marginBottom: spacing.md,
    },
    cardHeader: {
        marginBottom: spacing.md,
    },
    cardTitleSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardTitle: {
        ...typography.h4,
        color: colors.primary,
        flex: 1,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.round,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: spacing.xs,
    },
    statusText: {
        ...typography.captionMedium,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: spacing.md,
    },
    infoItem: {
        width: '50%',
        paddingVertical: spacing.xs,
    },
    infoLabel: {
        ...typography.caption,
        color: colors.text.muted,
    },
    infoValue: {
        ...typography.bodyMedium,
        color: colors.text.primary,
        marginTop: 2,
    },
    routePreview: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
    },
    routeIcon: {
        fontSize: 14,
        marginRight: spacing.sm,
    },
    routeText: {
        ...typography.bodySmall,
        color: colors.text.secondary,
        flex: 1,
    },
    cardActions: {
        borderTopWidth: 1,
        borderTopColor: colors.border.light,
        paddingTop: spacing.md,
    },
    actionBtn: {
        flex: 1,
    },
    statusInfo: {
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    statusInfoText: {
        ...typography.bodySmall,
        color: colors.text.muted,
        fontStyle: 'italic',
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
    },
});

export default VendorExportDashboard;
