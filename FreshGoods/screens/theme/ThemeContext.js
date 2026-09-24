/**
 * ThemeContext.js
 * Theme context for dark/light mode support
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = '@app_theme';

// Light theme colors (current default)
const lightColors = {
    primary: '#10B981',
    primaryLight: '#34D399',
    primaryDark: '#059669',
    secondary: '#8B5A2B',
    secondaryLight: '#A0522D',
    secondaryDark: '#654321',
    tertiary: '#F59E0B',
    tertiaryLight: '#FBBF24',
    tertiaryDark: '#D97706',
    accent: '#0EA5E9',
    accentLight: '#38BDF8',
    accentDark: '#0284C7',
    success: '#22C55E',
    successBg: '#DCFCE7',
    warning: '#F59E0B',
    warningBg: '#FEF3C7',
    error: '#EF4444',
    errorBg: '#FEE2E2',
    info: '#3B82F6',
    infoBg: '#DBEAFE',
    background: {
        primary: '#F8FAFC',
        secondary: '#F1F5F9',
        tertiary: '#E2E8F0',
        card: '#FFFFFF',
    },
    text: {
        primary: '#1E293B',
        secondary: '#475569',
        muted: '#94A3B8',
        light: '#FFFFFF',
        dark: '#0F172A',
    },
    border: {
        light: '#E2E8F0',
        medium: '#CBD5E1',
        dark: '#94A3B8',
    },
};

// Dark theme colors
const darkColors = {
    primary: '#34D399',
    primaryLight: '#6EE7B7',
    primaryDark: '#10B981',
    secondary: '#A0522D',
    secondaryLight: '#CD853F',
    secondaryDark: '#8B5A2B',
    tertiary: '#FBBF24',
    tertiaryLight: '#FCD34D',
    tertiaryDark: '#F59E0B',
    accent: '#38BDF8',
    accentLight: '#7DD3FC',
    accentDark: '#0EA5E9',
    success: '#4ADE80',
    successBg: '#14532D',
    warning: '#FBBF24',
    warningBg: '#713F12',
    error: '#F87171',
    errorBg: '#7F1D1D',
    info: '#60A5FA',
    infoBg: '#1E3A8A',
    background: {
        primary: '#0F172A',
        secondary: '#1E293B',
        tertiary: '#334155',
        card: '#1E293B',
    },
    text: {
        primary: '#F1F5F9',
        secondary: '#CBD5E1',
        muted: '#64748B',
        light: '#FFFFFF',
        dark: '#0F172A',
    },
    border: {
        light: '#334155',
        medium: '#475569',
        dark: '#64748B',
    },
};

// Gradients
const lightGradients = {
    primary: ['#10B981', '#059669'],
    forest: ['#10B981', '#064E3B'],
    sunset: ['#F59E0B', '#DC2626'],
    ocean: ['#0EA5E9', '#1D4ED8'],
    earth: ['#8B5A2B', '#654321'],
    harvest: ['#F59E0B', '#B45309'],
};

const darkGradients = {
    primary: ['#34D399', '#10B981'],
    forest: ['#34D399', '#065F46'],
    sunset: ['#FBBF24', '#EF4444'],
    ocean: ['#38BDF8', '#2563EB'],
    earth: ['#A0522D', '#8B4513'],
    harvest: ['#FBBF24', '#D97706'],
};

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
            if (savedTheme !== null) {
                setIsDarkMode(savedTheme === 'dark');
            }
        } catch (err) {
            console.error('Error loading theme:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleTheme = async () => {
        const newMode = !isDarkMode;
        setIsDarkMode(newMode);
        try {
            await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode ? 'dark' : 'light');
        } catch (err) {
            console.error('Error saving theme:', err);
        }
    };

    const setTheme = async (mode) => {
        const dark = mode === 'dark';
        setIsDarkMode(dark);
        try {
            await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
        } catch (err) {
            console.error('Error saving theme:', err);
        }
    };

    const colors = isDarkMode ? darkColors : lightColors;
    const gradients = isDarkMode ? darkGradients : lightGradients;

    const theme = {
        isDarkMode,
        isLoading,
        colors,
        gradients,
        toggleTheme,
        setTheme,
    };

    return (
        <ThemeContext.Provider value={theme}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export default ThemeContext;
