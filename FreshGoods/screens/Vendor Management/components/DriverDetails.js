/**
 * DriverDetails.js
 * Driver's own info plus the standing Vehicle assignment (Driver -> Vehicle
 * -> Device). Assigning a vehicle here never touches Device fields — the
 * device stays attached to whichever vehicle it's mounted on.
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
import { colors, spacing, borderRadius, typography } from '../../theme';
import ThemedCard from '../../components/ThemedCard';
import ThemedButton from '../../components/ThemedButton';

const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const AssignVehicleModal = ({ visible, onClose, onAssigned, driverId }) => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!visible) return;
      setLoading(true);
      api.get('/api/vendor/vehicles')
        .then((res) => setVehicles((res.data || []).filter((v) => !v.driver)))
        .catch(() => setVehicles([]))
        .finally(() => setLoading(false));
    }, [visible])
  );

  const handleAssign = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await api.post('/api/vendor/assign-driver-vehicle', { driverId, vehicleId: Number(selected) });
      onAssigned();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to assign vehicle');
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
            <Text style={styles.modalTitle}>Assign Vehicle</Text>
            <View style={{ width: 40 }} />
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xl }} />
          ) : vehicles.length === 0 ? (
            <Text style={styles.emptyText}>No unassigned vehicles available.</Text>
          ) : (
            <View style={styles.pickerContainer}>
              <Picker selectedValue={selected} onValueChange={setSelected} style={styles.picker}>
                <Picker.Item label="-- Select Vehicle --" value="" />
                {vehicles.map((v) => (
                  <Picker.Item key={v._id} label={v.vehicleNumber} value={String(v._id)} />
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

const DriverDetails = ({ route }) => {
  const [driver, setDriver] = useState(route.params?.driver);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [unassigning, setUnassigning] = useState(false);

  const refreshFromList = useCallback(async () => {
    try {
      const res = await api.get('/api/vendor/all');
      const updated = (res.data || []).find((d) => d._id === driver._id);
      if (updated) setDriver(updated);
    } catch (err) {
      console.error('Failed to refresh driver:', err);
    }
  }, [driver._id]);

  const handleUnassign = () => {
    Alert.alert(
      'Unassign Vehicle',
      'Remove this driver’s vehicle assignment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unassign',
          style: 'destructive',
          onPress: async () => {
            setUnassigning(true);
            try {
              await api.post('/api/vendor/unassign-driver-vehicle', { driverId: driver._id });
              await refreshFromList();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to unassign vehicle');
            } finally {
              setUnassigning(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ThemedCard variant="elevated" style={styles.card}>
        <Text style={styles.driverName}>{driver.name}</Text>
        <InfoRow label="Email" value={driver.email} />
        <InfoRow label="Mobile" value={driver.mobileNo} />
        <InfoRow label="License" value={driver.licenseNo} />
        <InfoRow label="Location" value={`${driver.district}, ${driver.state}`} />
      </ThemedCard>

      <ThemedCard variant="elevated" style={styles.card}>
        <Text style={styles.sectionTitle}>Assigned Vehicle</Text>
        <Text style={styles.bigValue}>
          {driver.vehicle?.vehicleNumber || 'No vehicle assigned'}
        </Text>
        {driver.vehicle ? (
          <ThemedButton
            title={unassigning ? 'Unassigning...' : 'Unassign Vehicle'}
            variant="danger"
            onPress={handleUnassign}
            disabled={unassigning}
            loading={unassigning}
            fullWidth
            style={{ marginTop: spacing.md }}
          />
        ) : (
          <ThemedButton
            title="Assign Vehicle"
            variant="gradient"
            onPress={() => setAssignModalVisible(true)}
            fullWidth
            style={{ marginTop: spacing.md }}
          />
        )}
      </ThemedCard>

      <AssignVehicleModal
        visible={assignModalVisible}
        driverId={driver._id}
        onClose={() => setAssignModalVisible(false)}
        onAssigned={async () => {
          setAssignModalVisible(false);
          await refreshFromList();
        }}
      />
    </ScrollView>
  );
};

export default DriverDetails;

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
  driverName: {
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
