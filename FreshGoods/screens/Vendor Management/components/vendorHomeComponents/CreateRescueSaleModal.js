/**
 * CreateRescueSaleModal.js
 * Stage 11 — Vendor entry point: Condition Alert -> Review -> Create Rescue
 * Sale. Location is always pulled from the shipment's vehicle by the
 * backend (server/services/rescueService.js); this form never lets the
 * vendor type in a location.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import api from '../../../services/api';
import { colors, spacing, borderRadius, typography, shadows } from '../../../theme';
import ThemedCard from '../../../components/ThemedCard';
import ThemedButton from '../../../components/ThemedButton';
import { getConditionMeta, getRiskLabel } from '../../../utils/condition';

const CreateRescueSaleModal = ({ shipment, condition, onClose, onCreated }) => {
  const [availableQuantity, setAvailableQuantity] = useState(shipment.quantity ? String(shipment.quantity) : '');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [validUntil, setValidUntil] = useState(new Date(Date.now() + 4 * 3600000)); // default 4h from now
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const meta = getConditionMeta(condition?.conditionStatus);

  const handleSubmit = async () => {
    const quantityNum = parseFloat(availableQuantity);
    const priceNum = parseFloat(price);

    if (!(quantityNum > 0)) {
      Alert.alert('Invalid quantity', 'Enter a quantity greater than 0.');
      return;
    }
    if (!(priceNum >= 0)) {
      Alert.alert('Invalid price', 'Enter a valid price.');
      return;
    }
    if (validUntil.getTime() <= Date.now()) {
      Alert.alert('Invalid expiry', 'Choose a future date/time.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/api/vendor/rescue-sales', {
        shipmentId: shipment._id,
        availableQuantity: quantityNum,
        unit: shipment.unit || 'kg',
        price: priceNum,
        description: description.trim() || undefined,
        validUntil: validUntil.toISOString(),
      });
      Alert.alert(
        'Rescue Sale Published',
        `${res.data.eligibleCustomerCount ?? 0} nearby customer(s) have been notified.`
      );
      onCreated?.(res.data);
    } catch (err) {
      Alert.alert('Could not create Rescue Sale', err.response?.data?.error || err.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🚨 Create Rescue Sale</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.scroll}>
          <ThemedCard variant="outlined" style={[styles.conditionCard, { backgroundColor: meta.bg, borderColor: meta.color }]}>
            <Text style={[styles.conditionText, { color: meta.color }]}>
              {meta.icon} {meta.label.toUpperCase()} — {getRiskLabel(condition?.riskStatus)}
            </Text>
            <Text style={styles.conditionReason}>{condition?.reason}</Text>
          </ThemedCard>

          <Text style={styles.sectionTitle}>Shipment</Text>
          <ThemedCard variant="outlined" style={styles.card}>
            <Text style={styles.itemName}>{shipment.itemName}</Text>
            <Text style={styles.itemMeta}>{shipment.quantity} {shipment.unit || ''} total · Vehicle {shipment.vehicle?.vehicleNumber || shipment.vehicle}</Text>
            <Text style={styles.itemHint}>Pickup location will be taken automatically from this vehicle's current position.</Text>
          </ThemedCard>

          <Text style={styles.sectionTitle}>Rescue Sale Details</Text>
          <ThemedCard variant="outlined" style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Quantity available for rescue ({shipment.unit || 'kg'})</Text>
              <TextInput
                style={styles.input}
                value={availableQuantity}
                onChangeText={setAvailableQuantity}
                keyboardType="numeric"
                placeholder="e.g. 100"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Rescue price (₹ per {shipment.unit || 'kg'})</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                placeholder="e.g. 25"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Any details buyers should know"
                multiline
                numberOfLines={3}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Available until</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateButtonText}>{validUntil.toLocaleString()}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.radiusHint}>
              Nearby customers within 30 km who've opted into Rescue Sale notifications will be
              notified automatically when this is published.
            </Text>
          </ThemedCard>

          <DateTimePickerModal
            isVisible={showDatePicker}
            mode="datetime"
            date={validUntil}
            minimumDate={new Date()}
            onConfirm={(date) => {
              setShowDatePicker(false);
              setValidUntil(date);
            }}
            onCancel={() => setShowDatePicker(false)}
          />

          <ThemedButton
            title={submitting ? 'Publishing...' : 'Publish Rescue Sale'}
            variant="gradient"
            onPress={handleSubmit}
            loading={submitting}
            fullWidth
            style={{ marginTop: spacing.lg, marginBottom: spacing.xxl }}
          />
        </ScrollView>
      </View>
    </Modal>
  );
};

export default CreateRescueSaleModal;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: spacing.xl,
  },
  closeText: { fontSize: 20, color: colors.text.primary },
  headerTitle: { ...typography.h4, color: colors.text.primary },
  scroll: { flex: 1, paddingHorizontal: spacing.md },
  conditionCard: { marginBottom: spacing.md },
  conditionText: { ...typography.h4, marginBottom: spacing.xs },
  conditionReason: { ...typography.bodySmall, color: colors.text.secondary },
  sectionTitle: { ...typography.captionMedium, color: colors.text.muted, marginBottom: spacing.sm, marginTop: spacing.sm, textTransform: 'uppercase' },
  card: { marginBottom: spacing.md },
  itemName: { ...typography.h4, color: colors.text.primary },
  itemMeta: { ...typography.bodySmall, color: colors.text.secondary, marginTop: 2 },
  itemHint: { ...typography.caption, color: colors.text.muted, marginTop: spacing.sm, fontStyle: 'italic' },
  inputGroup: { marginBottom: spacing.md },
  inputLabel: { ...typography.bodySmall, color: colors.text.secondary, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 4,
    ...typography.body,
    color: colors.text.primary,
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  dateButton: {
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 4,
  },
  dateButtonText: { ...typography.body, color: colors.text.primary },
  radiusHint: { ...typography.caption, color: colors.text.muted, marginTop: spacing.xs },
});
