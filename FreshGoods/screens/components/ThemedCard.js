/**
 * ThemedCard.js
 * Premium card component with glassmorphism and animation effects
 */

import React, { useRef } from 'react';
import {
    View,
    StyleSheet,
    TouchableWithoutFeedback,
    Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
    colors,
    gradients,
    spacing,
    borderRadius,
    shadows,
    glassmorphism,
} from '../theme';

const ThemedCard = ({
    children,
    variant = 'default', // 'default' | 'elevated' | 'glass' | 'outlined' | 'gradient' | 'dark'
    onPress,
    padding = spacing.md,
    style,
    animated = true,
}) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        if (!onPress || !animated) return;
        Animated.spring(scaleAnim, {
            toValue: 0.98,
            tension: 150,
            friction: 10,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        if (!onPress || !animated) return;
        Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
        }).start();
    };

    // Get variant styles
    const getVariantStyles = () => {
        switch (variant) {
            case 'default':
                return {
                    backgroundColor: colors.background.card,
                    borderRadius: borderRadius.lg,
                    ...shadows.sm,
                };
            case 'elevated':
                return {
                    backgroundColor: colors.background.card,
                    borderRadius: borderRadius.lg,
                    ...shadows.md,
                };
            case 'glass':
                return {
                    ...glassmorphism.card,
                    borderRadius: borderRadius.lg,
                    ...shadows.glass,
                };
            case 'outlined':
                return {
                    backgroundColor: colors.background.card,
                    borderRadius: borderRadius.lg,
                    borderWidth: 1,
                    borderColor: colors.border.light,
                };
            case 'gradient':
                return {
                    borderRadius: borderRadius.lg,
                    ...shadows.md,
                    overflow: 'hidden',
                };
            case 'dark':
                return {
                    backgroundColor: colors.background.dark,
                    borderRadius: borderRadius.lg,
                    ...shadows.md,
                };
            default:
                return {
                    backgroundColor: colors.background.card,
                    borderRadius: borderRadius.lg,
                    ...shadows.sm,
                };
        }
    };

    const variantStyles = getVariantStyles();

    // Gradient card
    if (variant === 'gradient') {
        const content = (
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <LinearGradient
                    colors={gradients.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.container, variantStyles, { padding }, style]}
                >
                    {children}
                </LinearGradient>
            </Animated.View>
        );

        if (onPress) {
            return (
                <TouchableWithoutFeedback
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    onPress={onPress}
                >
                    {content}
                </TouchableWithoutFeedback>
            );
        }
        return content;
    }

    // Standard card
    const content = (
        <Animated.View
            style={[
                styles.container,
                variantStyles,
                { padding },
                style,
                { transform: [{ scale: scaleAnim }] },
            ]}
        >
            {children}
        </Animated.View>
    );

    if (onPress) {
        return (
            <TouchableWithoutFeedback
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={onPress}
            >
                {content}
            </TouchableWithoutFeedback>
        );
    }

    return content;
};

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
    },
});

export default ThemedCard;
