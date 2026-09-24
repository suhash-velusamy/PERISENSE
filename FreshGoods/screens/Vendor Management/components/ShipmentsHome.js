/**
 * ShipmentsHome.js
 * Landing screen for the Shipments tab — routes into the existing Export
 * Dashboard, Create Export, Goods Health, and Analytics screens, all of
 * which used to be reached from the sidebar. Vendors operate them together
 * as part of running shipments, so they're grouped under one tab instead of
 * scattered sidebar entries. No business logic here; this is a router, not
 * a redesign (same pattern as FleetHome.js).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ThemedCard from '../../components/ThemedCard';
import { colors, spacing, borderRadius, typography } from '../../theme';

const ShipmentsCard = ({ icon, title, subtitle, onPress }) => (
  <ThemedCard variant="elevated" style={styles.card} onPress={onPress}>
    <View style={styles.iconWrap}>
      <Text style={styles.icon}>{icon}</Text>
    </View>
    <View style={styles.textWrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
    <Text style={styles.chevron}>›</Text>
  </ThemedCard>
);

const ShipmentsHome = ({ navigation }) => (
  <View style={styles.container}>
    <ShipmentsCard
      icon="📊"
      title="Export Dashboard"
      subtitle="Track and manage active shipments"
      onPress={() => navigation.navigate('ExportDashboard')}
    />
    <ShipmentsCard
      icon="📦"
      title="Create Export"
      subtitle="Start a new shipment"
      onPress={() => navigation.navigate('CreateExport')}
    />
    <ShipmentsCard
      icon="🍏"
      title="Goods Health"
      subtitle="Monitor sensor-based condition"
      onPress={() => navigation.navigate('GoodsHealth')}
    />
    <ShipmentsCard
      icon="📈"
      title="Analytics"
      subtitle="Performance and shipment trends"
      onPress={() => navigation.navigate('Analytics')}
    />
  </View>
);

export default ShipmentsHome;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    padding: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  icon: {
    fontSize: 22,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    ...typography.h4,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.text.muted,
    marginTop: 2,
  },
  chevron: {
    fontSize: 24,
    color: colors.text.muted,
  },
});
