/**
 * OTPVerificationScreen - Verify OTP code
 */
import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ImageBackground,
    Dimensions,
    Alert,
    TextInput as RNTextInput,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Button } from 'react-native-paper';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import api from './services/api';
import { colors, spacing, typography, borderRadius } from './theme';

const backgroundImage = require('../assets/image1.jpg');

export default function OTPVerificationScreen({ navigation, route }) {
    const { email, role } = route.params || {};

    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [timer, setTimer] = useState(60);
    const [canResend, setCanResend] = useState(false);

    const inputRefs = useRef([]);

    // Timer countdown
    useEffect(() => {
        if (timer > 0) {
            const interval = setInterval(() => {
                setTimer(t => t - 1);
            }, 1000);
            return () => clearInterval(interval);
        } else {
            setCanResend(true);
        }
    }, [timer]);

    const handleOtpChange = (value, index) => {
        if (value.length > 1) {
            // Handle paste
            const pasted = value.slice(0, 6).split('');
            const newOtp = [...otp];
            pasted.forEach((char, i) => {
                if (index + i < 6) newOtp[index + i] = char;
            });
            setOtp(newOtp);
            const nextIndex = Math.min(index + pasted.length, 5);
            inputRefs.current[nextIndex]?.focus();
            return;
        }

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-focus next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyPress = (e, index) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async () => {
        const otpString = otp.join('');

        if (otpString.length !== 6) {
            Alert.alert('Error', 'Please enter the complete 6-digit code');
            return;
        }

        try {
            setLoading(true);
            const response = await api.post('/api/verify-otp', { email, otp: otpString });

            if (response.data.success) {
                navigation.navigate('ResetPassword', {
                    email,
                    role,
                    resetToken: response.data.resetToken,
                });
            }
        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        try {
            setLoading(true);
            await api.post('/api/forgot-password', { email, role });
            Alert.alert('Success', 'A new verification code has been sent');
            setTimer(60);
            setCanResend(false);
            setOtp(['', '', '', '', '', '']);
        } catch (error) {
            Alert.alert('Error', 'Failed to resend OTP');
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
                            <Text style={styles.title}>Verify OTP</Text>
                            <Text style={styles.subtitle}>
                                Enter the 6-digit code sent to{'\n'}
                                <Text style={styles.email}>{email}</Text>
                            </Text>

                            {/* OTP Input */}
                            <View style={styles.otpContainer}>
                                {otp.map((digit, index) => (
                                    <RNTextInput
                                        key={index}
                                        ref={ref => inputRefs.current[index] = ref}
                                        style={[
                                            styles.otpInput,
                                            digit && styles.otpInputFilled,
                                        ]}
                                        value={digit}
                                        onChangeText={value => handleOtpChange(value, index)}
                                        onKeyPress={e => handleKeyPress(e, index)}
                                        keyboardType="number-pad"
                                        maxLength={6}
                                        selectTextOnFocus
                                    />
                                ))}
                            </View>

                            {/* Timer or Resend */}
                            <View style={styles.timerContainer}>
                                {canResend ? (
                                    <Button
                                        mode="text"
                                        onPress={handleResend}
                                        disabled={loading}
                                        labelStyle={styles.resendText}
                                    >
                                        Resend Code
                                    </Button>
                                ) : (
                                    <Text style={styles.timerText}>
                                        Resend code in {timer}s
                                    </Text>
                                )}
                            </View>

                            <Button
                                mode="contained"
                                onPress={handleVerify}
                                style={styles.verifyButton}
                                loading={loading}
                                disabled={loading || otp.join('').length !== 6}
                                contentStyle={{ paddingVertical: 8 }}
                            >
                                Verify Code
                            </Button>

                            <Button
                                mode="text"
                                onPress={() => navigation.goBack()}
                                style={styles.backButton}
                                labelStyle={styles.backButtonText}
                            >
                                Change Email
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
        lineHeight: 24,
    },
    email: {
        color: colors.secondary,
        fontWeight: 'bold',
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        maxWidth: 300,
        marginBottom: spacing.lg,
    },
    otpInput: {
        width: 45,
        height: 55,
        borderWidth: 2,
        borderColor: colors.border.light,
        borderRadius: borderRadius.md,
        textAlign: 'center',
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text.light,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    otpInputFilled: {
        borderColor: colors.secondary,
        backgroundColor: 'rgba(0,206,201,0.1)',
    },
    timerContainer: {
        marginBottom: spacing.lg,
    },
    timerText: {
        ...typography.body,
        color: colors.text.muted,
    },
    resendText: {
        color: colors.secondary,
    },
    verifyButton: {
        width: '100%',
        borderRadius: borderRadius.round,
        backgroundColor: colors.secondary,
        marginBottom: spacing.md,
    },
    backButton: {
        marginTop: spacing.sm,
    },
    backButtonText: {
        color: colors.text.muted,
    },
});
