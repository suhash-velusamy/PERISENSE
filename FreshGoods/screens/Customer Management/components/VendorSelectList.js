import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, FlatList,
  TouchableOpacity, ActivityIndicator, StyleSheet
} from 'react-native';
import api from '../../services/api';

const VendorSelectList = ({ onSelectVendor }) => {
  const [vendors, setVendors] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  /* fetch vendors on mount */
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/chat/vendors/get');
        setVendors(data);
        setFiltered(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* live filter */
  useEffect(() => {
    if (!query.trim()) return setFiltered(vendors);
    const term = query.toLowerCase();
    setFiltered(vendors.filter(v => v.name.toLowerCase().includes(term)));
  }, [query, vendors]);

  if (loading)
    return <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 40 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Pick a Vendor to Chat</Text>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search vendors..."
        style={styles.searchBox}
      />

      <FlatList
        data={filtered}
        keyExtractor={item => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => onSelectVendor(item._id, item.name)}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.sub}>{item.businessName}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', marginTop: 40 }}>No vendors found</Text>
        }
      />
    </View>
  );
};

export default VendorSelectList;

/* ----- Styles (matches snippet you referenced) ----- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  heading:   { fontSize: 22, fontWeight: '600', marginBottom: 12, textAlign: 'center' },

  searchBox: {
    padding: 10, backgroundColor: '#EEE',
    borderRadius: 10, marginBottom: 12
  },

  card: {
    padding: 14, backgroundColor: '#FFF',
    borderRadius: 8, marginBottom: 10, elevation: 1
  },
  name: { fontSize: 18, fontWeight: '500' },
  sub:  { fontSize: 14, color: '#555' },
});
