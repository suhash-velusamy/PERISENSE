/**
 * RoleSelectionScreen - User selects their role before login/signup
 * Status-driven card UI: one role card per option, consistent with the rest
 * of the app's card system.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors, spacing, typography, borderRadius } from './theme';
import ThemedCard from './components/ThemedCard';
import { SlideInView } from './components/AnimatedComponents';

// Matches the role→color mapping already used elsewhere in the app (see
// SidebarMenu.js's getRoleBadgeColor) rather than introducing a separate
// palette just for these screens.
const ROLES = [
    {
        id: 'Customer',
        icon: '🛒',
        title: 'Customer',
        loginDescription: 'Shop and order products',
        signupDescription: 'Browse and purchase fresh goods',
        color: colors.accent,
    },
    {
        id: 'Vendor',
        icon: '🏪',
        title: 'Vendor',
        loginDescription: 'Manage your business',
        signupDescription: 'Sell and manage goods',
        color: colors.primary,
    },
    {
        id: 'Driver',
        icon: '🚚',
        title: 'Driver',
        loginDescription: 'Deliver goods',
        signupDescription: 'Deliver goods',
        color: colors.tertiary,
    },
];

const RoleCard = ({ role, description, onPress, delay }) => (
    <SlideInView delay={delay}>
        <ThemedCard variant="elevated" style={styles.roleCard} onPress={onPress}>
            <View style={[styles.iconContainer, { backgroundColor: role.color + '18' }]}>
                <Text style={styles.roleIcon}>{role.icon}</Text>
            </View>
            <View style={styles.roleInfo}>
                <Text style={styles.roleTitle}>{role.title}</Text>
                <Text style={styles.roleDescription}>{description}</Text>
            </View>
            <Text style={[styles.chevron, { color: role.color }]}>›</Text>
        </ThemedCard>
    </SlideInView>
);

export default function RoleSelectionScreen({ navigation, route }) {
    const { mode } = route.params || { mode: 'login' }; // 'login' or 'signup'
    const isSignup = mode === 'signup';

    // Driver accounts are created by a Vendor (Vendor > Manage Drivers > Add
    // Driver), never through public self-registration — so Driver is a valid
    // role to log in as, but not one to sign up as.
    const availableRoles = isSignup ? ROLES.filter((r) => r.id !== 'Driver') : ROLES;

    const handleRoleSelect = (role) => {
        if (isSignup) {
            navigation.navigate('Signup', { selectedRole: role.id });
        } else {
            navigation.navigate('Login', { selectedRole: role.id });
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar style="dark" backgroundColor={colors.background.primary} />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <Text style={styles.title}>{isSignup ? 'Join FreshGoods' : 'Sign in as'}</Text>
                    <Text style={styles.subtitle}>
                        {isSignup ? 'Choose how you want to use FreshGoods' : 'Select your role to continue'}
                    </Text>
                </View>

                <View style={styles.rolesContainer}>
                    {availableRoles.map((role, index) => (
                        <RoleCard
                            key={role.id}
                            role={role}
                            description={isSignup ? role.signupDescription : role.loginDescription}
                            onPress={() => handleRoleSelect(role)}
                            delay={index * 60}
                        />
                    ))}
                </View>

                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.backButtonText}>← Back to Home</Text>
                </TouchableOpacity>
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
    header: {
        marginBottom: spacing.lg,
        alignItems: 'center',
    },
    title: {
        ...typography.h2,
        color: colors.text.primary,
        marginBottom: spacing.xxs,
        textAlign: 'center',
    },
    subtitle: {
        ...typography.body,
        color: colors.text.muted,
        textAlign: 'center',
    },
    rolesContainer: {
        width: '100%',
        maxWidth: 420,
        alignSelf: 'center',
    },
    roleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    iconContainer: {
        width: 52,
        height: 52,
        borderRadius: borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    roleIcon: {
        fontSize: 24,
    },
    roleInfo: {
        flex: 1,
    },
    roleTitle: {
        ...typography.h4,
        color: colors.text.primary,
        marginBottom: 2,
    },
    roleDescription: {
        ...typography.bodySmall,
        color: colors.text.muted,
    },
    chevron: {
        fontSize: 26,
        fontWeight: '600',
    },
    backButton: {
        marginTop: spacing.lg,
        alignItems: 'center',
        paddingVertical: spacing.md,
    },
    backButtonText: {
        ...typography.body,
        color: colors.text.muted,
    },
});
