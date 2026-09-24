import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';

/**
 * Props:
 *   onSelectCustomer(id: string, name: string)
 *   vendorId?   – if omitted, we read it from AsyncStorage ('userId')
 */
const CustomerSelectList = ({ onSelectCustomer, vendorId: propVendorId }) => {
  const [vendorId,  setVendorId]  = useState(propVendorId);
  const [customers, setCustomers] = useState([]);
  const [filtered,  setFiltered]  = useState([]);
  const [query,     setQuery]     = useState('');
  const [loading,   setLoading]   = useState(true);

  /* -------------------------------------------------------------- *
   *  1. Ensure we have vendorId (read from storage if not supplied)
   * -------------------------------------------------------------- */
  useEffect(() => {
    if (vendorId) return;
    AsyncStorage.getItem('userId').then(id => setVendorId(id));
  }, [vendorId]);

  /* -------------------------------------------------------------- *
   *  2. Fetch customer list once vendorId is known
   * -------------------------------------------------------------- */
  useEffect(() => {
    if (!vendorId) return;

    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/chat/customers/get', {
          params: { vendorId },
        });
        setCustomers(data);
        setFiltered(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [vendorId]);

  /* -------------------------------------------------------------- *
   *  3. Live search filter
   * -------------------------------------------------------------- */
  useEffect(() => {
    if (!query.trim()) return setFiltered(customers);
    const term = query.toLowerCase();
    setFiltered(
      customers.filter(c => c.name.toLowerCase().includes(term))
    );
  }, [query, customers]);

  /* -------------------------------------------------------------- *
   *  4. UI
   * -------------------------------------------------------------- */
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Pick a Customer to Chat</Text>

      {/* Search bar */}
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search customers..."
        style={styles.searchBox}
      />

      {/* Customer list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => onSelectCustomer(item._id, item.name)}
          >
            <Text style={styles.name}>{item.name}</Text>
            {/* Include any other info you populated, e.g. email */}
            {item.email && <Text style={styles.sub}>{item.email}</Text>}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', marginTop: 40 }}>
            No customers found
          </Text>
        }
      />
    </View>
  );
};

export default CustomerSelectList;

/* ------------------------------------------------------------------ *
 *  Styles
 * ------------------------------------------------------------------ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  heading:   { fontSize: 22, fontWeight: '600', marginBottom: 12, textAlign: 'center' },

  searchBox: {
    padding: 10, backgroundColor: '#EEE',
    borderRadius: 10, marginBottom: 12,
  },

  card: {
    padding: 14, backgroundColor: '#FFF',
    borderRadius: 8, marginBottom: 10, elevation: 1,
  },
  name: { fontSize: 18, fontWeight: '500' },
  sub:  { fontSize: 14, color: '#555' },
});
