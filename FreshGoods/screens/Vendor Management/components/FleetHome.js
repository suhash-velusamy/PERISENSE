/**
 * FleetHome.js
 * Landing screen for the Fleet tab — routes into the existing Driver
 * Management and Vehicle Management screens. Vendors operate both together,
 * so they're grouped under one tab instead of two separate sidebar entries.
 * No business logic here; this is a router, not a redesign.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ThemedCard from '../../components/ThemedCard';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';

const FleetCard = ({ icon, title, subtitle, onPress }) => (
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

const FleetHome = ({ navigation }) => (
  <View style={styles.container}>
    <FleetCard
      icon="👨‍✈️"
      title="Drivers"
      subtitle="Manage your driver roster"
      onPress={() => navigation.navigate('Drivers')}
    />
    <FleetCard
      icon="🚗"
      title="Vehicles"
      subtitle="Manage your vehicle fleet"
      onPress={() => navigation.navigate('Vehicles')}
    />
    <FleetCard
      icon="📡"
      title="Devices"
      subtitle="Register and assign IoT devices"
      onPress={() => navigation.navigate('Devices')}
    />
  </View>
);

export default FleetHome;

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
