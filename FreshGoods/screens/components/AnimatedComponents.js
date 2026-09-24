/**
 * AnimatedComponents.js
 * Rich animation components for premium mobile UX
 */

import React, { useRef, useEffect } from 'react';
import {
    Animated,
    StyleSheet,
    View,
    TouchableWithoutFeedback,
    Easing,
} from 'react-native';
import { colors, spacing, borderRadius, animations } from '../theme';

// ═══════════════════════════════════════════════════════════════════
// ANIMATED PRESSABLE - Button with scale animation
// ═══════════════════════════════════════════════════════════════════
export const AnimatedPressable = ({
    children,
    onPress,
    disabled = false,
    scaleValue = 0.96,
    style,
}) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: scaleValue,
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

    return (
        <TouchableWithoutFeedback
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={disabled ? null : onPress}
        >
            <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
                {children}
            </Animated.View>
        </TouchableWithoutFeedback>
    );
};

// ═══════════════════════════════════════════════════════════════════
// FADE IN VIEW - Fade animation on mount
// ═══════════════════════════════════════════════════════════════════
export const FadeInView = ({
    children,
    duration = 400,
    delay = 0,
    style,
}) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration,
            delay,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
        }).start();
    }, []);

    return (
        <Animated.View style={[style, { opacity: fadeAnim }]}>
            {children}
        </Animated.View>
    );
};

// ═══════════════════════════════════════════════════════════════════
// SLIDE IN VIEW - Slide animation on mount
// ═══════════════════════════════════════════════════════════════════
export const SlideInView = ({
    children,
    direction = 'up', // 'up' | 'down' | 'left' | 'right'
    duration = 400,
    delay = 0,
    distance = 30,
    style,
}) => {
    const translateAnim = useRef(new Animated.Value(distance)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(translateAnim, {
                toValue: 0,
                duration,
                delay,
                easing: Easing.out(Easing.back(1.2)),
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: duration * 0.8,
                delay,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const getTransform = () => {
        switch (direction) {
            case 'up':
                return [{ translateY: translateAnim }];
            case 'down':
                return [{ translateY: Animated.multiply(translateAnim, -1) }];
            case 'left':
                return [{ translateX: translateAnim }];
            case 'right':
                return [{ translateX: Animated.multiply(translateAnim, -1) }];
            default:
                return [{ translateY: translateAnim }];
        }
    };

    return (
        <Animated.View
            style={[
                style,
                {
                    opacity: fadeAnim,
                    transform: getTransform(),
                },
            ]}
        >
            {children}
        </Animated.View>
    );
};

// ═══════════════════════════════════════════════════════════════════
// STAGGER CHILDREN - Animate children with stagger
// ═══════════════════════════════════════════════════════════════════
export const StaggeredItem = ({
    children,
    index = 0,
    staggerDelay = 80,
    style,
}) => {
    return (
        <SlideInView
            direction="up"
            delay={index * staggerDelay}
            distance={20}
            style={style}
        >
            {children}
        </SlideInView>
    );
};

// ═══════════════════════════════════════════════════════════════════
// SKELETON LOADING - Shimmer effect for loading states
// ═══════════════════════════════════════════════════════════════════
export const Skeleton = ({
    width = '100%',
    height = 20,
    borderRadius: radius = borderRadius.md,
    style,
}) => {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.timing(shimmerAnim, {
                toValue: 1,
                duration: 1500,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        animation.start();
        return () => animation.stop();
    }, []);

    const translateX = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-200, 200],
    });

    return (
        <View
            style={[
                styles.skeletonBase,
                { width, height, borderRadius: radius },
                style,
            ]}
        >
            <Animated.View
                style={[
                    styles.shimmer,
                    {
                        transform: [{ translateX }],
                    },
                ]}
            />
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════
// SKELETON CARD - Card-shaped skeleton
// ═══════════════════════════════════════════════════════════════════
export const SkeletonCard = ({ style }) => (
    <View style={[styles.skeletonCard, style]}>
        <View style={styles.skeletonCardHeader}>
            <Skeleton width={48} height={48} borderRadius={borderRadius.full} />
            <View style={styles.skeletonCardHeaderText}>
                <Skeleton width="60%" height={16} style={{ marginBottom: 8 }} />
                <Skeleton width="40%" height={12} />
            </View>
        </View>
        <Skeleton width="100%" height={14} style={{ marginBottom: 8 }} />
        <Skeleton width="80%" height={14} style={{ marginBottom: 8 }} />
        <Skeleton width="60%" height={14} />
    </View>
);

// ═══════════════════════════════════════════════════════════════════
// PULSE VIEW - Pulsing animation
// ═══════════════════════════════════════════════════════════════════
export const PulseView = ({
    children,
    duration = 1500,
    minOpacity = 0.7,
    style,
}) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: minOpacity,
                    duration: duration / 2,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: duration / 2,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, []);

    return (
        <Animated.View style={[style, { opacity: pulseAnim }]}>
            {children}
        </Animated.View>
    );
};

