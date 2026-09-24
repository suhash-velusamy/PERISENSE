/**
 * ResetPasswordScreen - Set new password
 */
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ImageBackground,
    Dimensions,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import api from './services/api';
import { colors, spacing, typography, borderRadius } from './theme';

const backgroundImage = require('../assets/image1.jpg');

export default function ResetPasswordScreen({ navigation, route }) {
    const { email, resetToken } = route.params || {};

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const validatePassword = () => {
        if (newPassword.length < 6) {
            Alert.alert('Validation Error', 'Password must be at least 6 characters');
            return false;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert('Validation Error', 'Passwords do not match');
            return false;
        }
        return true;
    };

    const handleSubmit = async () => {
        if (!validatePassword()) return;

        try {
            setLoading(true);
            const response = await api.post('/api/reset-password', {
                email,
                resetToken,
                newPassword,
            });

            if (response.data.success) {
                Alert.alert(
                    'Success',
                    'Your password has been reset successfully.',
                    [
                        {
                            text: 'Login Now',
                            onPress: () => navigation.navigate('Login'),
                        },
                    ]
                );
            }
        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" backgroundColor="#000" translucent={false} />

            <ImageBackground source={backgroundImage} style={styles.background} resizeMode="cover">
                <BlurView intensity={80} tint="dark" style={styles.blurOverlay}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.keyboardView}
                    >
                        <View style={styles.card}>
                            <Text style={styles.icon}>🔐</Text>
                            <Text style={styles.title}>New Password</Text>
                            <Text style={styles.subtitle}>
                                Create a strong password for your account
                            </Text>

                            <TextInput
                                label="New Password"
                                value={newPassword}
                                onChangeText={setNewPassword}
                                style={styles.input}
                                mode="outlined"
                                secureTextEntry={!showPassword}
                                right={
                                    <TextInput.Icon
                                        icon={showPassword ? 'eye-off' : 'eye'}
                                        onPress={() => setShowPassword(!showPassword)}
                                    />
                                }
                                theme={{ colors: { primary: colors.secondary } }}
                            />

                            <TextInput
                                label="Confirm Password"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                style={styles.input}
                                mode="outlined"
                                secureTextEntry={!showPassword}
                                theme={{ colors: { primary: colors.secondary } }}
                            />

                            {/* Password requirements */}
                            <View style={styles.requirements}>
                                <Text style={[
                                    styles.requirementText,
                                    newPassword.length >= 6 && styles.requirementMet
                                ]}>
                                    {newPassword.length >= 6 ? '✓' : '○'} At least 6 characters
                                </Text>
                                <Text style={[
                                    styles.requirementText,
                                    newPassword && newPassword === confirmPassword && styles.requirementMet
                                ]}>
                                    {newPassword && newPassword === confirmPassword ? '✓' : '○'} Passwords match
                                </Text>
                            </View>

                            <Button
                                mode="contained"
                                onPress={handleSubmit}
                                style={styles.submitButton}
                                loading={loading}
                                disabled={loading || !newPassword || !confirmPassword}
                                contentStyle={{ paddingVertical: 8 }}
                            >
                                Reset Password
                            </Button>
                        </View>
                    </KeyboardAvoidingView>
                </BlurView>
            </ImageBackground>
        </View>
    );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    background: {
        flex: 1,
        width,
        height,
    },
    blurOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'center',
        width: '100%',
    },
    card: {
        backgroundColor: colors.background.card,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        alignItems: 'center',
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
    },
    icon: {
        fontSize: 48,
        marginBottom: spacing.sm,
    },
    title: {
        ...typography.h1,
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    subtitle: {
        ...typography.body,
        color: colors.text.muted,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    input: {
        width: '100%',
        marginBottom: spacing.md,
    },
    requirements: {
        width: '100%',
        marginBottom: spacing.lg,
    },
    requirementText: {
        ...typography.bodySmall,
        color: colors.text.muted,
        marginBottom: spacing.xs,
    },
    requirementMet: {
        color: colors.success,
    },
    submitButton: {
        width: '100%',
        borderRadius: borderRadius.round,
        backgroundColor: colors.secondary,
    },
});
