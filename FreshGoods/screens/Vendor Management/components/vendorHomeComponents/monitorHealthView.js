/**
 * MonitorHealthView - Sensor data display with date filtering
 * Shows temperature, humidity, and ethylene levels with gauges
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Button,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import api from '../../../services/api';
import { AnimatedCircularProgress } from 'react-native-circular-progress';
import { colors, spacing, typography, borderRadius } from '../../../theme';
import { getFreshness, formatMinutesAgo, FRESHNESS } from '../../../utils/freshness';
import { getConditionMeta, getRiskLabel } from '../../../utils/condition';

const Gauge = ({ label, value, max, type }) => {
  const getColor = (val) => {
    if (type === 'temperature') {
      if (val <= 24) return '#2ecc71';
      if (val <= 26) return '#f39c12';
      return '#e74c3c';
    }
    if (type === 'humidity') {
      if (val <= 50) return '#2ecc71';
      if (val <= 60) return '#f39c12';
      return '#e74c3c';
    }
    if (type === 'ethyleneLevel') {
      if (val <= 2) return '#2ecc71';
      if (val <= 9) return '#f39c12';
      return '#e74c3c';
    }
    return '#007AFF';
  };

  return (
    <View style={styles.gaugeContainer}>
      <Text style={styles.gaugeLabel}>{label}</Text>
      <AnimatedCircularProgress
        size={130}
        width={12}
        fill={(value / max) * 100}
        tintColor={getColor(value)}
        backgroundColor="#eee"
        rotation={0}
        duration={800}
      >
        {() => <Text style={styles.gaugeValue}>{value?.toFixed(1) || '0'}</Text>}
      </AnimatedCircularProgress>
    </View>
  );
};

const ConditionBanner = ({ condition }) => {
  if (condition === undefined) {
    return (
      <View style={[styles.conditionBanner, { backgroundColor: '#F3F4F6' }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }
  if (!condition) return null;

  const meta = getConditionMeta(condition.conditionStatus);
  return (
    <View style={[styles.conditionBanner, { backgroundColor: meta.bg, borderColor: meta.color }]}>
      <View style={styles.conditionHeaderRow}>
        <Text style={[styles.conditionStatusText, { color: meta.color }]}>
          {meta.icon} {meta.label.toUpperCase()}
        </Text>
        <Text style={[styles.conditionRiskText, { color: meta.color }]}>
          {getRiskLabel(condition.riskStatus)}
        </Text>
      </View>
      <Text style={styles.conditionReasonText}>{condition.reason}</Text>
    </View>
  );
};

const MonitorHealthView = ({ selectedExport, onBack }) => {
  const [data, setData] = useState(null);
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [condition, setCondition] = useState(undefined); // undefined = loading, null = unavailable

  const formatDate = (date) => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  const formatDisplayDate = (date) => {
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const fetchSensorData = useCallback(async (date) => {
    try {
      setLoading(true);
      const dateParam = formatDate(date);
      const res = await api.get(
        `/api/vendor/device/sensor-data/${selectedExport._id}`,
        { params: { date: dateParam } }
      );

      setAllData(res.data);

      if (res.data.length === 0) {
        setData(null);
      } else {
        // Get the latest reading for the selected date
        setData(res.data[res.data.length - 1]);
      }
    } catch (err) {
      console.error('Sensor fetch error:', err);
      Alert.alert('Error', 'Failed to fetch sensor data.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedExport._id]);

  useEffect(() => {
    fetchSensorData(selectedDate);
  }, [selectedDate, fetchSensorData]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/api/vendor/device/condition/${selectedExport._id}`);
        if (!cancelled) setCondition(res.data);
      } catch (err) {
        console.error('Condition fetch error:', err);
        if (!cancelled) setCondition(null);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedExport._id]);

  const handleDateConfirm = (date) => {
    setShowDatePicker(false);
    setSelectedDate(date);
  };

  const goToPreviousDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
  };

  const goToNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    if (next <= new Date()) {
      setSelectedDate(next);
    }
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  return (
    <ScrollView contentContainerStyle={styles.viewContainer}>
      <Text style={styles.viewTitle}>📊 {selectedExport.itemName}</Text>

      <ConditionBanner condition={condition} />

      {/* Date Selector */}
      <View style={styles.dateSelector}>
        <TouchableOpacity onPress={goToPreviousDay} style={styles.arrowButton}>
          <Text style={styles.arrowText}>◀</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          style={styles.dateButton}
        >
          <Text style={styles.dateButtonText}>{formatDisplayDate(selectedDate)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={goToNextDay}
          style={[styles.arrowButton, selectedDate.toDateString() === new Date().toDateString() && styles.disabledButton]}
          disabled={selectedDate.toDateString() === new Date().toDateString()}
        >
          <Text style={[styles.arrowText, selectedDate.toDateString() === new Date().toDateString() && styles.disabledText]}>▶</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={goToToday} style={styles.todayButton}>
        <Text style={styles.todayButtonText}>Today</Text>
      </TouchableOpacity>

      <DateTimePickerModal
        isVisible={showDatePicker}
        mode="date"
        onConfirm={handleDateConfirm}
        onCancel={() => setShowDatePicker(false)}
        date={selectedDate}
        maximumDate={new Date()}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Fetching sensor data...</Text>
        </View>
      ) : data ? (
        <>
          <View style={styles.gaugeRow}>
            <Gauge label="Temperature (°C)" value={data.temperature} max={40} type="temperature" />
            <Gauge label="Humidity (%)" value={data.humidity} max={100} type="humidity" />
          </View>

          <View style={styles.gaugeRow}>
            <Gauge label="Ethylene Gas (ppm)" value={data.ethyleneLevel} max={25} type="ethyleneLevel" />
          </View>

          <View style={styles.statsContainer}>
            <Text style={styles.statsTitle}>📈 Readings for {formatDisplayDate(selectedDate)}</Text>
            <Text style={styles.statsText}>Total readings: {allData.length}</Text>
            {data.timestamp && (() => {
              const freshness = getFreshness(data.timestamp);
              return (
                <>
                  <Text style={styles.timestampLabel}>
                    🕒 Last reading: {new Date(data.timestamp).toLocaleTimeString()} ({formatMinutesAgo(freshness.minutesAgo)})
                  </Text>
                  <Text
                    style={[
                      styles.freshnessLabel,
                      freshness.status === FRESHNESS.RECENT ? styles.freshnessRecent : styles.freshnessStale,
                    ]}
                  >
                    {freshness.status === FRESHNESS.RECENT ? '● Recent' : '● Stale'}
                  </Text>
                </>
              );
            })()}
          </View>
        </>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No sensor data for this date</Text>
          <Text style={styles.emptySubtext}>Try selecting a different date</Text>
        </View>
      )}

      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default MonitorHealthView;

