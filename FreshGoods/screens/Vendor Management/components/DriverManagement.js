/**
 * DriverManagement.js
 * Premium driver management with modern UI
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../services/api';
import {
  colors,
  gradients,
  spacing,
  borderRadius,
  typography,
  shadows,
} from '../../theme';
import ThemedCard from '../../components/ThemedCard';
import ThemedButton from '../../components/ThemedButton';
import { SlideInView, FadeInView } from '../../components/AnimatedComponents';

// ═══════════════════════════════════════════════════════════════════
// DRIVER CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════
const DriverCard = ({ driver, onRemove, onPress, index }) => (
  <SlideInView delay={index * 80}>
    <ThemedCard variant="elevated" style={styles.driverCard} onPress={onPress}>
      {/* Remove button */}
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => onRemove(driver._id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.removeIcon}>×</Text>
      </TouchableOpacity>

      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <LinearGradient
          colors={gradients.forest}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>
            {driver.name?.charAt(0).toUpperCase() || 'D'}
          </Text>
        </LinearGradient>
        <View style={styles.statusDot} />
      </View>

      {/* Driver Info */}
      <Text style={styles.driverName}>{driver.name}</Text>

      <View style={styles.infoGrid}>
        <View style={styles.infoItem}>
          <Text style={styles.infoIcon}>📧</Text>
          <Text style={styles.infoText} numberOfLines={1}>{driver.email}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoIcon}>📱</Text>
          <Text style={styles.infoText}>{driver.mobileNo}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoIcon}>🪪</Text>
          <Text style={styles.infoText}>{driver.licenseNo}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoIcon}>📍</Text>
          <Text style={styles.infoText}>{driver.district}, {driver.state}</Text>
        </View>
      </View>
    </ThemedCard>
  </SlideInView>
);

// ═══════════════════════════════════════════════════════════════════
// ADD DRIVER MODAL — creates a brand-new Driver account owned by this
// vendor (POST /api/vendor/drivers). There is no "pick from every driver
// in the system" list anymore: a Driver only exists once a Vendor creates
// it here, so it is exclusively owned from the start.
// ═══════════════════════════════════════════════════════════════════
const emptyForm = { name: '', username: '', email: '', mobile: '', password: '', licenseNo: '', state: '', district: '' };

