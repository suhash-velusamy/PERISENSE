/**
 * PeriSense Design System v2.0
 * Premium theme with agricultural color palette
 * Rich animations and glassmorphism effects
 */

import { Animated, Easing } from 'react-native';

// ═══════════════════════════════════════════════════════════════════
// COLOR PALETTE - Agricultural Theme
// ═══════════════════════════════════════════════════════════════════
export const colors = {
    // Primary - Fresh Green (main brand)
    primary: '#10B981',        // Emerald green - fresh, growth
    primaryLight: '#34D399',   // Lighter shade
    primaryDark: '#059669',    // Darker shade
    primaryGradient: ['#10B981', '#059669'],

    // Secondary - Earth Brown (stability, agriculture)
    secondary: '#92400E',      // Warm earth brown
    secondaryLight: '#B45309',
    secondaryDark: '#78350F',
    secondaryGradient: ['#B45309', '#78350F'],

    // Tertiary - Harvest Gold (prosperity, harvest)
    tertiary: '#F59E0B',       // Golden amber
    tertiaryLight: '#FBBF24',
    tertiaryDark: '#D97706',
    tertiaryGradient: ['#FBBF24', '#D97706'],

    // Accent - Sky Blue (freshness, water)
    accent: '#0EA5E9',         // Sky blue
    accentLight: '#38BDF8',
    accentDark: '#0284C7',
    accentGradient: ['#38BDF8', '#0284C7'],

    // Status colors
    success: '#22C55E',        // Green
    successLight: '#4ADE80',
    successBg: 'rgba(34, 197, 94, 0.1)',

    warning: '#F59E0B',        // Amber
    warningLight: '#FBBF24',
    warningBg: 'rgba(245, 158, 11, 0.1)',

    error: '#EF4444',          // Red
    errorLight: '#F87171',
    errorBg: 'rgba(239, 68, 68, 0.1)',

    info: '#3B82F6',           // Blue
    infoLight: '#60A5FA',
    infoBg: 'rgba(59, 130, 246, 0.1)',

    // Background colors
    background: {
        primary: '#FAFBFC',      // Clean white
        secondary: '#F3F4F6',    // Light gray
        tertiary: '#E5E7EB',     // Medium gray
        dark: '#1F2937',         // Dark background
        darker: '#111827',       // Darker background
        card: '#FFFFFF',
        cardDark: 'rgba(31, 41, 55, 0.95)',
        glass: 'rgba(255, 255, 255, 0.85)',
        glassDark: 'rgba(31, 41, 55, 0.85)',
        overlay: 'rgba(0, 0, 0, 0.5)',
        gradient: ['#10B981', '#059669', '#047857'],
    },

    // Text colors
    text: {
        primary: '#111827',      // Almost black
        secondary: '#4B5563',    // Dark gray
        tertiary: '#6B7280',     // Medium gray
        muted: '#9CA3AF',        // Light gray
        light: '#FFFFFF',
        dark: '#1F2937',
        success: '#059669',
        error: '#DC2626',
        link: '#10B981',
    },

    // Border colors
    border: {
        light: '#E5E7EB',
        medium: '#D1D5DB',
        dark: '#9CA3AF',
        focus: '#10B981',
        error: '#EF4444',
    },

    // Chart colors for analytics
    chart: {
        primary: '#10B981',
        secondary: '#F59E0B',
        tertiary: '#0EA5E9',
        quaternary: '#8B5CF6',
        success: '#22C55E',
        danger: '#EF4444',
    },
};

// ═══════════════════════════════════════════════════════════════════
// GRADIENTS
// ═══════════════════════════════════════════════════════════════════
export const gradients = {
    primary: ['#10B981', '#059669'],
    primaryDark: ['#059669', '#047857'],
    secondary: ['#B45309', '#78350F'],
    tertiary: ['#F59E0B', '#D97706'],
    accent: ['#0EA5E9', '#0284C7'],
    success: ['#22C55E', '#16A34A'],
    warning: ['#F59E0B', '#D97706'],
    error: ['#EF4444', '#DC2626'],
    dark: ['#374151', '#1F2937'],
    sunset: ['#F59E0B', '#EF4444'],
    ocean: ['#0EA5E9', '#10B981'],
    forest: ['#10B981', '#047857', '#065F46'],
    card: ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)'],
};