// ═══════════════════════════════════════════════════════════════════
// BOUNCE VIEW - Bouncing animation
// ═══════════════════════════════════════════════════════════════════
export const BounceView = ({
    children,
    trigger = 0, // Change this value to trigger bounce
    style,
}) => {
    const bounceAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (trigger > 0) {
            Animated.sequence([
                Animated.timing(bounceAnim, {
                    toValue: 1.2,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.spring(bounceAnim, {
                    toValue: 1,
                    tension: 200,
                    friction: 5,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [trigger]);

    return (
        <Animated.View style={[style, { transform: [{ scale: bounceAnim }] }]}>
            {children}
        </Animated.View>
    );
};

// ═══════════════════════════════════════════════════════════════════
// ANIMATED COUNTER - Counting number animation
// ═══════════════════════════════════════════════════════════════════
export const AnimatedCounter = ({
    value = 0,
    duration = 1000,
    style,
    prefix = '',
    suffix = '',
}) => {
    const animatedValue = useRef(new Animated.Value(0)).current;
    const [displayValue, setDisplayValue] = React.useState(0);

    useEffect(() => {
        animatedValue.setValue(0);

        Animated.timing(animatedValue, {
            toValue: value,
            duration,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
        }).start();

        const listener = animatedValue.addListener(({ value: v }) => {
            setDisplayValue(Math.floor(v));
        });

        return () => animatedValue.removeListener(listener);
    }, [value]);

    return (
        <Animated.Text style={style}>
            {prefix}{displayValue}{suffix}
        </Animated.Text>
    );
};

// ═══════════════════════════════════════════════════════════════════
// PROGRESS BAR - Animated progress bar
// ═══════════════════════════════════════════════════════════════════
export const AnimatedProgressBar = ({
    progress = 0, // 0-100
    color = colors.primary,
    backgroundColor = colors.border.light,
    height = 8,
    style,
}) => {
    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: progress,
            duration: 800,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
        }).start();
    }, [progress]);

    const width = progressAnim.interpolate({
        inputRange: [0, 100],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={[styles.progressContainer, { backgroundColor, height }, style]}>
            <Animated.View
                style={[
                    styles.progressBar,
                    { backgroundColor: color, height, width },
                ]}
            />
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════
// ROTATE VIEW - Spinning animation
// ═══════════════════════════════════════════════════════════════════
export const RotateView = ({
    children,
    duration = 1000,
    style,
}) => {
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.timing(rotateAnim, {
                toValue: 1,
                duration,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        animation.start();
        return () => animation.stop();
    }, []);

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <Animated.View style={[style, { transform: [{ rotate: spin }] }]}>
            {children}
        </Animated.View>
    );
};

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
    skeletonBase: {
        backgroundColor: '#E5E7EB',
        overflow: 'hidden',
    },
    shimmer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        width: 100,
    },
    skeletonCard: {
        backgroundColor: '#fff',
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    skeletonCardHeader: {
        flexDirection: 'row',
        marginBottom: spacing.md,
    },
    skeletonCardHeaderText: {
        flex: 1,
        marginLeft: spacing.md,
        justifyContent: 'center',
    },
    progressContainer: {
        borderRadius: borderRadius.round,
        overflow: 'hidden',
    },
    progressBar: {
        borderRadius: borderRadius.round,
    },
});

export default {
    AnimatedPressable,
    FadeInView,
    SlideInView,
    StaggeredItem,
    Skeleton,
    SkeletonCard,
    PulseView,
    BounceView,
    AnimatedCounter,
    AnimatedProgressBar,
    RotateView,
};
