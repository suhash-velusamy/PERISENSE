/**
 * SignupScreen - Updated to use pre-selected role from RoleSelectionScreen
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import RNPickerSelect from 'react-native-picker-select';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from './services/api';
import { colors, spacing, typography, borderRadius } from './theme';

const backgroundImage = require('../assets/image1.jpg');

const states = ['Tamil Nadu', 'Kerala', 'Karnataka', 'Andhra Pradesh', 'Telangana'];
const districts = [
  'Chennai', 'Coimbatore', 'Madurai', 'Trichy', 'Salem',
  'Tirunelveli', 'Erode', 'Vellore', 'Tiruppur', 'Thanjavur',
];

const ROLE_CONFIG = {
  Customer: { icon: '🛒', color: '#00CEC9' },
  Vendor: { icon: '🏪', color: '#0984E3' },
  Driver: { icon: '🚚', color: '#6C5CE7' },
};

export default function SignupScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  // Get pre-selected role from navigation params
  const preSelectedRole = route.params?.selectedRole || 'Customer';
  const [selectedRole, setSelectedRole] = useState(preSelectedRole);
  const roleConfig = ROLE_CONFIG[selectedRole];

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [licenseNo, setLicenseNo] = useState('');

  // Update role when navigating from role selection
  useEffect(() => {
    if (preSelectedRole) {
      setSelectedRole(preSelectedRole);
    }
  }, [preSelectedRole]);

  // Defense in depth: RoleSelectionScreen already hides Driver in signup
  // mode, but this screen can in principle be reached directly with
  // selectedRole:'Driver' (deep link, stale nav state). The backend also
  // rejects role:'Driver' at POST /api/signup — this just avoids showing a
  // form that would only fail at submit time.
  useEffect(() => {
    if (selectedRole === 'Driver') {
      Alert.alert(
        'Driver accounts are vendor-created',
        'Ask your vendor to add you as a driver — Driver accounts cannot self-register.',
        [{ text: 'OK', onPress: () => navigation.navigate('RoleSelection', { mode: 'signup' }) }]
      );
    }
  }, [selectedRole, navigation]);

  const handleNextPage = () => setPage(prev => prev + 1);
  const handlePrevPage = () => setPage(prev => prev - 1);

  const validatePage1 = () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Name is required');
      return false;
    }
    if (!username.trim()) {
      Alert.alert('Validation Error', 'Username is required');
      return false;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Validation Error', 'Valid email is required');
      return false;
    }
    return true;
  };

  const validatePage2 = () => {
    if (!mobile.trim() || mobile.length < 10) {
      Alert.alert('Validation Error', 'Valid mobile number is required');
      return false;
    }
    if (!password || password.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters');
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!selectedState || !selectedDistrict) {
      Alert.alert('Validation Error', 'Please select state and district');
      return;
    }
    if (selectedRole === 'Vendor' && !businessName.trim()) {
      Alert.alert('Validation Error', 'Business name is required for vendors');
      return;
    }
    if (selectedRole === 'Driver' && !licenseNo.trim()) {
      Alert.alert('Validation Error', 'License number is required for drivers');
      return;
    }

    const formData = {
      role: selectedRole,
      name: name.trim(),
      username: username.trim(),
      email: email.trim(),
      mobile: mobile.trim(),
      password,
      state: selectedState,
      district: selectedDistrict,
      ...(selectedRole === 'Vendor' && { businessName: businessName.trim() }),
      ...(selectedRole === 'Driver' && { licenseNo: licenseNo.trim() }),
    };

    try {
      setLoading(true);
      await api.post('/api/signup', formData);
      Alert.alert('Success', 'Account created successfully!', [
        { text: 'OK', onPress: () => navigation.navigate('Login', { selectedRole }) }
      ]);
    } catch (error) {
      console.error('Signup error:', error.response?.data || error.message);
      Alert.alert('Error', error.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const renderPageIndicator = () => (
    <View style={styles.pageIndicator}>
      {[1, 2, 3].map((num) => (
        <View
          key={num}
          style={[
            styles.dot,
            page === num && { backgroundColor: roleConfig.color, width: 24 },
          ]}
        />
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#000" translucent={false} />
      <ImageBackground source={backgroundImage} style={styles.background} resizeMode="cover">
        <BlurView intensity={85} tint="dark" style={styles.blurOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <View style={styles.card}>
              {/* Role indicator */}
              <View style={[styles.roleIndicator, { backgroundColor: roleConfig.color + '20' }]}>
                <Text style={styles.roleIcon}>{roleConfig.icon}</Text>
                <Text style={[styles.roleLabel, { color: roleConfig.color }]}>
                  {selectedRole} Registration
                </Text>
              </View>

              {renderPageIndicator()}

              {/* Page 1: Basic Info */}
              {page === 1 && (
                <View style={styles.page}>
                  <Text style={styles.pageTitle}>Basic Information</Text>

                  <TextInput
                    label="Full Name"
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    mode="outlined"
                    left={<TextInput.Icon icon="account" />}
                    theme={{ colors: { primary: roleConfig.color } }}
                  />
                  <TextInput
                    label="Username"
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    mode="outlined"
                    left={<TextInput.Icon icon="at" />}
                    theme={{ colors: { primary: roleConfig.color } }}
                  />
                  <TextInput
                    label="Email"
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    mode="outlined"
                    left={<TextInput.Icon icon="email" />}
                    theme={{ colors: { primary: roleConfig.color } }}
                  />

                  <TouchableOpacity
                    style={[styles.nextButton, { backgroundColor: roleConfig.color }]}
                    onPress={() => validatePage1() && handleNextPage()}
                  >
                    <Text style={styles.buttonText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={18} color="white" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Page 2: Security */}
              {page === 2 && (
                <View style={styles.page}>
                  <Text style={styles.pageTitle}>Security & Contact</Text>

                  <TextInput
                    label="Mobile Number"
                    style={styles.input}
                    value={mobile}
                    onChangeText={setMobile}
                    keyboardType="phone-pad"
                    mode="outlined"
                    left={<TextInput.Icon icon="phone" />}
                    theme={{ colors: { primary: roleConfig.color } }}
                  />
                  <TextInput
                    label="Password"
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    mode="outlined"
                    left={<TextInput.Icon icon="lock" />}
                    theme={{ colors: { primary: roleConfig.color } }}
                  />
                  <TextInput
                    label="Confirm Password"
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    mode="outlined"
                    left={<TextInput.Icon icon="lock-check" />}
                    theme={{ colors: { primary: roleConfig.color } }}
                  />

                  <View style={styles.navRow}>
                    <TouchableOpacity style={styles.backButton} onPress={handlePrevPage}>
                      <Ionicons name="arrow-back" size={18} color={roleConfig.color} />
                      <Text style={[styles.backButtonText, { color: roleConfig.color }]}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.nextButton, { backgroundColor: roleConfig.color, flex: 1 }]}
                      onPress={() => validatePage2() && handleNextPage()}
                    >
                      <Text style={styles.buttonText}>Continue</Text>
                      <Ionicons name="arrow-forward" size={18} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Page 3: Location & Role-specific */}
              {page === 3 && (
                <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>
                  <Text style={styles.pageTitle}>Location & Details</Text>

                  <View style={styles.pickerContainer}>
                    <RNPickerSelect
                      onValueChange={setSelectedState}
                      value={selectedState}
                      placeholder={{ label: 'Select State', value: null }}
                      items={states.map(state => ({ label: state, value: state }))}
                      style={pickerStyles(roleConfig.color)}
                    />
                  </View>

                  <View style={styles.pickerContainer}>
                    <RNPickerSelect
                      onValueChange={setSelectedDistrict}
                      value={selectedDistrict}
                      placeholder={{ label: 'Select District', value: null }}
                      items={districts.map(d => ({ label: d, value: d }))}
                      style={pickerStyles(roleConfig.color)}
                    />
                  </View>

                  {selectedRole === 'Vendor' && (
                    <TextInput
                      label="Business Name"
                      style={styles.input}
                      value={businessName}
                      onChangeText={setBusinessName}
                      mode="outlined"
                      left={<TextInput.Icon icon="store" />}
                      theme={{ colors: { primary: roleConfig.color } }}
                    />
                  )}

                  {selectedRole === 'Driver' && (
                    <TextInput
                      label="License Number"
                      style={styles.input}
                      value={licenseNo}
                      onChangeText={setLicenseNo}
                      mode="outlined"
                      left={<TextInput.Icon icon="card-account-details" />}
                      theme={{ colors: { primary: roleConfig.color } }}
                    />
                  )}

                  <View style={styles.navRow}>
                    <TouchableOpacity style={styles.backButton} onPress={handlePrevPage}>
                      <Ionicons name="arrow-back" size={18} color={roleConfig.color} />
                      <Text style={[styles.backButtonText, { color: roleConfig.color }]}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.submitButton, { backgroundColor: roleConfig.color, flex: 1 }]}
                      onPress={handleSubmit}
                      disabled={loading}
                    >
                      <Text style={styles.buttonText}>
                        {loading ? 'Creating Account...' : 'Create Account'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}

              {/* Change role link */}
              <TouchableOpacity
                style={styles.changeRole}
                onPress={() => navigation.navigate('RoleSelection', { mode: 'signup' })}
              >
                <Text style={styles.changeRoleText}>
                  Not a {selectedRole}? <Text style={{ color: roleConfig.color }}>Change Role</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </BlurView>
      </ImageBackground>
    </View>
  );
}

const { width, height } = Dimensions.get('window');

const pickerStyles = (color) => ({
  inputIOS: {
    fontSize: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: color,
    borderRadius: 8,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: spacing.md,
  },
  inputAndroid: {
    fontSize: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: color,
    borderRadius: 8,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: spacing.md,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  background: { flex: 1, width, height },
  blurOverlay: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  keyboardView: { flex: 1, justifyContent: 'center' },
  card: {
    backgroundColor: 'rgba(20, 20, 20, 0.55)',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    maxHeight: '90%',
  },
  roleIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.round,
    marginBottom: spacing.md,
  },
  roleIcon: { fontSize: 20, marginRight: spacing.xs },
  roleLabel: { ...typography.body, fontWeight: 'bold' },
  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  page: { width: '100%' },
  pageTitle: {
    ...typography.h3,
    color: colors.text.light,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pickerContainer: { marginBottom: spacing.sm },
  navRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  backButtonText: { marginLeft: spacing.xs, fontWeight: '600' },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.round,
    gap: spacing.xs,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.round,
  },
  buttonText: { ...typography.button, color: '#fff' },
  changeRole: { alignItems: 'center', marginTop: spacing.lg },
  changeRoleText: { ...typography.bodySmall, color: colors.text.muted },
});