// ═══════════════════════════════════════════════════════════════════
// SPACING SYSTEM (8pt grid)
// ═══════════════════════════════════════════════════════════════════
export const spacing = {
    none: 0,
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64,
};

// ═══════════════════════════════════════════════════════════════════
// BORDER RADIUS
// ═══════════════════════════════════════════════════════════════════
export const borderRadius = {
    none: 0,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    round: 50,
    full: 9999,
};

// ═══════════════════════════════════════════════════════════════════
// TYPOGRAPHY
// ═══════════════════════════════════════════════════════════════════
export const typography = {
    // Headings
    h1: {
        fontSize: 32,
        fontWeight: '700',
        lineHeight: 40,
        letterSpacing: -0.5,
    },
    h2: {
        fontSize: 24,
        fontWeight: '700',
        lineHeight: 32,
        letterSpacing: -0.3,
    },
    h3: {
        fontSize: 20,
        fontWeight: '600',
        lineHeight: 28,
    },
    h4: {
        fontSize: 18,
        fontWeight: '600',
        lineHeight: 26,
    },

    // Body text
    body: {
        fontSize: 16,
        fontWeight: '400',
        lineHeight: 24,
    },
    bodyMedium: {
        fontSize: 16,
        fontWeight: '500',
        lineHeight: 24,
    },
    bodySmall: {
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 20,
    },
    bodySmallMedium: {
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 20,
    },

    // Captions & Labels
    caption: {
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 16,
    },
    captionMedium: {
        fontSize: 12,
        fontWeight: '500',
        lineHeight: 16,
    },
    overline: {
        fontSize: 10,
        fontWeight: '600',
        lineHeight: 14,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },

    // Buttons
    button: {
        fontSize: 16,
        fontWeight: '600',
        lineHeight: 24,
    },
    buttonSmall: {
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 20,
    },

    // Special
    display: {
        fontSize: 40,
        fontWeight: '800',
        lineHeight: 48,
        letterSpacing: -1,
    },
    stat: {
        fontSize: 28,
        fontWeight: '700',
        lineHeight: 36,
    },
};

// ═══════════════════════════════════════════════════════════════════
// SHADOWS
// ═══════════════════════════════════════════════════════════════════
export const shadows = {
    none: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },
    xs: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 4,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
    },
    xl: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
        elevation: 12,
    },
    // Colored shadows
    primary: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    success: {
        shadowColor: '#22C55E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    warning: {
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    error: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    // Glassmorphism shadow
    glass: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 32,
        elevation: 10,
    },
};

// ═══════════════════════════════════════════════════════════════════
// ANIMATION PRESETS
// ═══════════════════════════════════════════════════════════════════
export const animations = {
    // Timing configurations
    timing: {
        quick: 150,
        normal: 300,
        slow: 500,
        verySlow: 800,
    },

    // Spring configurations
    spring: {
        gentle: {
            tension: 100,
            friction: 10,
        },
        bouncy: {
            tension: 150,
            friction: 7,
        },
        stiff: {
            tension: 200,
            friction: 15,
        },
        wobbly: {
            tension: 180,
            friction: 12,
        },
    },

    // Easing curves
    easing: {
        easeIn: Easing.bezier(0.4, 0, 1, 1),
        easeOut: Easing.bezier(0, 0, 0.2, 1),
        easeInOut: Easing.bezier(0.4, 0, 0.2, 1),
        bounce: Easing.bounce,
        elastic: Easing.elastic(1),
    },
};

// ═══════════════════════════════════════════════════════════════════
// GLASSMORPHISM STYLES
// ═══════════════════════════════════════════════════════════════════
export const glassmorphism = {
    light: {
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderColor: 'rgba(255, 255, 255, 0.3)',
        borderWidth: 1,
    },
    dark: {
        backgroundColor: 'rgba(31, 41, 55, 0.85)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderColor: 'rgba(255, 255, 255, 0.5)',
        borderWidth: 1,
    },
    subtle: {
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
    },
};

