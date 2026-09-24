/**
 * SplashScreen - Shown during authentication state check
 * Displays FreshGoods branding while checking if user is logged in. No
 * artificial delay is added here — this renders for exactly as long as the
 * real auth check (RootNavigator's isLoading) takes.
 */
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing, typography, borderRadius } from './theme';

const SplashScreen = () => {
    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <View style={styles.logoContainer}>
                    <Text style={styles.logoIcon}>🍃</Text>
                </View>

                <Text style={styles.title}>FreshGoods</Text>
                <Text style={styles.subtitle}>Fresh food.{'\n'}Smarter logistics.</Text>

                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
    },
    logoContainer: {
        width: 88,
        height: 88,
        borderRadius: borderRadius.xxl,
        backgroundColor: colors.successBg,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    logoIcon: {
        fontSize: 44,
    },
    title: {
        ...typography.h1,
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    subtitle: {
        ...typography.body,
        color: colors.text.muted,
        textAlign: 'center',
        marginBottom: spacing.xxl,
    },
    loadingContainer: {
        alignItems: 'center',
    },
});

export default SplashScreen;
