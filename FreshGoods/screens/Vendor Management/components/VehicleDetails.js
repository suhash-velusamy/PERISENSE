/**
 * VehicleDetails.js
 * Central place to see a vehicle's Registration Number, Type/Brand,
 * Capacity, Status, standing Driver, and Device — and to assign/remove
 * the vehicle's device. Driver assignment itself happens from Driver
 * Details (Vehicle -> Driver is read-only here, to avoid two competing
 * places to change the same relationship).
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../services/api';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import ThemedCard from '../../components/ThemedCard';
import ThemedButton from '../../components/ThemedButton';

const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const AssignDeviceModal = ({ visible, onClose, onAssigned, vehicleId }) => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!visible) return;
      setLoading(true);
      api.get('/api/vendor/available-devices')
        .then((res) => setDevices(res.data || []))
        .catch(() => setDevices([]))
        .finally(() => setLoading(false));
    }, [visible])
  );

  const handleAssign = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await api.post('/api/vendor/assign-device', { vehicleId, deviceName: selected });
      onAssigned();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to assign device');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Assign Device</Text>
            <View style={{ width: 40 }} />
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xl }} />
          ) : devices.length === 0 ? (
            <Text style={styles.emptyText}>No available devices. Register one first.</Text>
          ) : (
            <View style={styles.pickerContainer}>
              <Picker selectedValue={selected} onValueChange={setSelected} style={styles.picker}>
                <Picker.Item label="-- Select Device --" value="" />
                {devices.map((d) => (
                  <Picker.Item key={d._id} label={d.deviceName} value={d.deviceName} />
                ))}
              </Picker>
            </View>
          )}

          <ThemedButton
            title={submitting ? 'Assigning...' : 'Assign'}
            variant="gradient"
            onPress={handleAssign}
            disabled={submitting || !selected}
            loading={submitting}
            fullWidth
            style={{ marginTop: spacing.lg }}
          />
          <ThemedButton title="Cancel" variant="ghost" onPress={onClose} fullWidth style={{ marginTop: spacing.sm }} />
        </View>
      </View>
    </Modal>
  );
};

const VehicleDetails = ({ route, navigation }) => {
  const [vehicle, setVehicle] = useState(route.params?.vehicle);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [removing, setRemoving] = useState(false);

  const refreshFromList = useCallback(async () => {
    try {
      const res = await api.get('/api/vendor/vehicles');
      const updated = (res.data || []).find((v) => v._id === vehicle._id);
      if (updated) setVehicle(updated);
    } catch (err) {
      console.error('Failed to refresh vehicle:', err);
    }
  }, [vehicle._id]);

  const handleRemoveDevice = () => {
    Alert.alert(
      'Remove Device',
      `Remove ${vehicle.deviceId} from this vehicle? The device will become available for reassignment, not deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            try {
              await api.post('/api/vendor/unassign-device', { vehicleId: vehicle._id });
              await refreshFromList();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to remove device');
            } finally {
              setRemoving(false);
            }
          },
        },
      ]
    );
  };

  const driverName = vehicle.driver?.name || null;
  const deviceStatus = vehicle.deviceId ? 'Assigned' : 'Not assigned';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ThemedCard variant="elevated" style={styles.card}>
        <Text style={styles.vehicleNumber}>{vehicle.vehicleNumber}</Text>
        <InfoRow label="Brand" value={vehicle.brand} />
        <InfoRow label="Capacity" value={`${vehicle.capacity} kg`} />
        <InfoRow label="Status" value={vehicle.status || 'active'} />
      </ThemedCard>

      <ThemedCard variant="elevated" style={styles.card}>
        <Text style={styles.sectionTitle}>Driver</Text>
        <Text style={styles.bigValue}>{driverName || 'No driver assigned'}</Text>
        <Text style={styles.hint}>Assign or change this from the driver's own Driver Details screen.</Text>
      </ThemedCard>

      <ThemedCard variant="elevated" style={styles.card}>
        <Text style={styles.sectionTitle}>IoT Device</Text>
        <Text style={styles.bigValue}>{vehicle.deviceId || 'No device assigned'}</Text>
        <InfoRow label="Device Status" value={deviceStatus} />
        {vehicle.deviceId ? (
          <ThemedButton
            title={removing ? 'Removing...' : 'Remove Device'}
            variant="danger"
            onPress={handleRemoveDevice}
            disabled={removing}
            loading={removing}
            fullWidth
            style={{ marginTop: spacing.md }}
          />
        ) : (
          <ThemedButton
            title="Assign Device"
            variant="gradient"
            onPress={() => setAssignModalVisible(true)}
            fullWidth
            style={{ marginTop: spacing.md }}
          />
        )}
      </ThemedCard>

      <AssignDeviceModal
        visible={assignModalVisible}
        vehicleId={vehicle._id}
        onClose={() => setAssignModalVisible(false)}
        onAssigned={async () => {
          setAssignModalVisible(false);
          await refreshFromList();
        }}
      />
    </ScrollView>
  );
};

export default VehicleDetails;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    padding: spacing.md,
  },
  card: {
    marginBottom: spacing.md,
  },
  vehicleNumber: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  bigValue: {
    ...typography.bodyMedium,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  hint: {
    ...typography.caption,
    color: colors.text.muted,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  infoLabel: {
    ...typography.bodySmall,
    color: colors.text.muted,
  },
  infoValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.md,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
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
  pickerContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  picker: {
    color: colors.text.primary,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: 'center',
    marginVertical: spacing.xl,
  },
});
