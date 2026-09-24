// components/DriverExportHealth.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import api from '../../../services/api';
import { AnimatedCircularProgress } from 'react-native-circular-progress';
import { getFreshness, formatMinutesAgo, FRESHNESS } from '../../../utils/freshness';
import { getConditionMeta, getRiskLabel } from '../../../utils/condition';

const DriverExportHealth = ({ exportId, onBack }) => {
  const [sensorData, setSensorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [condition, setCondition] = useState(undefined); // undefined = loading, null = unavailable

  useEffect(() => {
    const fetchSensorData = async () => {
      try {
        const res = await api.get(`/api/driver/device/sensor-data/${exportId}`);
        const dataArray = res.data;
        if (Array.isArray(dataArray) && dataArray.length > 0) {
          setSensorData(dataArray[dataArray.length - 1]); // latest one
        } else {
          setSensorData(null);
        }
      } catch (err) {
        console.error('Error fetching sensor data:', err);
        setSensorData(null);
      } finally {
        setLoading(false);
      }
    };

    const fetchCondition = async () => {
      try {
        const res = await api.get(`/api/driver/device/condition/${exportId}`);
        setCondition(res.data);
      } catch (err) {
        console.error('Error fetching condition status:', err);
        setCondition(null);
      }
    };

    fetchSensorData();
    fetchCondition();
  }, [exportId]);

  const getColor = (label, value) => {
    switch (label) {
      case 'Temperature':
        if (value <= 24) return '#2ECC71'; // green
        if (value <= 26) return '#F39C12'; // orange
        return '#E74C3C'; // red
      case 'Humidity':
        if (value <= 50) return '#2ECC71';
        if (value <= 60) return '#F39C12';
        return '#E74C3C';
      case 'Ethylene':
        if (value <= 5) return '#2ECC71';
        if (value <= 7) return '#F39C12';
        return '#E74C3C';
      default:
        return '#888';
    }
  };

  const renderGauge = (label, value, max, unit) => {
    const color = getColor(label, value);
    return (
      <View style={styles.gaugeContainer}>
        <AnimatedCircularProgress
          size={160}
          width={12}
          fill={(value / max) * 100}
          tintColor={color}
          backgroundColor="#eee"
          rotation={0}
          lineCap="round"
        >
          {() => (
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.gaugeLabel}>{label}</Text>
              <Text style={[styles.gaugeValue, { color }]}>{value} {unit}</Text>
            </View>
          )}
        </AnimatedCircularProgress>
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🍎 Monitoring Export Health</Text>
      <Text style={styles.subtext}>Export ID: {exportId}</Text>

      {condition && (() => {
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
      })()}

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />
      ) : sensorData ? (
        <>
          {renderGauge('Temperature', sensorData.temperature, 50, '°C')}
          {renderGauge('Humidity', sensorData.humidity, 100, '%')}
          {renderGauge('Ethylene', sensorData.ethyleneLevel, 20, 'ppm')}

          <Text style={styles.timestamp}>
            📅 Last updated: {new Date(sensorData.timestamp).toLocaleString()}
          </Text>
          {(() => {
            const freshness = getFreshness(sensorData.timestamp);
            return (
              <Text
                style={[
                  styles.freshnessLabel,
                  { color: freshness.status === FRESHNESS.RECENT ? '#2ECC71' : '#E67E22' },
                ]}
              >
                {freshness.status === FRESHNESS.RECENT ? '● Recent' : '● Stale'} ({formatMinutesAgo(freshness.minutesAgo)})
              </Text>
            );
          })()}
        </>
      ) : (
        <Text style={styles.errorText}>⚠ No recent sensor data available.</Text>
      )}

      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>🔙 Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default DriverExportHealth;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2C3E50',
  },
  subtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  conditionBanner: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
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
  gaugeContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  gaugeLabel: {
    fontSize: 16,
    color: '#444',
    marginBottom: 4,
  },
  gaugeValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  timestamp: {
    marginTop: 16,
    fontSize: 13,
    color: '#888',
  },
  freshnessLabel: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    marginTop: 20,
    color: '#E74C3C',
    fontSize: 16,
  },
  back: {
    marginTop: 30,
    fontSize: 16,
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
});
