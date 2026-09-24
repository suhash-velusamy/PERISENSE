/**
 * VendorChatHome.js
 * Landing screen for the Chat tab — routes into the existing customer/driver
 * chat picker screens (CustomerSelectList, DriverSelectList), which in turn
 * lead to the existing VendorChat conversation screen. Vendors chat with two
 * separate audiences (unlike Customer, which only chats with vendors), so
 * this landing step picks which audience before reusing the same existing
 * chat screens. No new chat system — this is a router, not a redesign (same
 * pattern as FleetHome.js).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ThemedCard from '../../components/ThemedCard';
import { colors, spacing, borderRadius, typography } from '../../theme';

const ChatCard = ({ icon, title, subtitle, onPress }) => (
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

const VendorChatHome = ({ navigation }) => (
  <View style={styles.container}>
    <ChatCard
      icon="💬"
      title="Chat with Customers"
      subtitle="Message customers about their orders"
      onPress={() => navigation.navigate('CustomerChatSelect')}
    />
    <ChatCard
      icon="🗣️"
      title="Chat with Drivers"
      subtitle="Message your drivers"
      onPress={() => navigation.navigate('DriverChatSelect')}
    />
  </View>
);

export default VendorChatHome;

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
