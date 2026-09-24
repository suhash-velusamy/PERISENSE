/**
 * ExportManagement.js
 * Premium export creation with modern UI
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  FlatList,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { WebView } from 'react-native-webview';
import { Picker } from '@react-native-picker/picker';
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

// Map HTML for location picker
const MAP_HTML = `
<!DOCTYPE html><html><head>
<meta name="viewport" content="initial-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
<style>
  #map { height: 100vh; width:100vw; }
  #searchBar { position: absolute; top: 10px; left: 10px; z-index: 1000; background: white; padding: 6px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
  #searchBar input { border: none; padding: 8px 12px; font-size: 14px; width: 200px; outline: none; }
  #confirmBtn { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 1000; background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 14px 32px; border: none; border-radius: 12px; font-size: 16px; font-weight: bold; cursor: pointer; display: none; box-shadow: 0 4px 12px rgba(16,185,129,0.4); }
</style>
</head>
<body>
<div id="searchBar"><input id="searchInput" placeholder="Search location..." /></div>
<div id="map"></div>
<button id="confirmBtn">✓ Confirm Location</button>
<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
<script>
  const map = L.map('map').setView([11.1271, 78.6569], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  let marker;
  let selectedLocation = null;
  const confirmBtn = document.getElementById('confirmBtn');
  
  map.on('click', e => {
    if (marker) map.removeLayer(marker);
    marker = L.marker(e.latlng).addTo(map);
    selectedLocation = e.latlng;
    confirmBtn.style.display = 'block';
  });
  
  confirmBtn.addEventListener('click', () => {
    if (selectedLocation) {
      window.ReactNativeWebView.postMessage(JSON.stringify(selectedLocation));
    }
  });
  
  document.getElementById('searchInput').addEventListener('keydown', async function(e){
    if (e.key === 'Enter') {
      const query = e.target.value;
      const res = await fetch("https://nominatim.openstreetmap.org/search?format=json&q=" + encodeURIComponent(query));
      const data = await res.json();
      if(data[0]) {
        const { lat, lon } = data[0];
        const latlng = {lat: parseFloat(lat), lng: parseFloat(lon)};
        map.setView(latlng, 14);
        if (marker) map.removeLayer(marker);
        marker = L.marker(latlng).addTo(map);
        selectedLocation = latlng;
        confirmBtn.style.display = 'block';
      }
    }
  });
</script></body></html>`;

// ═══════════════════════════════════════════════════════════════════
// EXPORT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════
const ExportCard = ({ item, index }) => {
  const getStatusStyle = (status) => {
    switch (status) {
      case 'IN_TRANSIT':
        return { bg: colors.warningBg, color: colors.warning };
      case 'COMPLETED':
        return { bg: colors.successBg, color: colors.success };
      default:
        return { bg: colors.infoBg, color: colors.info };
    }
  };

  const statusStyle = getStatusStyle(item.status);

  return (
    <SlideInView delay={index * 80}>
      <ThemedCard variant="elevated" style={styles.exportCard}>
        {/* Header */}
        <View style={styles.exportHeader}>
          <LinearGradient
            colors={gradients.tertiary}
            style={styles.exportIcon}
          >
            <Text style={styles.exportEmoji}>📦</Text>
          </LinearGradient>
          <View style={styles.exportInfo}>
            <Text style={styles.exportName}>{item.itemName}</Text>
            <Text style={styles.exportQty}>Qty: {item.quantity}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.color }]}>
              {item.status}
            </Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>📅 Start</Text>
            <Text style={styles.detailValue}>
              {new Date(item.startDate).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>📅 End</Text>
            <Text style={styles.detailValue}>
              {new Date(item.endDate).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Driver & Vehicle */}
        {(item.driver || item.vehicle) && (
          <View style={styles.resourceRow}>
            {item.driver && (
              <View style={styles.resourceChip}>
                <Text style={styles.resourceIcon}>👨‍✈️</Text>
                <Text style={styles.resourceText}>{item.driver.name}</Text>
              </View>
            )}
            {item.vehicle && (
              <View style={styles.resourceChip}>
                <Text style={styles.resourceIcon}>🚗</Text>
                <Text style={styles.resourceText}>{item.vehicle.vehicleNumber}</Text>
              </View>
            )}
          </View>
        )}
      </ThemedCard>
    </SlideInView>
  );
};

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function ExportManagement() {
  const [exportsList, setExportsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [vendorId, setVendorId] = useState('');

  const [form, setForm] = useState({
    itemName: '',
    quantity: '',
    unit: '',
    costPrice: '',
    salePrice: '',
    salary: '',
    startDate: null,
    endDate: null,
    expectedDropTime: null,
    instructions: '',
    driver: '',
    vehicle: '',
    customer: '',
    startLat: '',
    startLon: '',
    endLat: '',
    endLon: '',
  });

  const UNIT_OPTIONS = ['kg', 'g', 'ton', 'liter', 'ml', 'piece', 'box', 'crate', 'dozen'];

  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [datePicker, setDatePicker] = useState({ show: false, target: 'start' });
  const [mapModal, setMapModal] = useState({ show: false, field: 'start' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const id = await AsyncStorage.getItem('userId');
      setVendorId(id);
      await fetchExports(id);
      await fetchCustomers();
    };
    fetchData();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/chat/customers/get');
      setCustomers(res.data || []);
    } catch (e) {
      console.error('Failed to fetch customers:', e);
      setCustomers([]);
    }
  };

  useEffect(() => {
    if (form.startDate && form.endDate && vendorId) {
      fetchResources();
    }
  }, [form.startDate, form.endDate, vendorId]);

  const fetchExports = async (id) => {
    try {
      const res = await api.get(`/api/vendor/exports?vendorId=${id}`);
      setExportsList(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchResources = async () => {
    if (!form.startDate || !form.endDate) return;
    try {
      const res = await api.get('/api/vendor/availableResources', {
        params: {
          vendorId,
          startDate: form.startDate.toISOString(),
          endDate: form.endDate.toISOString(),
        },
      });
      setDrivers(res.data.drivers || []);
      setVehicles(res.data.vehicles || []);
    } catch (e) {
      console.error(e);
      setDrivers([]);
      setVehicles([]);
    }
  };

  const validateForm = () => {
    if (!form.itemName.trim()) return 'Item name is required';
    if (!form.quantity || parseInt(form.quantity) <= 0) return 'Valid quantity is required';
    if (!form.costPrice || parseFloat(form.costPrice) <= 0) return 'Valid cost price is required';
    if (!form.salePrice || parseFloat(form.salePrice) <= 0) return 'Valid sale price is required';
    if (!form.salary || parseFloat(form.salary) <= 0) return 'Valid salary is required';
    if (!form.startDate) return 'Start date is required';
    if (!form.endDate) return 'End date is required';
    if (form.startDate >= form.endDate) return 'End date must be after start date';
    if (!form.driver) return 'Driver selection is required';
    if (!form.vehicle) return 'Vehicle selection is required';
    if (!form.startLat || !form.startLon) return 'Start location is required';
    if (!form.endLat || !form.endLon) return 'End location is required';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      Alert.alert('Validation Error', validationError);
      return;
    }

    setSubmitting(true);
    const payload = {
      itemName: form.itemName.trim(),
      unit: form.unit || undefined,
      startDate: form.startDate.toISOString(),
      endDate: form.endDate.toISOString(),
      expectedDropTime: form.expectedDropTime ? form.expectedDropTime.toISOString() : undefined,
      instructions: form.instructions.trim() || undefined,
      quantity: parseInt(form.quantity),
      costPrice: parseFloat(form.costPrice),
      salePrice: parseFloat(form.salePrice),
      driver: form.driver,
      vehicle: form.vehicle,
      customer: form.customer || undefined,
      salary: parseFloat(form.salary),
      startLocation: {
        latitude: parseFloat(form.startLat),
        longitude: parseFloat(form.startLon),
      },
      endLocation: {
        latitude: parseFloat(form.endLat),
        longitude: parseFloat(form.endLon),
      },
    };

    try {
      await api.post(`/api/vendor/export/add/${vendorId}`, payload);
      Alert.alert('Success', 'Export created successfully!');
      resetForm();
      setShowForm(false);
      fetchExports(vendorId);
    } catch (e) {
      const errorMessage = e.response?.data?.error || 'Failed to create export';
      Alert.alert('Error', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({
      itemName: '',
      quantity: '',
      unit: '',
      costPrice: '',
      salePrice: '',
      salary: '',
      startDate: null,
      endDate: null,
      expectedDropTime: null,
      instructions: '',
      driver: '',
      vehicle: '',
      customer: '',
      startLat: '',
      startLon: '',
      endLat: '',
      endLon: '',
    });
    setDrivers([]);
    setVehicles([]);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchExports(vendorId);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading exports...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Header */}
      <FadeInView>
        <LinearGradient
          colors={gradients.tertiary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.statsHeader}
        >
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{exportsList.length}</Text>
            <Text style={styles.statLabel}>Total Exports</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {exportsList.filter((e) => e.status === 'IN_TRANSIT').length}
            </Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {exportsList.filter((e) => e.status === 'COMPLETED').length}
            </Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </LinearGradient>
      </FadeInView>

      {/* Export List */}
      <FlatList
        data={exportsList}
        keyExtractor={(item) => item._id}
        renderItem={({ item, index }) => <ExportCard item={item} index={index} />}
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
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No Exports Yet</Text>
            <Text style={styles.emptySubtext}>
              Create your first export to start shipping
            </Text>
          </FadeInView>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowForm(true)}
        activeOpacity={0.8}
      >
        <LinearGradient colors={gradients.primary} style={styles.fabGradient}>
          <Text style={styles.fabText}>+</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Create Export Modal */}
      <Modal visible={showForm} animationType="slide">
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <LinearGradient colors={gradients.primary} style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                resetForm();
                setShowForm(false);
              }}
            >
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create Export</Text>
            <View style={{ width: 40 }} />
          </LinearGradient>

          <ScrollView style={styles.formContent} showsVerticalScrollIndicator={false}>
            {/* Form Section: Product Details */}
            <Text style={styles.sectionTitle}>📦 Product Details</Text>
            <ThemedCard variant="outlined" style={styles.formSection}>
              <Text style={styles.inputLabel}>Item Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Fresh Mangoes"
                placeholderTextColor={colors.text.muted}
                value={form.itemName}
                onChangeText={(v) => setForm((f) => ({ ...f, itemName: v }))}
              />

              <Text style={styles.inputLabel}>Quantity</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 500"
                placeholderTextColor={colors.text.muted}
                keyboardType="numeric"
                value={form.quantity}
                onChangeText={(v) => setForm((f) => ({ ...f, quantity: v }))}
              />

              <Text style={styles.inputLabel}>Unit (optional)</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={form.unit}
                  onValueChange={(value) => setForm((f) => ({ ...f, unit: value }))}
                  style={styles.picker}
                >
                  <Picker.Item label="-- No unit --" value="" />
                  {UNIT_OPTIONS.map((u) => (
                    <Picker.Item key={u} label={u} value={u} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.inputLabel}>Instructions / Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="e.g. Handle with care, keep refrigerated"
                placeholderTextColor={colors.text.muted}
                multiline
                numberOfLines={3}
                value={form.instructions}
                onChangeText={(v) => setForm((f) => ({ ...f, instructions: v }))}
              />
            </ThemedCard>

            {/* Form Section: Customer */}
            <Text style={styles.sectionTitle}>🧑‍🤝‍🧑 Customer (optional)</Text>
            <ThemedCard variant="outlined" style={styles.formSection}>
              <Text style={styles.inputLabel}>
                Associate a customer with this shipment. This does NOT grant
                them tracking access — grant that separately from the
                shipment's tracking permissions.
              </Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={form.customer}
                  onValueChange={(value) => setForm((f) => ({ ...f, customer: value }))}
                  style={styles.picker}
                >
                  <Picker.Item label="-- No customer --" value="" />
                  {customers.map((c) => (
                    <Picker.Item key={c._id} label={c.name} value={c._id} />
                  ))}
                </Picker>
              </View>
            </ThemedCard>

            {/* Form Section: Schedule */}
            <Text style={styles.sectionTitle}>📅 Schedule</Text>
            <ThemedCard variant="outlined" style={styles.formSection}>
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setDatePicker({ show: true, target: 'start' })}
                >
                  <Text style={styles.dateLabel}>Start Date</Text>
                  <Text style={form.startDate ? styles.dateValue : styles.datePlaceholder}>
                    {form.startDate ? form.startDate.toDateString() : 'Select Date'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setDatePicker({ show: true, target: 'end' })}
                >
                  <Text style={styles.dateLabel}>End Date</Text>
                  <Text style={form.endDate ? styles.dateValue : styles.datePlaceholder}>
                    {form.endDate ? form.endDate.toDateString() : 'Select Date'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setDatePicker({ show: true, target: 'expectedDropTime' })}
              >
                <Text style={styles.dateLabel}>Expected Drop Time (optional)</Text>
                <Text style={form.expectedDropTime ? styles.dateValue : styles.datePlaceholder}>
                  {form.expectedDropTime ? form.expectedDropTime.toLocaleString() : 'Select Date & Time'}
                </Text>
              </TouchableOpacity>
            </ThemedCard>

            {/* Form Section: Pricing */}
            <Text style={styles.sectionTitle}>💰 Pricing</Text>
            <ThemedCard variant="outlined" style={styles.formSection}>
              <View style={styles.priceRow}>
                <View style={styles.priceField}>
                  <Text style={styles.inputLabel}>Cost Price</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="₹0"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="numeric"
                    value={form.costPrice}
                    onChangeText={(v) => setForm((f) => ({ ...f, costPrice: v }))}
                  />
                </View>
                <View style={styles.priceField}>
                  <Text style={styles.inputLabel}>Sale Price</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="₹0"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="numeric"
                    value={form.salePrice}
                    onChangeText={(v) => setForm((f) => ({ ...f, salePrice: v }))}
                  />
                </View>
              </View>
              <Text style={styles.inputLabel}>Driver Salary</Text>
              <TextInput
                style={styles.input}
                placeholder="₹0"
                placeholderTextColor={colors.text.muted}
                keyboardType="numeric"
                value={form.salary}
                onChangeText={(v) => setForm((f) => ({ ...f, salary: v }))}
              />
            </ThemedCard>

            {/* Form Section: Resources */}
            {(drivers.length > 0 || vehicles.length > 0) && (
              <>
                <Text style={styles.sectionTitle}>🚚 Resources</Text>
                <ThemedCard variant="outlined" style={styles.formSection}>
                  {drivers.length > 0 && (
                    <>
                      <Text style={styles.inputLabel}>Select Driver</Text>
                      <View style={styles.pickerContainer}>
                        <Picker
                          selectedValue={form.driver}
                          onValueChange={(value) => setForm((f) => ({ ...f, driver: value }))}
                          style={styles.picker}
                        >
                          <Picker.Item label="-- Select Driver --" value="" />
                          {drivers.map((d) => (
                            <Picker.Item key={d._id} label={d.name} value={d._id} />
                          ))}
                        </Picker>
                      </View>
                    </>
                  )}
                  {vehicles.length > 0 && (
                    <>
                      <Text style={styles.inputLabel}>Select Vehicle</Text>
                      <View style={styles.pickerContainer}>
                        <Picker
                          selectedValue={form.vehicle}
                          onValueChange={(value) => setForm((f) => ({ ...f, vehicle: value }))}
                          style={styles.picker}
                        >
                          <Picker.Item label="-- Select Vehicle --" value="" />
                          {vehicles.map((v) => (
                            <Picker.Item
                              key={v._id}
                              label={`${v.vehicleNumber} (${v.model || v.brand || 'N/A'})`}
                              value={v._id}
                            />
                          ))}
                        </Picker>
                      </View>
                    </>
                  )}
                </ThemedCard>
              </>
            )}

            {/* Form Section: Locations */}
            <Text style={styles.sectionTitle}>📍 Locations</Text>
            <ThemedCard variant="outlined" style={styles.formSection}>
              <TouchableOpacity
                style={styles.locationButton}
                onPress={() => setMapModal({ show: true, field: 'start' })}
              >
                <Text style={styles.locationLabel}>Start Location</Text>
                <Text style={form.startLat ? styles.locationValue : styles.locationPlaceholder}>
                  {form.startLat
                    ? `${parseFloat(form.startLat).toFixed(4)}, ${parseFloat(form.startLon).toFixed(4)}`
                    : 'Pick on map →'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.locationButton}
                onPress={() => setMapModal({ show: true, field: 'end' })}
              >
                <Text style={styles.locationLabel}>End Location</Text>
                <Text style={form.endLat ? styles.locationValue : styles.locationPlaceholder}>
                  {form.endLat
                    ? `${parseFloat(form.endLat).toFixed(4)}, ${parseFloat(form.endLon).toFixed(4)}`
                    : 'Pick on map →'}
                </Text>
              </TouchableOpacity>
            </ThemedCard>

            {/* Submit Button */}
            <ThemedButton
              title={submitting ? 'Creating...' : 'Create Export'}
              variant="gradient"
              onPress={handleSubmit}
              disabled={submitting}
              loading={submitting}
              fullWidth
              style={styles.submitButton}
            />

            <ThemedButton
              title="Cancel"
              variant="ghost"
              onPress={() => {
                resetForm();
                setShowForm(false);
              }}
              fullWidth
              style={styles.cancelButton}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Date Picker */}
      <DateTimePickerModal
        isVisible={datePicker.show}
        mode={datePicker.target === 'expectedDropTime' ? 'datetime' : 'date'}
        minimumDate={new Date()}
        onConfirm={(date) => {
          const target = datePicker.target;
          setDatePicker({ show: false, target: null });
          const field = target === 'start' ? 'startDate' : target === 'end' ? 'endDate' : 'expectedDropTime';
          setForm((f) => ({ ...f, [field]: date }));
        }}
        onCancel={() => setDatePicker({ show: false, target: null })}
      />

      {/* Map Modal */}
      <Modal visible={mapModal.show}>
        <View style={{ flex: 1 }}>
          <LinearGradient colors={gradients.primary} style={styles.mapHeader}>
            <Text style={styles.mapTitle}>
              Select {mapModal.field === 'start' ? 'Start' : 'End'} Location
            </Text>
            <TouchableOpacity
              onPress={() => setMapModal({ show: false })}
              style={styles.mapCloseButton}
            >
              <Text style={styles.mapCloseText}>✕</Text>
            </TouchableOpacity>
          </LinearGradient>
          <WebView
            source={{ html: MAP_HTML }}
            onMessage={(e) => {
              try {
                const { lat, lng } = JSON.parse(e.nativeEvent.data);
                const field = mapModal.field;
                setForm((f) => ({
                  ...f,
                  [`${field}Lat`]: lat.toString(),
                  [`${field}Lon`]: lng.toString(),
                }));
                setMapModal({ show: false, field: null });
              } catch (error) {
                console.error('Error parsing map data:', error);
              }
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

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
  exportCard: {
    marginBottom: spacing.md,
  },
  exportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  exportIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  exportEmoji: {
    fontSize: 24,
  },
  exportInfo: {
    flex: 1,
  },
  exportName: {
    ...typography.h4,
    color: colors.text.primary,
  },
  exportQty: {
    ...typography.caption,
    color: colors.text.muted,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
  },
  statusText: {
    ...typography.captionMedium,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  detailItem: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: 2,
  },
  detailValue: {
    ...typography.bodySmall,
    color: colors.text.primary,
  },
  resourceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  resourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
  },
  resourceIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  resourceText: {
    ...typography.captionMedium,
    color: colors.primary,
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
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    paddingTop: spacing.xl,
  },
  modalClose: {
    fontSize: 24,
    color: colors.text.light,
    padding: spacing.sm,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.light,
  },
  formContent: {
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  formSection: {
    marginBottom: spacing.sm,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  multilineInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dateButton: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  dateLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: spacing.xxs,
  },
  dateValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  datePlaceholder: {
    ...typography.body,
    color: colors.text.muted,
  },
  priceRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  priceField: {
    flex: 1,
  },
  pickerContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  picker: {
    color: colors.text.primary,
  },
  locationButton: {
    backgroundColor: colors.background.secondary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  locationLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: spacing.xxs,
  },
  locationValue: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  locationPlaceholder: {
    ...typography.body,
    color: colors.text.muted,
  },
  submitButton: {
    marginTop: spacing.xl,
  },
  cancelButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingTop: spacing.xl,
  },
  mapTitle: {
    ...typography.h4,
    color: colors.text.light,
  },
  mapCloseButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.round,
  },
  mapCloseText: {
    fontSize: 18,
    color: colors.text.light,
    fontWeight: 'bold',
  },
});