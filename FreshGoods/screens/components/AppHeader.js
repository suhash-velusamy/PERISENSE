/**
 * AppHeader.js
 * Premium gradient header with animations
 */

import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, spacing, typography, shadows } from '../theme';

const AppHeader = ({
    title,
    subtitle,
    showBack = false,
    onBack,
    rightComponent,
    leftComponent,
    variant = 'gradient', // 'gradient' | 'solid' | 'transparent'
    style,
}) => {
    const getBackgroundStyle = () => {
        switch (variant) {
            case 'gradient':
                return null; // Will use LinearGradient
            case 'solid':
                return { backgroundColor: colors.primary };
            case 'transparent':
                return { backgroundColor: 'transparent' };
            default:
                return null;
        }
    };

    const renderContent = () => (
        <View style={styles.content}>
            {/* Left side */}
            <View style={styles.leftContainer}>
                {showBack && onBack ? (
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Text style={styles.backIcon}>←</Text>
                    </TouchableOpacity>
                ) : leftComponent ? (
                    leftComponent
                ) : (
                    <View style={styles.placeholder} />
                )}
            </View>

            {/* Center - Title */}
            <View style={styles.titleContainer}>
                <Text style={styles.title} numberOfLines={1}>
                    {title}
                </Text>
                {subtitle && (
                    <Text style={styles.subtitle} numberOfLines={1}>
                        {subtitle}
                    </Text>
                )}
            </View>

            {/* Right side */}
            <View style={styles.rightContainer}>
                {rightComponent || <View style={styles.placeholder} />}
            </View>
        </View>
    );

    if (variant === 'gradient') {
        return (
            <>
                <StatusBar
                    barStyle="light-content"
                    backgroundColor={colors.primaryDark}
                    translucent={false}
                />
                <LinearGradient
                    colors={gradients.forest}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.container, style]}
                >
                    {renderContent()}
                </LinearGradient>
            </>
        );
    }

    return (
        <>
            <StatusBar
                barStyle={variant === 'transparent' ? 'dark-content' : 'light-content'}
                backgroundColor="transparent"
                translucent={false}
            />
            <View style={[styles.container, getBackgroundStyle(), style]}>
                {renderContent()}
            </View>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingTop: Platform.OS === 'ios' ? 48 : StatusBar.currentHeight + 8,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.md,
        ...shadows.md,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    leftContainer: {
        width: 48,
        alignItems: 'flex-start',
    },
    rightContainer: {
        width: 48,
        alignItems: 'flex-end',
    },
    titleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    title: {
        ...typography.h3,
        color: colors.text.light,
        textAlign: 'center',
    },
    subtitle: {
        ...typography.caption,
        color: 'rgba(255, 255, 255, 0.7)',
        marginTop: 2,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    backIcon: {
        fontSize: 20,
        color: colors.text.light,
        fontWeight: 'bold',
    },
    placeholder: {
        width: 40,
        height: 40,
    },
});

export default AppHeader;
