/**
 * CustomerShipmentDetails.js
 * Customer-facing shipment details. Product/trip/vendor/driver information
 * is always shown to a customer who owns or has been associated with the
 * shipment (GET /api/customer/my-shipments is an ownership check, not a
 * tracking-permission check). Live location and the timeline are a
 * separate, explicitly-gated section: the vendor must have granted
 * tracking (Shipment.canCustomerTrack) before either is shown — this
 * screen never blocks the whole page just because tracking isn't granted
 * (Stage 8 Phases 3 & 4).
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Linking,
    RefreshControl,
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
import ThemedButton from '../../components/ThemedButton';
import { SlideInView, FadeInView } from '../../components/AnimatedComponents';
import LeafletMapView from '../../components/LeafletMapView';
import { getFreshness, formatMinutesAgo, FRESHNESS } from '../../utils/freshness';

const EVENT_LABELS = {
    SHIPMENT_CREATED: { label: 'Shipment Created', icon: '📝' },
    DRIVER_ASSIGNED: { label: 'Driver Assigned', icon: '🚚' },
    DRIVER_ACCEPTED: { label: 'Driver Accepted', icon: '✅' },
    DRIVER_REJECTED: { label: 'Driver Rejected', icon: '⚠️' },
    DELIVERY_STARTED: { label: 'Delivery Started', icon: '🛣️' },
    DELIVERY_COMPLETED: { label: 'Delivery Completed', icon: '🏁' },
};

const InfoRow = ({ icon, label, value }) => (
    <View style={styles.infoRow}>
        <Text style={styles.infoIcon}>{icon}</Text>
        <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value ?? 'N/A'}</Text>
        </View>
    </View>
);

const formatDuration = (startDate, endDate) => {
    if (!startDate || !endDate) return null;
    const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
    if (!Number.isFinite(ms) || ms <= 0) return null;
    const hours = Math.round(ms / 3600000);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? '' : 's'}`;
};

const CustomerShipmentDetails = ({ exportId, exportData, onBack }) => {
    const id = exportId || exportData?._id;

    const [details, setDetails] = useState(exportData || null);
    const [detailsError, setDetailsError] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(!exportData);
    const [refreshing, setRefreshing] = useState(false);

    // null = not yet determined, true/false = confirmed by the backend
    const [trackingAllowed, setTrackingAllowed] = useState(
        typeof exportData?.trackingAllowed === 'boolean' ? exportData.trackingAllowed : null
    );

    const [location, setLocation] = useState(null);
    const [locationChecked, setLocationChecked] = useState(false);
    const [showMap, setShowMap] = useState(false);

    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(false);
    const [eventsError, setEventsError] = useState(null);

    const pollRef = useRef(null);

    // GET /api/customer/my-shipments is the same ownership-based (not
    // tracking-based) list the "My Shipments" screen uses. Re-using it here
    // — instead of a new endpoint — is how this screen learns both the
    // authoritative trackingAllowed flag and, for a shipment reached from
    // Browse Goods (no cached trackingAllowed), whether it's even one of
    // this customer's own shipments, without any backend change.
    const resolveFromMyShipments = useCallback(async () => {
        if (!id) return;
        try {
            const res = await api.get('/api/customer/my-shipments');
            const match = (res.data || []).find((s) => s._id === id);
            if (match) {
                setDetails(match);
                setTrackingAllowed(match.trackingAllowed === true);
                setDetailsError(null);
            } else if (!details) {
                // Not one of this customer's shipments and nothing was passed
                // in from Browse Goods either — nothing safe to show.
                setDetailsError('Shipment details unavailable.');
            } else {
                // Came from Browse Goods: keep the already-safe (toCustomerView)
                // data we were handed, just confirm tracking is not granted.
                setTrackingAllowed(false);
            }
        } catch (err) {
            if (!details) {
                setDetailsError('Unable to load shipment details. Try again.');
            } else {
                // Keep showing what we already have. Fail safe: never leave
                // tracking permission stuck on "checking" — treat an
                // unconfirmed check as not-allowed rather than show live
                // tracking without a positive grant.
                setTrackingAllowed((prev) => (prev === null ? false : prev));
            }
        } finally {
            setLoadingDetails(false);
        }
    }, [id, details]);

    useEffect(() => {
        resolveFromMyShipments();
        // Intentionally only re-runs when `id` changes — resolveFromMyShipments
        // itself is stable enough for a mount-time + manual-refresh fetch.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const fetchLocation = useCallback(async () => {
        if (!id) return;
        try {
            const res = await api.get(`/api/customer/track/${id}/location`);
            setLocation(res.data?.location || null);
        } catch (err) {
            setLocation(null);
        } finally {
            setLocationChecked(true);
        }
    }, [id]);

    const fetchEvents = useCallback(async () => {
        if (!id) return;
        setEventsLoading(true);
        setEventsError(null);
        try {
            const res = await api.get(`/api/customer/track/${id}/events`);
            setEvents(res.data || []);
        } catch (err) {
            setEventsError('Unable to load shipment timeline.');
        } finally {
            setEventsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (trackingAllowed !== true) {
            setLocation(null);
            setLocationChecked(false);
            setEvents([]);
            return;
        }
        fetchLocation();
        fetchEvents();
        pollRef.current = setInterval(fetchLocation, 15000);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [trackingAllowed, fetchLocation, fetchEvents]);

    const handleRefresh = () => {
        setRefreshing(true);
        Promise.resolve(resolveFromMyShipments())
            .then(() => trackingAllowed === true && Promise.all([fetchLocation(), fetchEvents()]))
            .finally(() => setRefreshing(false));
    };

    const handleCall = (phone) => {
        if (phone) Linking.openURL(`tel:${phone}`);
    };

    if (loadingDetails) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading shipment details...</Text>
            </View>
        );
    }

    if (detailsError || !details) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.emptyIcon}>⚠️</Text>
                <Text style={styles.emptyTitle}>Couldn't load shipment</Text>
                <Text style={styles.emptySubtext}>{detailsError || 'Shipment not found.'}</Text>
                <ThemedButton title="Retry" variant="primary" onPress={resolveFromMyShipments} style={{ marginTop: spacing.lg }} />
                {onBack && (
                    <ThemedButton title="Go Back" variant="outline" onPress={onBack} style={{ marginTop: spacing.md }} />
                )}
            </View>
        );
    }

    const statusColor = getStatusColor(details.status);
    const statusBg = getStatusBgColor(details.status);
    const origin = details.routes?.[0] || 'Origin';
    const destination = details.routes?.[details.routes.length - 1] || 'Destination';
    const duration = formatDuration(details.startDate, details.endDate);
    const freshness = getFreshness(location?.timestamp);

    return (
        <View style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
                }
            >
                {/* Header */}
                <FadeInView>
                    <LinearGradient colors={gradients.forest} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerCard}>
                        <View style={styles.headerTop}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.headerLabel}>Shipment</Text>
                                <Text style={styles.itemName} numberOfLines={2}>{details.itemName}</Text>
                            </View>
                            <View style={[styles.statusChip, { backgroundColor: statusColor + '30' }]}>
                                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                                <Text style={styles.statusLabel}>{details.status}</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </FadeInView>

                {/* Shipment */}
                <SlideInView delay={100}>
                    <ThemedCard variant="elevated" style={styles.card}>
                        <Text style={styles.cardTitle}>Shipment</Text>
                        <InfoRow icon="📦" label="Product" value={details.itemName} />
                        <InfoRow icon="📊" label="Quantity" value={`${details.quantity ?? '-'} ${details.unit || ''}`.trim()} />
                        <InfoRow icon="🏷️" label="Status" value={details.status} />
                        <InfoRow
                            icon="🕒"
                            label="Created"
                            value={details.createdAt ? new Date(details.createdAt).toLocaleString() : null}
                        />
                    </ThemedCard>
                </SlideInView>

                {/* Trip */}
                <SlideInView delay={150}>
                    <ThemedCard variant="elevated" style={styles.card}>
                        <Text style={styles.cardTitle}>Trip</Text>
                        <InfoRow icon="🟢" label="Pickup" value={origin} />
                        <InfoRow icon="🔴" label="Destination" value={destination} />
                        <InfoRow
                            icon="📅"
                            label="Expected Drop Time"
                            value={details.expectedDropTime ? new Date(details.expectedDropTime).toLocaleString() : 'Not set'}
                        />
                        {duration && <InfoRow icon="⏱️" label="Trip Duration" value={duration} />}
                    </ThemedCard>
                </SlideInView>

                {/* Vendor */}
                <SlideInView delay={200}>
                    <ThemedCard variant="elevated" style={styles.card}>
                        <Text style={styles.cardTitle}>Vendor</Text>
                        <InfoRow icon="🏪" label="Name" value={details.vendorId?.name} />
                        {details.vendorId?.mobileNo && (
                            <TouchableOpacity onPress={() => handleCall(details.vendorId.mobileNo)}>
                                <InfoRow icon="📞" label="Contact" value={details.vendorId.mobileNo} />
                            </TouchableOpacity>
                        )}
                    </ThemedCard>
                </SlideInView>

                {/* Driver */}
                {details.driver && (
                    <SlideInView delay={250}>
                        <ThemedCard variant="elevated" style={styles.card}>
                            <Text style={styles.cardTitle}>Driver</Text>
                            <InfoRow icon="🚚" label="Name" value={details.driver?.name} />
                            {details.driver?.mobileNo && (
                                <TouchableOpacity onPress={() => handleCall(details.driver.mobileNo)}>
                                    <InfoRow icon="📞" label="Contact" value={details.driver.mobileNo} />
                                </TouchableOpacity>
                            )}
                            {details.vehicle?.vehicleNumber && (
                                <InfoRow icon="🚗" label="Vehicle" value={details.vehicle.vehicleNumber} />
                            )}
                        </ThemedCard>
                    </SlideInView>
                )}

                {/* Tracking */}
                <SlideInView delay={300}>
                    <ThemedCard variant="elevated" style={styles.card}>
                        <Text style={styles.cardTitle}>Tracking</Text>

                        {trackingAllowed === null ? (
                            <View style={styles.trackingRow}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text style={styles.trackingCheckingText}>Checking tracking availability...</Text>
                            </View>
                        ) : trackingAllowed === false ? (
                            <View>
                                <Text style={styles.trackingDeniedIcon}>🔒</Text>
                                <Text style={styles.trackingDeniedText}>
                                    Tracking has not been enabled for this shipment.
                                </Text>
                            </View>
                        ) : (
                            <View>
                                <Text style={styles.trackingAvailableText}>
                                    Live shipment tracking is available.
                                </Text>

                                {!locationChecked ? (
                                    <View style={styles.trackingRow}>
                                        <ActivityIndicator size="small" color={colors.primary} />
                                        <Text style={styles.trackingCheckingText}>Checking vehicle location...</Text>
                                    </View>
                                ) : !location ? (
                                    <Text style={styles.trackingUnavailableText}>
                                        Vehicle location is currently unavailable.
                                    </Text>
                                ) : (
                                    <View>
                                        <View style={styles.freshnessRow}>
                                            <View
                                                style={[
                                                    styles.freshnessDot,
                                                    {
                                                        backgroundColor:
                                                            freshness.status === FRESHNESS.RECENT ? colors.success : colors.warning,
                                                    },
                                                ]}
                                            />
                                            <Text style={styles.freshnessText}>
                                                {freshness.status === FRESHNESS.RECENT ? 'Live' : 'Stale'} — last update{' '}
                                                {formatMinutesAgo(freshness.minutesAgo)}
                                            </Text>
                                        </View>

                                        <ThemedButton
                                            title={showMap ? 'Hide Live Location' : 'View Live Location'}
                                            variant={showMap ? 'outline' : 'primary'}
                                            onPress={() => setShowMap((v) => !v)}
                                            style={{ marginTop: spacing.md }}
                                        />

                                        {showMap && (
                                            <View style={styles.mapContainer}>
                                                <LeafletMapView
                                                    center={{ lat: location.latitude, lng: location.longitude }}
                                                    zoom={12}
                                                    markers={[
                                                        { lat: location.latitude, lng: location.longitude, color: '#007AFF', label: '🚚', popup: 'Vehicle' },
                                                        ...(details.endLocation
                                                            ? [{ lat: details.endLocation.latitude, lng: details.endLocation.longitude, color: '#dc3545', label: '🏁', popup: 'Destination' }]
                                                            : []),
                                                    ]}
                                                />
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>
                        )}
                    </ThemedCard>
                </SlideInView>

                {/* Timeline */}
                <SlideInView delay={350}>
                    <ThemedCard variant="elevated" style={styles.card}>
                        <Text style={styles.cardTitle}>Timeline</Text>

                        {trackingAllowed !== true ? (
                            <Text style={styles.trackingUnavailableText}>
                                Timeline is available once tracking is enabled.
                            </Text>
                        ) : eventsLoading ? (
                            <View style={styles.trackingRow}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text style={styles.trackingCheckingText}>Loading timeline...</Text>
                            </View>
                        ) : eventsError ? (
                            <Text style={styles.trackingUnavailableText}>{eventsError}</Text>
                        ) : events.length === 0 ? (
                            <Text style={styles.trackingUnavailableText}>No timeline events yet.</Text>
                        ) : (
                            events.map((ev, index) => {
                                const meta = EVENT_LABELS[ev.eventType] || { label: ev.eventType, icon: '•' };
                                return (
                                    <View key={`${ev.eventType}-${ev.timestamp}`} style={styles.timelineRow}>
                                        <View style={styles.timelineIconWrap}>
                                            <Text style={styles.timelineIcon}>{meta.icon}</Text>
                                            {index < events.length - 1 && <View style={styles.timelineConnector} />}
                                        </View>
                                        <View style={styles.timelineTextWrap}>
                                            <Text style={styles.timelineLabel}>{meta.label}</Text>
                                            <Text style={styles.timelineTime}>
                                                {ev.timestamp ? new Date(ev.timestamp).toLocaleString() : ''}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </ThemedCard>
                </SlideInView>

                <View style={styles.bottomPadding} />
            </ScrollView>
        </View>
    );
};

export default CustomerShipmentDetails;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.primary },
    scrollView: { flex: 1 },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
        backgroundColor: colors.background.primary,
    },
    loadingText: { ...typography.body, color: colors.text.muted, marginTop: spacing.md },
    emptyIcon: { fontSize: 56, marginBottom: spacing.md },
    emptyTitle: { ...typography.h3, color: colors.text.primary, marginBottom: spacing.sm },
    emptySubtext: { ...typography.body, color: colors.text.muted, textAlign: 'center' },
    headerCard: {
        margin: spacing.md,
        padding: spacing.lg,
        borderRadius: borderRadius.xl,
        ...shadows.lg,
    },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    headerLabel: {
        ...typography.caption,
        color: 'rgba(255, 255, 255, 0.7)',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    itemName: { ...typography.h2, color: colors.text.light, marginTop: spacing.xs },
    statusChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.round,
        marginLeft: spacing.sm,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
    statusLabel: { ...typography.captionMedium, textTransform: 'uppercase', color: '#fff' },
    card: { marginHorizontal: spacing.md, marginBottom: spacing.md },
    cardTitle: { ...typography.h4, color: colors.text.primary, marginBottom: spacing.md },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
    },
    infoIcon: { fontSize: 18, marginRight: spacing.md },
    infoContent: { flex: 1 },
    infoLabel: { ...typography.caption, color: colors.text.muted },
    infoValue: { ...typography.body, color: colors.text.primary, marginTop: 2 },
    trackingRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
    trackingCheckingText: { ...typography.bodySmall, color: colors.text.muted, marginLeft: spacing.sm },
    trackingDeniedIcon: { fontSize: 32, marginBottom: spacing.sm },
    trackingDeniedText: { ...typography.body, color: colors.text.secondary },
    trackingAvailableText: { ...typography.body, color: colors.success, fontWeight: '600' },
    trackingUnavailableText: { ...typography.body, color: colors.text.muted, marginTop: spacing.sm },
    freshnessRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
    freshnessDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
    freshnessText: { ...typography.bodySmall, color: colors.text.secondary },
    mapContainer: {
        height: 260,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        marginTop: spacing.md,
    },
    timelineRow: { flexDirection: 'row' },
    timelineIconWrap: { alignItems: 'center', width: 32 },
    timelineIcon: { fontSize: 18 },
    timelineConnector: { flex: 1, width: 2, backgroundColor: colors.border.light, marginVertical: spacing.xs },
    timelineTextWrap: { flex: 1, paddingLeft: spacing.md, paddingBottom: spacing.md },
    timelineLabel: { ...typography.bodyMedium, color: colors.text.primary },
    timelineTime: { ...typography.caption, color: colors.text.muted, marginTop: 2 },
    bottomPadding: { height: spacing.xxl },
});
