/**
 * ErrorBoundary.js
 * Graceful error handling component
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
    colors,
    gradients,
    spacing,
    borderRadius,
    typography,
} from '../theme';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        // Log error to analytics service
        console.error('Error caught by boundary:', error, errorInfo);
    }

    handleReload = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        if (this.props.onReset) {
            this.props.onReset();
        }
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <LinearGradient
                        colors={gradients.forest}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.gradient}
                    >
                        <View style={styles.content}>
                            <Text style={styles.emoji}>😔</Text>
                            <Text style={styles.title}>Oops! Something went wrong</Text>
                            <Text style={styles.subtitle}>
                                We're sorry for the inconvenience. Please try again.
                            </Text>

                            <TouchableOpacity
                                style={styles.button}
                                onPress={this.handleReload}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.buttonText}>Try Again</Text>
                            </TouchableOpacity>

                            {__DEV__ && this.state.error && (
                                <View style={styles.errorDetails}>
                                    <Text style={styles.errorTitle}>Error Details:</Text>
                                    <Text style={styles.errorText}>
                                        {this.state.error.toString()}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </LinearGradient>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    content: {
        alignItems: 'center',
        maxWidth: 300,
    },
    emoji: {
        fontSize: 80,
        marginBottom: spacing.xl,
    },
    title: {
        ...typography.h2,
        color: colors.text.light,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    subtitle: {
        ...typography.body,
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: 24,
    },
    button: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.round,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    buttonText: {
        ...typography.button,
        color: colors.text.light,
    },
    errorDetails: {
        marginTop: spacing.xl,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        maxWidth: '100%',
    },
    errorTitle: {
        ...typography.captionMedium,
        color: colors.text.light,
        marginBottom: spacing.sm,
    },
    errorText: {
        ...typography.caption,
        color: 'rgba(255, 255, 255, 0.7)',
    },
});

export default ErrorBoundary;