// ═══════════════════════════════════════════════════════════════════
// COMPONENT STYLES
// ═══════════════════════════════════════════════════════════════════
export const components = {
    // Card variants
    card: {
        default: {
            backgroundColor: colors.background.card,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            ...shadows.sm,
        },
        elevated: {
            backgroundColor: colors.background.card,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            ...shadows.md,
        },
        glass: {
            ...glassmorphism.card,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            ...shadows.glass,
        },
        outlined: {
            backgroundColor: colors.background.card,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border.light,
            padding: spacing.md,
        },
    },

    // Button sizes
    button: {
        small: {
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.md,
            minHeight: 36,
        },
        medium: {
            paddingVertical: spacing.sm + 4,
            paddingHorizontal: spacing.lg,
            borderRadius: borderRadius.lg,
            minHeight: 44,
        },
        large: {
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.xl,
            borderRadius: borderRadius.lg,
            minHeight: 52,
        },
    },

    // Input styles
    input: {
        default: {
            backgroundColor: colors.background.secondary,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border.light,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 4,
            fontSize: 16,
            color: colors.text.primary,
            minHeight: 48,
        },
        focused: {
            borderColor: colors.primary,
            borderWidth: 2,
        },
        error: {
            borderColor: colors.error,
            borderWidth: 2,
        },
    },

    // Avatar sizes
    avatar: {
        xs: { size: 24, fontSize: 10 },
        sm: { size: 32, fontSize: 12 },
        md: { size: 44, fontSize: 16 },
        lg: { size: 56, fontSize: 20 },
        xl: { size: 72, fontSize: 26 },
        xxl: { size: 96, fontSize: 34 },
    },

    // Badge sizes
    badge: {
        small: {
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xxs,
            borderRadius: borderRadius.round,
            fontSize: 10,
        },
        medium: {
            paddingHorizontal: spacing.sm + 4,
            paddingVertical: spacing.xs,
            borderRadius: borderRadius.round,
            fontSize: 12,
        },
    },
};

// ═══════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

// Create animated value with spring
export const createSpringAnimation = (value, toValue, config = 'gentle') => {
    return Animated.spring(value, {
        toValue,
        ...animations.spring[config],
        useNativeDriver: true,
    });
};

// Create animated value with timing
export const createTimingAnimation = (value, toValue, duration = 'normal', easing = 'easeOut') => {
    return Animated.timing(value, {
        toValue,
        duration: animations.timing[duration],
        easing: animations.easing[easing],
        useNativeDriver: true,
    });
};

// Get status color
export const getStatusColor = (status) => {
    const statusMap = {
        pending: colors.warning,
        // Canonical Stage 4 shipment states (Shipment.status), alongside the
        // pre-existing informal keys above/below still used elsewhere.
        created: colors.warning,
        assigned: colors.warning,
        accepted: colors.primary,
        in_transit: colors.info,
        started: colors.info,
        inprogress: colors.info,
        'in-progress': colors.info,
        active: colors.primary,
        completed: colors.success,
        done: colors.success,
        cancelled: colors.error,
        rejected: colors.error,
        failed: colors.error,
    };
    return statusMap[status?.toLowerCase()] || colors.text.muted;
};

// Get status background color
export const getStatusBgColor = (status) => {
    const statusMap = {
        pending: colors.warningBg,
        created: colors.warningBg,
        assigned: colors.warningBg,
        accepted: 'rgba(16, 185, 129, 0.1)',
        in_transit: colors.infoBg,
        started: colors.infoBg,
        inprogress: colors.infoBg,
        'in-progress': colors.infoBg,
        active: 'rgba(16, 185, 129, 0.1)',
        completed: colors.successBg,
        done: colors.successBg,
        cancelled: colors.errorBg,
        rejected: colors.errorBg,
        failed: colors.errorBg,
    };
    return statusMap[status?.toLowerCase()] || 'rgba(156, 163, 175, 0.1)';
};

// Export all as default theme object
const theme = {
    colors,
    gradients,
    spacing,
    borderRadius,
    typography,
    shadows,
    animations,
    glassmorphism,
    components,
    // Utilities
    getStatusColor,
    getStatusBgColor,
    createSpringAnimation,
    createTimingAnimation,
};

export default theme;
