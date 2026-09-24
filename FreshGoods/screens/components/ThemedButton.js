/**
 * ThemedButton.js
 * Premium button component with gradients, animations, and multiple variants
 */

import React, { useRef } from 'react';
import {
    Text,
    StyleSheet,
    TouchableWithoutFeedback,
    Animated,
    ActivityIndicator,
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
    colors,
    gradients,
    spacing,
    borderRadius,
    typography,
    shadows,
    components,
} from '../theme';

const ThemedButton = ({
    title,
    onPress,
    variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'ghost' | 'gradient' | 'success' | 'warning' | 'danger'
    size = 'medium', // 'small' | 'medium' | 'large'
    disabled = false,
    loading = false,
    icon = null,
    iconPosition = 'left',
    fullWidth = false,
    style,
    textStyle,
}) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.96,
            tension: 150,
            friction: 8,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 100,
            friction: 6,
            useNativeDriver: true,
        }).start();
    };

    // Get variant styles
    const getVariantStyles = () => {
        const isDisabled = disabled || loading;

        switch (variant) {
            case 'primary':
                return {
                    container: {
                        backgroundColor: isDisabled ? colors.text.muted : colors.primary,
                        ...shadows.primary,
                    },
                    text: { color: colors.text.light },
                    gradient: null,
                };
            case 'secondary':
                return {
                    container: {
                        backgroundColor: isDisabled ? colors.text.muted : colors.secondary,
                    },
                    text: { color: colors.text.light },
                    gradient: null,
                };
            case 'outline':
                return {
                    container: {
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderColor: isDisabled ? colors.text.muted : colors.primary,
                    },
                    text: { color: isDisabled ? colors.text.muted : colors.primary },
                    gradient: null,
                };
            case 'ghost':
                return {
                    container: {
                        backgroundColor: 'transparent',
                    },
                    text: { color: isDisabled ? colors.text.muted : colors.primary },
                    gradient: null,
                };
            case 'gradient':
                return {
                    container: {
                        ...shadows.primary,
                    },
                    text: { color: colors.text.light },
                    gradient: isDisabled ? ['#9CA3AF', '#6B7280'] : gradients.primary,
                };
            case 'success':
                return {
                    container: {
                        backgroundColor: isDisabled ? colors.text.muted : colors.success,
                        ...shadows.success,
                    },
                    text: { color: colors.text.light },
                    gradient: null,
                };
            case 'warning':
                return {
                    container: {
                        backgroundColor: isDisabled ? colors.text.muted : colors.warning,
                        ...shadows.warning,
                    },
                    text: { color: colors.text.dark },
                    gradient: null,
                };
            case 'danger':
                return {
                    container: {
                        backgroundColor: isDisabled ? colors.text.muted : colors.error,
                        ...shadows.error,
                    },
                    text: { color: colors.text.light },
                    gradient: null,
                };
            default:
                return {
                    container: { backgroundColor: colors.primary },
                    text: { color: colors.text.light },
                    gradient: null,
                };
        }
    };

    // Get size styles
    const getSizeStyles = () => {
        return components.button[size] || components.button.medium;
    };

    const variantStyles = getVariantStyles();
    const sizeStyles = getSizeStyles();

    const renderContent = () => (
        <View style={styles.content}>
            {loading ? (
                <ActivityIndicator
                    size="small"
                    color={variantStyles.text.color}
                    style={styles.loader}
                />
            ) : (
                <>
                    {icon && iconPosition === 'left' && (
                        <Text style={[styles.icon, { marginRight: spacing.sm }]}>{icon}</Text>
                    )}
                    <Text
                        style={[
                            styles.text,
                            size === 'small' ? typography.buttonSmall : typography.button,
                            variantStyles.text,
                            textStyle,
                        ]}
                    >
                        {title}
                    </Text>
                    {icon && iconPosition === 'right' && (
                        <Text style={[styles.icon, { marginLeft: spacing.sm }]}>{icon}</Text>
                    )}
                </>
            )}
        </View>
    );

    const containerStyle = [
        styles.container,
        sizeStyles,
        variantStyles.container,
        fullWidth && styles.fullWidth,
        style,
    ];

    // Gradient button
    if (variantStyles.gradient) {
        return (
            <TouchableWithoutFeedback
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={disabled || loading ? null : onPress}
            >
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                    <LinearGradient
                        colors={variantStyles.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={containerStyle}
                    >
                        {renderContent()}
                    </LinearGradient>
                </Animated.View>
            </TouchableWithoutFeedback>
        );
    }

    // Standard button
    return (
        <TouchableWithoutFeedback
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={disabled || loading ? null : onPress}
        >
            <Animated.View
                style={[containerStyle, { transform: [{ scale: scaleAnim }] }]}
            >
                {renderContent()}
            </Animated.View>
        </TouchableWithoutFeedback>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        textAlign: 'center',
    },
    icon: {
        fontSize: 18,
    },
    loader: {
        marginVertical: 2,
    },
    fullWidth: {
        width: '100%',
    },
});

export default ThemedButton;
