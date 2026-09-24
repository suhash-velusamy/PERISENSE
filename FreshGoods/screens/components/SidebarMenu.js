/**
 * SidebarMenu.js
 * Premium animated sidebar navigation with user profile
 */

import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
    Modal,
    Alert,
    ScrollView,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    colors,
    gradients,
    spacing,
    borderRadius,
    typography,
    shadows,
} from '../theme';
import { useAuth } from '../../navigation/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.78;

const SidebarMenu = ({
    isVisible,
    onClose,
    menuItems = [],
    activeItem,
    onItemPress,
    navigation,
    userName = 'User',
    userRole = 'Member',
    userEmail = '',
}) => {
    const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const { signOut } = useAuth();

    useEffect(() => {
        if (isVisible) {
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 65,
                    friction: 10,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: -SIDEBAR_WIDTH,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [isVisible]);

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
                        onClose();
                        // Flips RootNavigator to AuthStack, unmounting the
                        // whole role navigator (and its back-stack) with it.
                        signOut();
                    },
                },
            ]
        );
    };

    const handleItemPress = (itemId) => {
        onItemPress(itemId);
        onClose();
    };

    const getInitials = (name) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const getRoleBadgeColor = (role) => {
        switch (role?.toLowerCase()) {
            case 'vendor':
                return colors.primary;
            case 'driver':
                return colors.tertiary;
            case 'customer':
                return colors.accent;
            default:
                return colors.text.muted;
        }
    };

    if (!isVisible) return null;

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            {/* Overlay */}
            <Animated.View
                style={[styles.overlay, { opacity: fadeAnim }]}
            >
                <TouchableOpacity
                    style={styles.overlayTouch}
                    activeOpacity={1}
                    onPress={onClose}
                />
            </Animated.View>

            {/* Sidebar */}
            <Animated.View
                style={[
                    styles.sidebar,
                    { transform: [{ translateX: slideAnim }] },
                ]}
            >
                {/* Header with gradient */}
                <LinearGradient
                    colors={gradients.forest}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.header}
                >
                    {/* User Avatar */}
                    <View style={styles.avatarContainer}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{getInitials(userName)}</Text>
                        </View>
                        <View style={styles.onlineIndicator} />
                    </View>

                    {/* User Info */}
                    <Text style={styles.userName}>{userName}</Text>
                    {userEmail ? (
                        <Text style={styles.userEmail}>{userEmail}</Text>
                    ) : null}

                    {/* Role Badge */}
                    <View
                        style={[
                            styles.roleBadge,
                            { backgroundColor: getRoleBadgeColor(userRole) },
                        ]}
                    >
                        <Text style={styles.roleText}>{userRole}</Text>
                    </View>
                </LinearGradient>

                {/* Menu Items */}
                <ScrollView
                    style={styles.menuContainer}
                    showsVerticalScrollIndicator={false}
                >
                    {menuItems.map((item, index) => {
                        const isActive = activeItem === item.id;
                        return (
                            <TouchableOpacity
                                key={item.id}
                                style={[
                                    styles.menuItem,
                                    isActive && styles.menuItemActive,
                                ]}
                                onPress={() => handleItemPress(item.id)}
                                activeOpacity={0.7}
                            >
                                <View
                                    style={[
                                        styles.iconContainer,
                                        isActive && styles.iconContainerActive,
                                    ]}
                                >
                                    <Text style={styles.icon}>{item.icon}</Text>
                                </View>
                                <Text
                                    style={[
                                        styles.menuLabel,
                                        isActive && styles.menuLabelActive,
                                    ]}
                                >
                                    {item.label}
                                </Text>
                                {isActive && <View style={styles.activeIndicator} />}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* Footer */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.logoutButton}
                        onPress={handleLogout}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.logoutIcon}>🚪</Text>
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>

                    <Text style={styles.version}>PeriSense v2.0</Text>
                </View>
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    overlayTouch: {
        flex: 1,
    },
    sidebar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: SIDEBAR_WIDTH,
        backgroundColor: colors.background.card,
        ...shadows.xl,
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: spacing.xl,
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: spacing.md,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    avatarText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.text.light,
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: colors.success,
        borderWidth: 3,
        borderColor: colors.primary,
    },
    userName: {
        ...typography.h3,
        color: colors.text.light,
        marginBottom: spacing.xxs,
    },
    userEmail: {
        ...typography.bodySmall,
        color: 'rgba(255, 255, 255, 0.7)',
        marginBottom: spacing.sm,
    },
    roleBadge: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.round,
        marginTop: spacing.sm,
    },
    roleText: {
        ...typography.captionMedium,
        color: colors.text.light,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    menuContainer: {
        flex: 1,
        paddingTop: spacing.md,
        paddingHorizontal: spacing.sm,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.xs,
        position: 'relative',
    },
    menuItemActive: {
        backgroundColor: colors.successBg,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.secondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    iconContainerActive: {
        backgroundColor: colors.primary,
    },
    icon: {
        fontSize: 18,
    },
    menuLabel: {
        ...typography.bodyMedium,
        color: colors.text.secondary,
        flex: 1,
    },
    menuLabelActive: {
        color: colors.primary,
        fontWeight: '600',
    },
    activeIndicator: {
        width: 4,
        height: 24,
        borderRadius: 2,
        backgroundColor: colors.primary,
        position: 'absolute',
        right: 0,
    },
    footer: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border.light,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        backgroundColor: colors.errorBg,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.md,
    },
    logoutIcon: {
        fontSize: 18,
        marginRight: spacing.sm,
    },
    logoutText: {
        ...typography.button,
        color: colors.error,
    },
    version: {
        ...typography.caption,
        color: colors.text.muted,
        textAlign: 'center',
    },
});

export default SidebarMenu;
