/**
 * DeviceManagement.js
 * Vendor-owned device list — Available vs Assigned, and which vehicle an
 * assigned device is mounted on — plus Register Device. Mirrors the
 * existing DriverManagement/VehicleManagement list+FAB pattern.
 */

import React, { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
// DEVICE CARD
// ═══════════════════════════════════════════════════════════════════
const DeviceCard = ({ device, index }) => (
  <SlideInView delay={index * 80}>
    <ThemedCard variant="elevated" style={styles.deviceCard}>
      <View style={styles.deviceHeader}>
        <LinearGradient colors={gradients.tertiary} style={styles.deviceIcon}>
          <Text style={styles.deviceEmoji}>📡</Text>
        </LinearGradient>
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName}>{device.deviceName}</Text>
          <Text style={styles.deviceSub}>
            {device.isAssigned ? `On ${device.vehicle?.vehicleNumber || 'a vehicle'}` : 'Not on any vehicle'}
          </Text>
        </View>
        <View style={[styles.statusBadge, device.isAssigned ? styles.statusBadgeAssigned : styles.statusBadgeAvailable]}>
          <Text style={[styles.statusText, device.isAssigned ? styles.statusTextAssigned : styles.statusTextAvailable]}>
            {device.isAssigned ? 'Assigned' : 'Available'}
          </Text>
        </View>
      </View>
    </ThemedCard>
  </SlideInView>
);

// ═══════════════════════════════════════════════════════════════════
// REGISTER DEVICE MODAL
// ═══════════════════════════════════════════════════════════════════
const RegisterDeviceModal = ({ visible, onClose, onSubmit, submitting }) => {
  const [deviceName, setDeviceName] = useState('');

  useEffect(() => {
    if (visible) setDeviceName('');
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Register Device</Text>
            <View style={{ width: 40 }} />
          </View>

          <Text style={styles.inputLabel}>Device Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. FG-DEV-001"
            placeholderTextColor={colors.text.muted}
            value={deviceName}
            onChangeText={setDeviceName}
            autoCapitalize="characters"
          />

          <ThemedButton
            title={submitting ? 'Registering...' : 'Register Device'}
            variant="gradient"
            onPress={() => onSubmit(deviceName)}
            disabled={submitting || !deviceName.trim()}
            loading={submitting}
            fullWidth
            style={styles.submitButton}
          />
          <ThemedButton title="Cancel" variant="ghost" onPress={onClose} fullWidth style={styles.cancelButton} />
        </View>
      </View>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
const DeviceManagement = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await api.get('/api/vendor/devices');
      setDevices(res.data || []);
    } catch (err) {
      console.error('Fetch devices error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDevices();
    }, [fetchDevices])
  );

  const handleRegister = async (deviceName) => {
    setSubmitting(true);
    try {
      await api.post('/api/vendor/register-device', { deviceName: deviceName.trim() });
      setModalVisible(false);
      fetchDevices();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to register device');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDevices();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading devices...</Text>
      </View>
    );
  }

  const availableCount = devices.filter((d) => !d.isAssigned).length;

  return (
    <View style={styles.container}>
      <FadeInView>
        <LinearGradient
          colors={gradients.tertiary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.statsHeader}
        >
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{devices.length}</Text>
            <Text style={styles.statLabel}>Total Devices</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{availableCount}</Text>
            <Text style={styles.statLabel}>Available</Text>
          </View>
        </LinearGradient>
      </FadeInView>

      <FlatList
        data={devices}
        keyExtractor={(item) => item._id}
        renderItem={({ item, index }) => <DeviceCard device={item} index={index} />}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
        ListEmptyComponent={
          <FadeInView style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📡</Text>
            <Text style={styles.emptyTitle}>No Devices Yet</Text>
            <Text style={styles.emptySubtext}>Register your IoT devices to attach them to vehicles</Text>
          </FadeInView>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)} activeOpacity={0.8}>
        <LinearGradient colors={gradients.tertiary} style={styles.fabGradient}>
          <Text style={styles.fabText}>+</Text>
        </LinearGradient>
      </TouchableOpacity>

      <RegisterDeviceModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={handleRegister}
        submitting={submitting}
      />
    </View>
  );
};

export default DeviceManagement;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { ...typography.body, color: colors.text.muted, marginTop: spacing.md },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
  },
  statItem: { alignItems: 'center' },
  statValue: { ...typography.stat, color: colors.text.light },
  statLabel: { ...typography.caption, color: 'rgba(255,255,255,0.8)', marginTop: spacing.xxs },
  statDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)' },
  listContent: { padding: spacing.md, paddingBottom: 100 },
  deviceCard: { marginBottom: spacing.md },
  deviceHeader: { flexDirection: 'row', alignItems: 'center' },
  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  deviceEmoji: { fontSize: 22 },
  deviceInfo: { flex: 1 },
  deviceName: { ...typography.h4, color: colors.text.primary },
  deviceSub: { ...typography.caption, color: colors.text.muted, marginTop: 2 },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.round },
  statusBadgeAvailable: { backgroundColor: colors.successBg },
  statusBadgeAssigned: { backgroundColor: colors.infoBg },
  statusText: { ...typography.captionMedium },
  statusTextAvailable: { color: colors.success },
  statusTextAssigned: { color: colors.info },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    borderRadius: 28,
    overflow: 'hidden',
    ...shadows.lg,
  },
  fabGradient: { width: 56, height: 56, justifyContent: 'center', alignItems: 'center' },
  fabText: { fontSize: 28, color: colors.text.light, fontWeight: '300' },
  emptyContainer: { alignItems: 'center', paddingVertical: spacing.xxl * 2 },
  emptyIcon: { fontSize: 64, marginBottom: spacing.md },
  emptyTitle: { ...typography.h3, color: colors.text.primary, marginBottom: spacing.sm },
  emptySubtext: { ...typography.body, color: colors.text.muted, textAlign: 'center', paddingHorizontal: spacing.xl },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.background.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  closeButton: { fontSize: 24, color: colors.text.muted, padding: spacing.sm },
  modalTitle: { ...typography.h3, color: colors.text.primary },
  inputLabel: { ...typography.captionMedium, color: colors.text.secondary, marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  submitButton: { marginTop: spacing.xl },
  cancelButton: { marginTop: spacing.sm, marginBottom: spacing.md },
});
