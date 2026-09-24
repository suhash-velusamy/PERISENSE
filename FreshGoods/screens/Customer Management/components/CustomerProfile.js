/**
 * CustomerProfile.js
 * Full profile management screen with stats, settings, and account info
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    RefreshControl,
    ActivityIndicator,
    Alert,
    Switch,
    Animated,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import api from '../../services/api';
import { useAuth } from '../../../navigation/AuthContext';
import {
    colors,
    gradients,
    spacing,
    borderRadius,
    typography,
    shadows,
} from '../../theme';
import ThemedCard from '../../components/ThemedCard';
import ThemedButton from '../../components/ThemedButton';
import { SlideInView, FadeInView, AnimatedCounter } from '../../components/AnimatedComponents';
import LocationPickerModal from './LocationPickerModal';

// ═══════════════════════════════════════════════════════════════════
// STAT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════
const StatCard = ({ icon, value, label, color, delay = 0 }) => (
    <SlideInView delay={delay} style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: `${color}15` }]}>
            <Text style={styles.statIcon}>{icon}</Text>
        </View>
        <AnimatedCounter
            value={value}
            duration={1200}
            style={[styles.statValue, { color }]}
        />
        <Text style={styles.statLabel}>{label}</Text>
    </SlideInView>
);

// ═══════════════════════════════════════════════════════════════════
// INFO ROW COMPONENT
// ═══════════════════════════════════════════════════════════════════
const InfoRow = ({ label, value, icon, onEdit }) => (
    <View style={styles.infoRow}>
        <View style={styles.infoLeft}>
            <Text style={styles.infoIcon}>{icon}</Text>
            <View>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoValue}>{value || 'Not set'}</Text>
            </View>
        </View>
        {onEdit && (
            <TouchableOpacity onPress={onEdit} style={styles.editButton}>
                <Text style={styles.editIcon}>✏️</Text>
            </TouchableOpacity>
        )}
    </View>
);

// ═══════════════════════════════════════════════════════════════════
// SETTINGS ROW COMPONENT
// ═══════════════════════════════════════════════════════════════════
const SettingsRow = ({ label, icon, value, onToggle, type = 'switch' }) => (
    <View style={styles.settingsRow}>
        <View style={styles.settingsLeft}>
            <Text style={styles.settingsIcon}>{icon}</Text>
            <Text style={styles.settingsLabel}>{label}</Text>
        </View>
        {type === 'switch' ? (
            <Switch
                value={value}
                onValueChange={onToggle}
                trackColor={{ false: colors.border.light, true: colors.primaryLight }}
                thumbColor={value ? colors.primary : colors.background.card}
            />
        ) : (
            <TouchableOpacity onPress={onToggle}>
                <Text style={styles.settingsArrow}>›</Text>
            </TouchableOpacity>
        )}
    </View>
);

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
const CustomerProfile = () => {
    const navigation = useNavigation();
    const { signOut } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);
    const [customer, setCustomer] = useState(null);
    const [stats, setStats] = useState({
        totalOrders: 0,
        activeDeliveries: 0,
        vendors: 0,
    });
    const [settings, setSettings] = useState({
        notifications: true,
        emailUpdates: true,
        locationSharing: false,
    });
    const [locationSharingBusy, setLocationSharingBusy] = useState(false);
    const [locationModalVisible, setLocationModalVisible] = useState(false);
    const [savingLocation, setSavingLocation] = useState(false);
    const [editData, setEditData] = useState({
        name: '',
        email: '',
        mobileNo: '',
        address: '',
    });

    const scrollY = useRef(new Animated.Value(0)).current;

    // Fetch profile data
    const fetchProfile = useCallback(async () => {
        try {
            const customerId = await AsyncStorage.getItem('userId');
            if (!customerId) return;

            const [profileRes, dashboardRes] = await Promise.all([
                api.get(`/api/customer/profile/${customerId}`).catch(() => null),
                api.get(`/api/customer/dashboard/${customerId}`).catch(() => null),
            ]);

            if (profileRes?.data) {
                setCustomer(profileRes.data);
                setEditData({
                    name: profileRes.data.name || '',
                    email: profileRes.data.email || '',
                    mobileNo: profileRes.data.mobileNo || '',
                    address: profileRes.data.address || '',
                });
                setSettings((s) => ({ ...s, locationSharing: !!profileRes.data.rescueOptIn }));
            }

            if (dashboardRes?.data?.stats) {
                setStats({
                    totalOrders: dashboardRes.data.stats.totalOrders || 0,
                    activeDeliveries: dashboardRes.data.stats.activeDeliveries || 0,
                    vendors: dashboardRes.data.stats.totalVendors || 0,
                });
            }
        } catch (err) {
            console.error('Profile fetch error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchProfile();
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const customerId = await AsyncStorage.getItem('userId');
            // NOTE: the backend does not yet expose a profile-update endpoint;
            // this now at least targets the correct resource path/naming
            // convention. Adding the PUT handler + schema field belongs to
            // the data-model stage, not this foundation-repair stage.
            await api.put(`/api/customer/profile/${customerId}`, editData);
            setCustomer({ ...customer, ...editData });
            setEditing(false);
            Alert.alert('Success', 'Profile updated successfully!');
        } catch (err) {
            Alert.alert('Error', 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    // Stage 11 Phase 9: explicit opt-in for Rescue Sale proximity
    // notifications. Off by default, never required for normal Fresh Goods
    // use, and never re-prompted automatically if the customer declines —
    // they can retry by tapping the toggle again whenever they choose to.
    const handleToggleLocationSharing = async (nextValue) => {
        if (locationSharingBusy) return;
        setLocationSharingBusy(true);
        try {
            if (!nextValue) {
                await api.put('/api/customer/rescue-preferences', { optIn: false });
                setSettings((s) => ({ ...s, locationSharing: false }));
                return;
            }

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Location permission needed',
                    'Enable location access to receive nearby Rescue Sale opportunities. You can keep using Fresh Goods normally without it.'
                );
                return;
            }

            const position = await Location.getCurrentPositionAsync({});
            await api.put('/api/customer/rescue-preferences', {
                optIn: true,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
            });
            setSettings((s) => ({ ...s, locationSharing: true }));
            Alert.alert('Rescue Sale notifications enabled', "You'll be notified about nearby rescue opportunities.");
        } catch (err) {
            console.error('Failed to update rescue preferences:', err);
            Alert.alert('Error', 'Failed to update location sharing. Please try again.');
        } finally {
            setLocationSharingBusy(false);
        }
    };

    // Customer Preferred Location — independent of Rescue Sale opt-in above.
    // Reuses the same Customer.location/locationUpdatedAt fields (and the
    // same map component) rather than a parallel location system; setting
    // this does not enable Rescue Sale notifications, and toggling those
    // off does not clear this.
    const handleSaveLocation = async (latitude, longitude) => {
        setSavingLocation(true);
        try {
            await api.put('/api/customer/location', { latitude, longitude });
            setCustomer((prev) => ({
                ...prev,
                location: { type: 'Point', coordinates: [longitude, latitude] },
                locationUpdatedAt: new Date().toISOString(),
            }));
            setLocationModalVisible(false);
            Alert.alert('Saved', 'Your preferred delivery location has been saved.');
        } catch (err) {
            console.error('Failed to save preferred location:', err);
            Alert.alert('Error', err.message || 'Failed to save location. Please try again.');
        } finally {
            setSavingLocation(false);
        }
    };

    // Uses the same signOut() the sidebar's logout already uses — no
    // separate logout implementation.
    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await AsyncStorage.clear();
                        signOut();
                    },
                },
            ]
        );
    };

    const savedCoords = customer?.location?.coordinates;
    const hasPreferredLocation = Array.isArray(savedCoords) && savedCoords.length === 2;

    const getInitials = (name) => {
        return name
            ?.split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2) || 'U';
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading profile...</Text>
            </View>
        );
    }

    const headerHeight = scrollY.interpolate({
        inputRange: [0, 150],
        outputRange: [200, 120],
        extrapolate: 'clamp',
    });

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                style={styles.container}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                    />
                }
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
            >
                {/* Profile Header */}
                <Animated.View style={{ height: headerHeight }}>
                    <LinearGradient
                        colors={gradients.forest}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.header}
                    >
                        <View style={styles.avatarContainer}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>
                                    {getInitials(customer?.name)}
                                </Text>
                            </View>
                            <View style={styles.verifiedBadge}>
                                <Text style={styles.verifiedIcon}>✓</Text>
                            </View>
                        </View>
                        <Text style={styles.userName}>{customer?.name || 'Customer'}</Text>
                        <Text style={styles.userLocation}>
                            📍 {customer?.district}, {customer?.state}
                        </Text>
                    </LinearGradient>
                </Animated.View>

                {/* Stats Section */}
                <View style={styles.statsContainer}>
                    <StatCard
                        icon="📦"
                        value={stats.totalOrders}
                        label="Orders"
                        color={colors.primary}
                        delay={0}
                    />
                    <StatCard
                        icon="🚚"
                        value={stats.activeDeliveries}
                        label="Active"
                        color={colors.tertiary}
                        delay={100}
                    />
                    <StatCard
                        icon="🏪"
                        value={stats.vendors}
                        label="Vendors"
                        color={colors.accent}
                        delay={200}
                    />
                </View>

                {/* Personal Info Card */}
                <FadeInView delay={100}>
                    <ThemedCard variant="elevated" style={styles.sectionCard}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Personal Information</Text>
                            <TouchableOpacity onPress={() => setEditing(!editing)}>
                                <Text style={styles.editLink}>
                                    {editing ? 'Cancel' : 'Edit'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {editing ? (
                            <View style={styles.editForm}>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Full Name</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={editData.name}
                                        onChangeText={(text) =>
                                            setEditData({ ...editData, name: text })
                                        }
                                        placeholder="Enter your name"
                                        placeholderTextColor={colors.text.muted}
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Email</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={editData.email}
                                        onChangeText={(text) =>
                                            setEditData({ ...editData, email: text })
                                        }
                                        placeholder="Enter your email"
                                        placeholderTextColor={colors.text.muted}
                                        keyboardType="email-address"
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Phone Number</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={editData.mobileNo}
                                        onChangeText={(text) =>
                                            setEditData({ ...editData, mobileNo: text })
                                        }
                                        placeholder="Enter phone number"
                                        placeholderTextColor={colors.text.muted}
                                        keyboardType="phone-pad"
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Address</Text>
                                    <TextInput
                                        style={[styles.input, styles.textArea]}
                                        value={editData.address}
                                        onChangeText={(text) =>
                                            setEditData({ ...editData, address: text })
                                        }
                                        placeholder="Enter your address"
                                        placeholderTextColor={colors.text.muted}
                                        multiline
                                        numberOfLines={3}
                                    />
                                </View>
                                <ThemedButton
                                    title={saving ? 'Saving...' : 'Save Changes'}
                                    variant="gradient"
                                    onPress={handleSave}
                                    loading={saving}
                                    fullWidth
                                    style={{ marginTop: spacing.md }}
                                />
                            </View>
                        ) : (
                            <>
                                <InfoRow
                                    icon="👤"
                                    label="Full Name"
                                    value={customer?.name}
                                />
                                <InfoRow
                                    icon="📧"
                                    label="Email"
                                    value={customer?.email}
                                />
                                <InfoRow
                                    icon="📱"
                                    label="Phone"
                                    value={customer?.mobileNo}
                                />
                                <InfoRow
                                    icon="🏠"
                                    label="Address"
                                    value={customer?.address || `${customer?.district}, ${customer?.state}`}
                                />
                            </>
                        )}
                    </ThemedCard>
                </FadeInView>

                {/* Preferred Delivery Location Card */}
                <FadeInView delay={150}>
                    <ThemedCard variant="elevated" style={styles.sectionCard}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Preferred Delivery Location</Text>
                        </View>
                        <InfoRow
                            icon="📍"
                            label="Saved Location"
                            value={
                                hasPreferredLocation
                                    ? `${savedCoords[1].toFixed(5)}, ${savedCoords[0].toFixed(5)}`
                                    : null
                            }
                        />
                        <ThemedButton
                            title={hasPreferredLocation ? 'Change Location' : 'Set Location'}
                            variant="outline"
                            onPress={() => setLocationModalVisible(true)}
                            fullWidth
                            style={{ marginTop: spacing.sm }}
                        />
                    </ThemedCard>
                </FadeInView>

                {/* Account Card */}
                <FadeInView delay={175}>
                    <ThemedCard variant="elevated" style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>Account</Text>
                        <SettingsRow
                            icon="🔔"
                            label="Notifications"
                            type="arrow"
                            onToggle={() => navigation.navigate('Notifications')}
                        />
                        <SettingsRow
                            icon="⚙️"
                            label="Settings"
                            type="arrow"
                            onToggle={() => navigation.navigate('Settings')}
                        />
                    </ThemedCard>
                </FadeInView>

                {/* Settings Card */}
                <FadeInView delay={200}>
                    <ThemedCard variant="elevated" style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>Preferences</Text>

                        <SettingsRow
                            icon="🔔"
                            label="Push Notifications"
                            value={settings.notifications}
                            onToggle={() =>
                                setSettings({ ...settings, notifications: !settings.notifications })
                            }
                        />
                        <SettingsRow
                            icon="📧"
                            label="Email Updates"
                            value={settings.emailUpdates}
                            onToggle={() =>
                                setSettings({ ...settings, emailUpdates: !settings.emailUpdates })
                            }
                        />
                        <SettingsRow
                            icon="📍"
                            label="Rescue Sale Notifications"
                            value={settings.locationSharing}
                            onToggle={() => handleToggleLocationSharing(!settings.locationSharing)}
                        />
                        <Text style={styles.settingsHint}>
                            Share your approximate location to get notified when a vendor's
                            shipment nearby needs a rescue buyer. Your exact location is never
                            shown to vendors or other customers.
                        </Text>
                    </ThemedCard>
                </FadeInView>

                {/* Security Card */}
                <FadeInView delay={300}>
                    <ThemedCard variant="elevated" style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>Security</Text>

                        <SettingsRow
                            icon="🔐"
                            label="Change Password"
                            type="arrow"
                            onToggle={() => Alert.alert('Coming Soon', 'Password change feature coming soon!')}
                        />
                        <SettingsRow
                            icon="🛡️"
                            label="Two-Factor Authentication"
                            type="arrow"
                            onToggle={() => Alert.alert('Coming Soon', '2FA feature coming soon!')}
                        />
                        <SettingsRow
                            icon="📋"
                            label="Privacy Policy"
                            type="arrow"
                            onToggle={() => Alert.alert('Privacy Policy', 'Your data is secure with us.')}
                        />
                    </ThemedCard>
                </FadeInView>

                {/* Log Out */}
                <FadeInView delay={350}>
                    <ThemedButton
                        title="Log Out"
                        variant="danger"
                        fullWidth
                        onPress={handleLogout}
                        style={styles.logoutButton}
                    />
                </FadeInView>

                {/* App Info */}
                <FadeInView delay={400}>
                    <View style={styles.appInfo}>
                        <Text style={styles.appName}>PeriSense</Text>
                        <Text style={styles.appVersion}>Version 2.0.0</Text>
                    </View>
                </FadeInView>

                <View style={styles.bottomPadding} />
            </ScrollView>

            <LocationPickerModal
                visible={locationModalVisible}
                initialCoords={
                    hasPreferredLocation
                        ? { latitude: savedCoords[1], longitude: savedCoords[0] }
                        : null
                }
                onClose={() => setLocationModalVisible(false)}
                onConfirm={handleSaveLocation}
                saving={savingLocation}
            />
        </KeyboardAvoidingView>
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
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: spacing.xl,
        paddingBottom: spacing.lg,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: spacing.md,
    },
    avatar: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    avatarText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.text.light,
    },
    verifiedBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.success,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
    },
    verifiedIcon: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
    },
    userName: {
        ...typography.h2,
        color: colors.text.light,
    },
    userLocation: {
        ...typography.bodySmall,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: spacing.xs,
    },
    statsContainer: {
        flexDirection: 'row',
        marginHorizontal: spacing.md,
        marginTop: -spacing.xl,
        marginBottom: spacing.md,
    },
    statCard: {
        flex: 1,
        backgroundColor: colors.background.card,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginHorizontal: spacing.xs,
        alignItems: 'center',
        ...shadows.md,
    },
    statIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    statIcon: {
        fontSize: 20,
    },
    statValue: {
        ...typography.h2,
    },
    statLabel: {
        ...typography.caption,
        color: colors.text.muted,
        marginTop: spacing.xxs,
    },
    sectionCard: {
        marginHorizontal: spacing.md,
        marginBottom: spacing.md,
    },
    logoutButton: {
        marginHorizontal: spacing.md,
        marginBottom: spacing.md,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    sectionTitle: {
        ...typography.h4,
        color: colors.text.primary,
    },
    editLink: {
        ...typography.bodySmall,
        color: colors.primary,
        fontWeight: '600',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm + 2,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
    },
    infoLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    infoIcon: {
        fontSize: 18,
        marginRight: spacing.md,
    },
    infoLabel: {
        ...typography.caption,
        color: colors.text.muted,
    },
    infoValue: {
        ...typography.body,
        color: colors.text.primary,
        marginTop: 2,
    },
    editButton: {
        padding: spacing.sm,
    },
    editIcon: {
        fontSize: 16,
    },
    editForm: {
        paddingTop: spacing.sm,
    },
    inputGroup: {
        marginBottom: spacing.md,
    },
    inputLabel: {
        ...typography.captionMedium,
        color: colors.text.secondary,
        marginBottom: spacing.xs,
    },
    input: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        ...typography.body,
        color: colors.text.primary,
        borderWidth: 1,
        borderColor: colors.border.light,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    settingsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm + 4,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
    },
    settingsLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    settingsIcon: {
        fontSize: 18,
        marginRight: spacing.md,
    },
    settingsLabel: {
        ...typography.body,
        color: colors.text.primary,
    },
    settingsArrow: {
        fontSize: 24,
        color: colors.text.muted,
    },
    settingsHint: {
        ...typography.caption,
        color: colors.text.muted,
        paddingTop: spacing.xs,
        paddingBottom: spacing.sm,
    },
    appInfo: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    appName: {
        ...typography.h3,
        color: colors.primary,
    },
    appVersion: {
        ...typography.caption,
        color: colors.text.muted,
        marginTop: spacing.xs,
    },
    bottomPadding: {
        height: spacing.xxl,
    },
});

export default CustomerProfile;
