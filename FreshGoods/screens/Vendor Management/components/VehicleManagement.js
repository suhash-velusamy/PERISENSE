/**
 * VehicleManagement.js
 * Premium vehicle management with modern UI
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Picker } from '@react-native-picker/picker';
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
// VEHICLE CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════
const VehicleCard = ({ vehicle, index, onPress }) => (
  <SlideInView delay={index * 80}>
    <ThemedCard variant="elevated" style={styles.vehicleCard} onPress={onPress}>
      {/* Vehicle Icon */}
      <View style={styles.vehicleHeader}>
        <LinearGradient
          colors={gradients.ocean}
          style={styles.vehicleIcon}
        >
          <Text style={styles.vehicleEmoji}>🚗</Text>
        </LinearGradient>
        <View style={styles.vehicleInfo}>
          <Text style={styles.vehicleNumber}>{vehicle.vehicleNumber}</Text>
          <Text style={styles.vehicleBrand}>{vehicle.brand}</Text>
        </View>
      </View>

      {/* Details Grid */}
      <View style={styles.detailsGrid}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Capacity</Text>
          <Text style={styles.detailValue}>{vehicle.capacity} kg</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Device</Text>
          <Text style={styles.detailValue}>{vehicle.deviceId || 'None'}</Text>
        </View>
      </View>

      {/* Status Badge */}
      <View style={styles.statusBadge}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>Active</Text>
      </View>
    </ThemedCard>
  </SlideInView>
);

// ═══════════════════════════════════════════════════════════════════
// ADD VEHICLE MODAL
// ═══════════════════════════════════════════════════════════════════
const AddVehicleModal = ({
  visible,
  onClose,
  form,
  setForm,
  deviceOptions,
  onSubmit,
  submitting,
}) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Add Vehicle</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
          {/* Form Fields */}
          <Text style={styles.inputLabel}>Vehicle ID</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter vehicle ID (number)"
            placeholderTextColor={colors.text.muted}
            value={form._id}
            onChangeText={(t) => setForm({ ...form, _id: t })}
            keyboardType="numeric"
          />

          <Text style={styles.inputLabel}>Vehicle Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. TN01AB1234"
            placeholderTextColor={colors.text.muted}
            value={form.vehicleNumber}
            onChangeText={(t) => setForm({ ...form, vehicleNumber: t })}
            autoCapitalize="characters"
          />

          <Text style={styles.inputLabel}>Brand</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Tata, Mahindra"
            placeholderTextColor={colors.text.muted}
            value={form.brand}
            onChangeText={(t) => setForm({ ...form, brand: t })}
          />

          <Text style={styles.inputLabel}>Capacity (kg)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 1000"
            placeholderTextColor={colors.text.muted}
            value={form.capacity}
            onChangeText={(t) => setForm({ ...form, capacity: t })}
            keyboardType="numeric"
          />

          <Text style={styles.inputLabel}>Select Device</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={form.deviceId}
              onValueChange={(val) => setForm({ ...form, deviceId: val })}
              style={styles.picker}
            >
              <Picker.Item label="-- No device (optional) --" value="" />
              {deviceOptions.map((d) => (
                <Picker.Item key={d._id} label={d.deviceName} value={d.deviceName} />
              ))}
            </Picker>
          </View>

          {/* Submit Button */}
          <ThemedButton
            title={submitting ? 'Adding...' : 'Add Vehicle'}
            variant="gradient"
            onPress={onSubmit}
            disabled={submitting}
            loading={submitting}
            fullWidth
            style={styles.submitButton}
          />

          <ThemedButton
            title="Cancel"
            variant="ghost"
            onPress={onClose}
            fullWidth
            style={styles.cancelButton}
          />
        </ScrollView>
      </View>
    </View>
  </Modal>
);

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
const VehicleManagement = ({ navigation }) => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [deviceOptions, setDeviceOptions] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    _id: '',
    vehicleNumber: '',
    brand: '',
    capacity: '',
    deviceId: '',
  });

  const fetchVehicles = useCallback(async () => {
    try {
      const vendorId = await AsyncStorage.getItem('userId');
      const res = await api.get(`/api/vendor/vehicles?vendorId=${vendorId}`);
      setVehicles(res.data || []);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchAvailableDevices = async () => {
    try {
      const res = await api.get('/api/vendor/available-devices');
      setDeviceOptions(res.data || []);
    } catch (err) {
      console.error('Device fetch error:', err);
    }
  };

  const handleAddVehicle = async () => {
    if (!form.vehicleNumber || !form.brand || !form.capacity) {
      return;
    }

    setSubmitting(true);
    try {
      const vendorId = await AsyncStorage.getItem('userId');
      await api.post('/api/vendor/add-vehicle', {
        ...form,
        vendorId,
      });
      setModalVisible(false);
      setForm({ _id: '', vehicleNumber: '', brand: '', capacity: '', deviceId: '' });
      fetchVehicles();
    } catch (err) {
      console.error('Add error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchVehicles();
    }, [fetchVehicles])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchVehicles();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading vehicles...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Header */}
      <FadeInView>
        <LinearGradient
          colors={gradients.ocean}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.statsHeader}
        >
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{vehicles.length}</Text>
            <Text style={styles.statLabel}>Total Vehicles</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {vehicles.filter((v) => v.deviceId).length}
            </Text>
            <Text style={styles.statLabel}>With Devices</Text>
          </View>
        </LinearGradient>
      </FadeInView>

      {/* Vehicle List */}
      <FlatList
        data={vehicles}
        keyExtractor={(item) => item._id?.toString()}
        renderItem={({ item, index }) => (
          <VehicleCard vehicle={item} index={index} onPress={() => navigation.navigate('VehicleDetails', { vehicle: item })} />
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
            <Text style={styles.emptyIcon}>🚗</Text>
            <Text style={styles.emptyTitle}>No Vehicles Yet</Text>
            <Text style={styles.emptySubtext}>
              Add vehicles to manage your fleet
            </Text>
          </FadeInView>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          fetchAvailableDevices();
          setModalVisible(true);
        }}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={gradients.ocean}
          style={styles.fabGradient}
        >
          <Text style={styles.fabText}>+</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Add Vehicle Modal */}
      <AddVehicleModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        form={form}
        setForm={setForm}
        deviceOptions={deviceOptions}
        onSubmit={handleAddVehicle}
        submitting={submitting}
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
  vehicleCard: {
    marginBottom: spacing.md,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  vehicleIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  vehicleEmoji: {
    fontSize: 28,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleNumber: {
    ...typography.h4,
    color: colors.text.primary,
  },
  vehicleBrand: {
    ...typography.bodySmall,
    color: colors.text.muted,
    marginTop: 2,
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  detailItem: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: spacing.xxs,
  },
  detailValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.successBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: spacing.xs,
  },
  statusText: {
    ...typography.captionMedium,
    color: colors.success,
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
    maxHeight: '85%',
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
  modalBody: {
    padding: spacing.md,
  },
  inputLabel: {
    ...typography.captionMedium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
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
  pickerContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    overflow: 'hidden',
  },
  picker: {
    color: colors.text.primary,
  },
  submitButton: {
    marginTop: spacing.xl,
  },
  cancelButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
});

export default VehicleManagement;
