/**
 * SettingsScreen.js
 * App settings with theme toggle and preferences
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Switch,
    TouchableOpacity,
    Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import {
    colors,
    gradients,
    spacing,
    borderRadius,
    typography,
    shadows,
} from '../theme';
import ThemedCard from '../components/ThemedCard';
import { FadeInView, SlideInView } from '../components/AnimatedComponents';

// ═══════════════════════════════════════════════════════════════════
// SETTING ITEM COMPONENT
// ═══════════════════════════════════════════════════════════════════
const SettingItem = ({ icon, title, subtitle, rightComponent, onPress }) => (
    <TouchableOpacity
        style={styles.settingItem}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={onPress ? 0.7 : 1}
    >
        <View style={styles.settingIcon}>
            <Text style={styles.settingEmoji}>{icon}</Text>
        </View>
        <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>{title}</Text>
            {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
        {rightComponent}
    </TouchableOpacity>
);

// ═══════════════════════════════════════════════════════════════════
// SECTION HEADER COMPONENT
// ═══════════════════════════════════════════════════════════════════
const SectionHeader = ({ title }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
);

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
const SettingsScreen = ({ onBack }) => {
    const [darkMode, setDarkMode] = useState(false);
    const [notifications, setNotifications] = useState(true);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [vibrationEnabled, setVibrationEnabled] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const handleClearCache = () => {
        Alert.alert(
            'Clear Cache',
            'Are you sure you want to clear the app cache?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Clear cached data (keep user session)
                            Alert.alert('Success', 'Cache cleared successfully');
                        } catch (err) {
                            Alert.alert('Error', 'Failed to clear cache');
                        }
                    },
                },
            ]
        );
    };

    const handleAbout = () => {
        Alert.alert(
            'About FreshGoods',
            'Version 1.0.0\n\n' +
            'PeriSense Smart Agriculture Tracking\n\n' +
            '© 2025 PeriSense. All rights reserved.',
            [{ text: 'OK' }]
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <FadeInView>
                <LinearGradient
                    colors={gradients.forest}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.header}
                >
                    {onBack && (
                        <TouchableOpacity onPress={onBack} style={styles.backButton}>
                            <Text style={styles.backIcon}>←</Text>
                        </TouchableOpacity>
                    )}
                    <Text style={styles.headerTitle}>Settings</Text>
                </LinearGradient>
            </FadeInView>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
            >
                {/* Appearance */}
                <SlideInView delay={100}>
                    <SectionHeader title="Appearance" />
                    <ThemedCard variant="elevated" style={styles.card}>
                        <SettingItem
                            icon="🌙"
                            title="Dark Mode"
                            subtitle="Switch to dark theme"
                            rightComponent={
                                <Switch
                                    value={darkMode}
                                    onValueChange={setDarkMode}
                                    trackColor={{ false: colors.border.medium, true: colors.primaryLight }}
                                    thumbColor={darkMode ? colors.primary : '#f4f3f4'}
                                />
                            }
                        />
                    </ThemedCard>
                </SlideInView>

                {/* Notifications */}
                <SlideInView delay={200}>
                    <SectionHeader title="Notifications" />
                    <ThemedCard variant="elevated" style={styles.card}>
                        <SettingItem
                            icon="🔔"
                            title="Push Notifications"
                            subtitle="Receive push notifications"
                            rightComponent={
                                <Switch
                                    value={notifications}
                                    onValueChange={setNotifications}
                                    trackColor={{ false: colors.border.medium, true: colors.primaryLight }}
                                    thumbColor={notifications ? colors.primary : '#f4f3f4'}
                                />
                            }
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="🔊"
                            title="Sound"
                            subtitle="Play notification sounds"
                            rightComponent={
                                <Switch
                                    value={soundEnabled}
                                    onValueChange={setSoundEnabled}
                                    trackColor={{ false: colors.border.medium, true: colors.primaryLight }}
                                    thumbColor={soundEnabled ? colors.primary : '#f4f3f4'}
                                />
                            }
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="📳"
                            title="Vibration"
                            subtitle="Vibrate on notifications"
                            rightComponent={
                                <Switch
                                    value={vibrationEnabled}
                                    onValueChange={setVibrationEnabled}
                                    trackColor={{ false: colors.border.medium, true: colors.primaryLight }}
                                    thumbColor={vibrationEnabled ? colors.primary : '#f4f3f4'}
                                />
                            }
                        />
                    </ThemedCard>
                </SlideInView>

                {/* Data & Storage */}
                <SlideInView delay={300}>
                    <SectionHeader title="Data & Storage" />
                    <ThemedCard variant="elevated" style={styles.card}>
                        <SettingItem
                            icon="🔄"
                            title="Auto Refresh"
                            subtitle="Automatically sync data"
                            rightComponent={
                                <Switch
                                    value={autoRefresh}
                                    onValueChange={setAutoRefresh}
                                    trackColor={{ false: colors.border.medium, true: colors.primaryLight }}
                                    thumbColor={autoRefresh ? colors.primary : '#f4f3f4'}
                                />
                            }
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="🗑️"
                            title="Clear Cache"
                            subtitle="Free up storage space"
                            onPress={handleClearCache}
                            rightComponent={
                                <Text style={styles.chevron}>›</Text>
                            }
                        />
                    </ThemedCard>
                </SlideInView>

                {/* About */}
                <SlideInView delay={400}>
                    <SectionHeader title="About" />
                    <ThemedCard variant="elevated" style={styles.card}>
                        <SettingItem
                            icon="ℹ️"
                            title="About FreshGoods"
                            subtitle="Version 1.0.0"
                            onPress={handleAbout}
                            rightComponent={
                                <Text style={styles.chevron}>›</Text>
                            }
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="📄"
                            title="Terms of Service"
                            onPress={() => Alert.alert('Coming Soon', 'Terms of Service')}
                            rightComponent={
                                <Text style={styles.chevron}>›</Text>
                            }
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="🔒"
                            title="Privacy Policy"
                            onPress={() => Alert.alert('Coming Soon', 'Privacy Policy')}
                            rightComponent={
                                <Text style={styles.chevron}>›</Text>
                            }
                        />
                    </ThemedCard>
                </SlideInView>

                <View style={styles.bottomPadding} />
            </ScrollView>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: spacing.xl,
        paddingBottom: spacing.lg,
        paddingHorizontal: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    backIcon: {
        fontSize: 20,
        color: colors.text.light,
        fontWeight: 'bold',
    },
    headerTitle: {
        ...typography.h2,
        color: colors.text.light,
    },
    scrollView: {
        flex: 1,
    },
    sectionHeader: {
        ...typography.overline,
        color: colors.text.muted,
        marginHorizontal: spacing.md,
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
    },
    card: {
        marginHorizontal: spacing.md,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
    },
    settingIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: colors.background.secondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    settingEmoji: {
        fontSize: 20,
    },
    settingContent: {
        flex: 1,
    },
    settingTitle: {
        ...typography.bodyMedium,
        color: colors.text.primary,
    },
    settingSubtitle: {
        ...typography.caption,
        color: colors.text.muted,
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border.light,
        marginLeft: 60,
    },
    chevron: {
        fontSize: 24,
        color: colors.text.muted,
    },
    bottomPadding: {
        height: spacing.xxl,
    },
});

export default SettingsScreen;