const styles = StyleSheet.create({
  viewContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    flexGrow: 1,
  },
  viewTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#007AFF',
    textAlign: 'center',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  arrowButton: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  arrowText: {
    fontSize: 16,
    color: '#007AFF',
  },
  dateButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    marginHorizontal: 10,
  },
  dateButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  disabledButton: {
    backgroundColor: '#e0e0e0',
  },
  disabledText: {
    color: '#999',
  },
  todayButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 20,
    marginBottom: 20,
  },
  todayButtonText: {
    color: '#007AFF',
    fontWeight: '500',
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  conditionBanner: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
    minHeight: 40,
    justifyContent: 'center',
  },
  conditionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conditionStatusText: {
    fontSize: 15,
    fontWeight: '700',
  },
  conditionRiskText: {
    fontSize: 12,
    fontWeight: '700',
  },
  conditionReasonText: {
    marginTop: 6,
    fontSize: 13,
    color: '#444',
  },
  gaugeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  gaugeContainer: {
    alignItems: 'center',
    marginHorizontal: 10,
    marginBottom: 20,
  },
  gaugeLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    color: '#444',
    textAlign: 'center',
  },
  gaugeValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statsContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginVertical: 10,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  statsText: {
    fontSize: 13,
    color: '#666',
  },
  timestampLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 5,
    fontStyle: 'italic',
  },
  freshnessLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  freshnessRecent: {
    color: '#2ecc71',
  },
  freshnessStale: {
    color: '#e67e22',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 5,
  },
  backButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#f0f0f0',
    borderRadius: 25,
  },
  backButtonText: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
