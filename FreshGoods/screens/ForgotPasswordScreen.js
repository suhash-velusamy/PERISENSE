/**
 * ForgotPasswordScreen - Request OTP for password reset
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
import RNPickerSelect from 'react-native-picker-select';
import api from './services/api';
import { colors, spacing, typography, borderRadius } from './theme';

const backgroundImage = require('../assets/image1.jpg');

const roles = ['Customer', 'Vendor', 'Driver'];

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Customer');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Validation Error', 'Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Validation Error', 'Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/api/forgot-password', { email, role });

      if (response.data.success) {
        Alert.alert(
          'OTP Sent',
          'A verification code has been sent to your email.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('OTPVerification', { email, role }),
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to send OTP');
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
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>
                Enter your email address and we'll send you a verification code
              </Text>

              {/* Role picker */}
              <View style={styles.pickerWrap}>
                <RNPickerSelect
                  value={role}
                  onValueChange={setRole}
                  items={roles.map(r => ({ label: r, value: r }))}
                  placeholder={{ label: 'Select role…', value: null }}
                  style={pickerStyles}
                />
              </View>

              <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                mode="outlined"
                placeholder="Enter your registered email"
                keyboardType="email-address"
                autoCapitalize="none"
                theme={{ colors: { primary: colors.secondary } }}
              />

              <Button
                mode="contained"
                onPress={handleSubmit}
                style={styles.submitButton}
                loading={loading}
                disabled={loading}
                contentStyle={{ paddingVertical: 8 }}
              >
                Send Verification Code
              </Button>

              <Button
                mode="text"
                onPress={() => navigation.goBack()}
                style={styles.backButton}
                labelStyle={styles.backButtonText}
              >
                Back to Login
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
  },
  pickerWrap: {
    width: '100%',
    marginBottom: spacing.md,
  },
  input: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  submitButton: {
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

const pickerStyles = {
  inputIOS: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: 8,
    color: '#fff',
    paddingRight: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  inputAndroid: {
    fontSize: 16,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: 8,
    color: '#fff',
    paddingRight: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
};
