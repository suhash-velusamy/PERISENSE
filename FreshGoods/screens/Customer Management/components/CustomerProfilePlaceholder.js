import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

const CustomerProfilePlaceholder = () => (
  <View style={styles.container}>
    <Text style={styles.title}>👤 Profile Management</Text>
    <Text style={styles.subtitle}>This section is under development.</Text>
    <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
  </View>
);

export default CustomerProfilePlaceholder;

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 12, color: '#333' },
  subtitle: { fontSize: 16, color: '#666' },
  loader: { marginTop: 24 },
});