const AddDriverModal = ({ visible, onClose, onCreate, creating }) => {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (visible) setForm(emptyForm);
  }, [visible]);

  const setField = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = () => {
    if (!form.name.trim() || !form.username.trim() || !form.email.trim() || !form.mobile.trim()
      || !form.password || !form.licenseNo.trim() || !form.state.trim() || !form.district.trim()) {
      Alert.alert('Missing information', 'All fields are required.');
      return;
    }
    if (form.password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    onCreate(form);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Driver</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            style={styles.formContainer}
            contentContainerStyle={styles.formContentContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.formHint}>
              Creates a new driver account under your team. Share the username and password with your driver.
            </Text>
            <TextInput style={styles.formInput} placeholder="Full name" placeholderTextColor={colors.text.muted} value={form.name} onChangeText={setField('name')} />
            <TextInput style={styles.formInput} placeholder="Username" placeholderTextColor={colors.text.muted} value={form.username} onChangeText={setField('username')} autoCapitalize="none" />
            <TextInput style={styles.formInput} placeholder="Email" placeholderTextColor={colors.text.muted} value={form.email} onChangeText={setField('email')} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.formInput} placeholder="Mobile number" placeholderTextColor={colors.text.muted} value={form.mobile} onChangeText={setField('mobile')} keyboardType="phone-pad" />
            <TextInput style={styles.formInput} placeholder="Temporary password" placeholderTextColor={colors.text.muted} value={form.password} onChangeText={setField('password')} secureTextEntry />
            <TextInput style={styles.formInput} placeholder="License number" placeholderTextColor={colors.text.muted} value={form.licenseNo} onChangeText={setField('licenseNo')} />
            <TextInput style={styles.formInput} placeholder="State" placeholderTextColor={colors.text.muted} value={form.state} onChangeText={setField('state')} />
            <TextInput style={styles.formInput} placeholder="District" placeholderTextColor={colors.text.muted} value={form.district} onChangeText={setField('district')} />

            <ThemedButton
              title={creating ? 'Creating...' : 'Create Driver'}
              variant="gradient"
              onPress={handleSubmit}
              loading={creating}
              disabled={creating}
              fullWidth
              style={{ marginTop: spacing.md, marginBottom: spacing.xl }}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
const DriverManagement = ({ navigation }) => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);

  // Vendor identity for every request below comes from the JWT on the
  // server side (req.user.id) — nothing here is sent as a trusted vendorId,
  // this AsyncStorage value is only used for local display/state, never
  // passed to an API call.
  const fetchDrivers = useCallback(async () => {
    try {
      const res = await api.get('/api/vendor/all');
      setDrivers(res.data || []);
    } catch (err) {
      console.error('Error fetching vendor drivers:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleCreateDriver = async (form) => {
    setCreating(true);
    try {
      await api.post('/api/vendor/drivers', form);
      setModalVisible(false);
      fetchDrivers();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to create driver';
      Alert.alert('Error', msg);
    } finally {
      setCreating(false);
    }
  };

  const handleRemoveDriver = (driverId) => {
    Alert.alert(
      'Remove Driver',
      'Are you sure you want to remove this driver from your team?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/api/vendor/remove-driver', { driverId });
              fetchDrivers();
            } catch (err) {
              Alert.alert('Error', 'Failed to remove driver');
            }
          },
        },
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      fetchDrivers();
    }, [fetchDrivers])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDrivers();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading drivers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Header */}
      <FadeInView>
        <LinearGradient
          colors={gradients.forest}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.statsHeader}
        >
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{drivers.length}</Text>
            <Text style={styles.statLabel}>Total Drivers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{drivers.length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
        </LinearGradient>
      </FadeInView>

      {/* Driver List */}
      <FlatList
        data={drivers}
        keyExtractor={(item) => item._id}
        renderItem={({ item, index }) => (
          <DriverCard
            driver={item}
            index={index}
            onRemove={handleRemoveDriver}
            onPress={() => navigation.navigate('DriverDetails', { driver: item })}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <FadeInView style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👨‍✈️</Text>
            <Text style={styles.emptyTitle}>No Drivers Yet</Text>
            <Text style={styles.emptySubtext}>
              Add drivers to your team to manage deliveries
            </Text>
          </FadeInView>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={gradients.primary}
          style={styles.fabGradient}
        >
          <Text style={styles.fabText}>+</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Add Driver Modal */}
      <AddDriverModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onCreate={handleCreateDriver}
        creating={creating}
      />
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.text.muted,
    marginTop: spacing.md,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.stat,
    color: colors.text.light,
  },
  statLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xxs,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  driverCard: {
    marginBottom: spacing.md,
    position: 'relative',
  },
  removeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.errorBg,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  removeIcon: {
    fontSize: 18,
    color: colors.error,
    fontWeight: 'bold',
  },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.light,
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.background.card,
  },
  driverName: {
    ...typography.h4,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  infoGrid: {
    gap: spacing.sm,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  infoIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    flex: 1,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    borderRadius: 28,
    overflow: 'hidden',
    ...shadows.lg,
  },
  fabGradient: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabText: {
    fontSize: 28,
    color: colors.text.light,
    fontWeight: '300',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  closeButton: {
    fontSize: 24,
    color: colors.text.muted,
    padding: spacing.sm,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  formContainer: {
    paddingHorizontal: spacing.md,
  },
  formContentContainer: {
    paddingBottom: spacing.xl,
  },
  formHint: {
    ...typography.bodySmall,
    color: colors.text.muted,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  formInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    ...typography.body,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginBottom: spacing.sm,
  },
});

export default DriverManagement;
