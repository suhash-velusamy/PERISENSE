/**
 * VendorProfile.js
 * Vendor's own account profile — read-only display of the vendor record
 * (GET /api/vendor/profile/:vendorId), reached from the sidebar. No edit
 * form: the backend has no vendor-profile-update endpoint, so this mirrors
 * Driver/Customer's info-display pattern without inventing an edit flow
 * that would silently fail to save.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
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
import { FadeInView } from '../../components/AnimatedComponents';

const InfoRow = ({ label, value, icon }) => (
    <View style={styles.infoRow}>
        <Text style={styles.infoIcon}>{icon}</Text>
        <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value || 'Not set'}</Text>
        </View>
    </View>
);

const SettingsRow = ({ label, icon, onPress }) => (
    <TouchableOpacity style={styles.settingsRow} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.settingsLeft}>
            <Text style={styles.settingsIcon}>{icon}</Text>
            <Text style={styles.settingsLabel}>{label}</Text>
        </View>
        <Text style={styles.settingsArrow}>›</Text>
    </TouchableOpacity>
);

const VendorProfile = () => {
    const navigation = useNavigation();
    const { signOut } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [vendor, setVendor] = useState(null);
    const [error, setError] = useState(null);

    const fetchProfile = useCallback(async () => {
        try {
            const vendorId = await AsyncStorage.getItem('userId');
            if (!vendorId) return;
            const res = await api.get(`/api/vendor/profile/${vendorId}`);
            setVendor(res.data);
            setError(null);
        } catch (err) {
            console.error('Vendor profile fetch error:', err);
            setError('Unable to load your profile.');
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

    const getInitials = (name) =>
        name
            ?.split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2) || 'V';

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading profile...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
            }
        >
            <LinearGradient
                colors={gradients.forest}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
            >
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{getInitials(vendor?.name)}</Text>
                </View>
                <Text style={styles.userName}>{vendor?.name || 'Vendor'}</Text>
                {vendor?.businessName ? (
                    <Text style={styles.userBusiness}>🏪 {vendor.businessName}</Text>
                ) : null}
            </LinearGradient>

            {error ? (
                <ThemedCard variant="outlined" style={styles.sectionCard}>
                    <Text style={styles.errorText}>{error}</Text>
                    <ThemedButton title="Retry" variant="outline" onPress={fetchProfile} style={{ marginTop: spacing.sm }} />
                </ThemedCard>
            ) : (
                <FadeInView delay={100}>
                    <ThemedCard variant="elevated" style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>Business Information</Text>
                        <InfoRow icon="👤" label="Contact Name" value={vendor?.name} />
                        <InfoRow icon="🏪" label="Business Name" value={vendor?.businessName} />
                        <InfoRow icon="📧" label="Email" value={vendor?.email} />
                        <InfoRow icon="📱" label="Phone" value={vendor?.mobileNo} />
                        <InfoRow icon="📍" label="Location" value={[vendor?.district, vendor?.state].filter(Boolean).join(', ')} />
                    </ThemedCard>
                </FadeInView>
            )}

            <FadeInView delay={150}>
                <ThemedCard variant="elevated" style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <SettingsRow icon="🔔" label="Notifications" onPress={() => navigation.navigate('Notifications')} />
                    <SettingsRow icon="⚙️" label="Settings" onPress={() => navigation.navigate('Settings')} />
                </ThemedCard>
            </FadeInView>

            <FadeInView delay={200}>
                <ThemedButton
                    title="Log Out"
                    variant="danger"
                    fullWidth
                    onPress={handleLogout}
                    style={styles.logoutButton}
                />
            </FadeInView>

            <View style={styles.bottomPadding} />
        </ScrollView>
    );
};

export default VendorProfile;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background.primary,
    },
    loadingText: {
        ...typography.body,
        color: colors.text.muted,
        marginTop: spacing.md,
    },
    header: {
        alignItems: 'center',
        paddingTop: spacing.xl,
        paddingBottom: spacing.xl,
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
        marginBottom: spacing.md,
    },
    avatarText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.text.light,
    },
    userName: {
        ...typography.h2,
        color: colors.text.light,
    },
    userBusiness: {
        ...typography.bodySmall,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: spacing.xs,
    },
    sectionCard: {
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
    },
    sectionTitle: {
        ...typography.h4,
        color: colors.text.primary,
        marginBottom: spacing.md,
    },
    errorText: {
        ...typography.body,
        color: colors.text.muted,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm + 2,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
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
    logoutButton: {
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
    },
    bottomPadding: {
        height: spacing.xxl,
    },
});
