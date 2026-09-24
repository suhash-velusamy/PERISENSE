import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors, spacing, typography, borderRadius } from './theme';
import ThemedButton from './components/ThemedButton';
import { FadeInView } from './components/AnimatedComponents';

export default function HomeScreen({ navigation }) {
    return (
        <View style={styles.container}>
            <StatusBar style="dark" backgroundColor={colors.background.primary} />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <FadeInView duration={400} style={styles.content}>
                    <View style={styles.logoContainer}>
                        <Text style={styles.logoIcon}>🍃</Text>
                    </View>

                    <Text style={styles.title}>FreshGoods</Text>
                    <Text style={styles.subtitle}>Fresh food. Smarter logistics.</Text>

                    <Text style={styles.description}>
                        Real-time cold-chain tracking that keeps vendors, drivers, and
                        customers in sync from pickup to delivery.
                    </Text>

                    <View style={styles.buttons}>
                        <ThemedButton
                            title="Sign In"
                            variant="gradient"
                            size="large"
                            fullWidth
                            onPress={() => navigation.navigate('RoleSelection', { mode: 'login' })}
                        />
                        <ThemedButton
                            title="Create Account"
                            variant="outline"
                            size="large"
                            fullWidth
                            style={styles.secondaryButton}
                            onPress={() => navigation.navigate('RoleSelection', { mode: 'signup' })}
                        />
                    </View>

                    <Text style={styles.footer}>
                        By continuing, you agree to our Terms & Privacy Policy
                    </Text>
                </FadeInView>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xxl,
    },
    content: {
        alignItems: 'center',
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
    },
    logoContainer: {
        width: 72,
        height: 72,
        borderRadius: borderRadius.xl,
        backgroundColor: colors.successBg,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    logoIcon: {
        fontSize: 36,
    },
    title: {
        ...typography.h1,
        color: colors.text.primary,
        marginBottom: spacing.xxs,
    },
    subtitle: {
        ...typography.bodyMedium,
        color: colors.primary,
        marginBottom: spacing.md,
    },
    description: {
        ...typography.bodySmall,
        color: colors.text.muted,
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: 20,
    },
    buttons: {
        width: '100%',
        gap: spacing.sm,
    },
    secondaryButton: {
        marginTop: spacing.xs,
    },
    footer: {
        ...typography.caption,
        color: colors.text.muted,
        marginTop: spacing.lg,
        textAlign: 'center',
    },
});
