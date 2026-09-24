/**
 * CustomerConversationList.js
 * Chat tab landing screen — real conversations only, built entirely from
 * the existing chat endpoints (there is no "list conversations" endpoint,
 * so this fetches the vendor directory once and checks each vendor's real
 * /chat/history to find threads that actually have messages). No fake
 * data: a vendor only shows up here if a message genuinely exists, and no
 * unread state is shown because the Message model has no read/unread field.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import ThemedCard from '../../components/ThemedCard';
import ThemedButton from '../../components/ThemedButton';

const formatTimestamp = (ts) => {
  if (!ts) return '';
  const date = new Date(ts);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString();
};

const ConversationRow = ({ item, onPress }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
    <ThemedCard variant="elevated" style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.vendorName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={styles.vendorName} numberOfLines={1}>{item.vendorName}</Text>
          <Text style={styles.timestamp}>{formatTimestamp(item.lastMessage?.timestamp)}</Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage?.content || ''}
        </Text>
      </View>
    </ThemedCard>
  </TouchableOpacity>
);

const CustomerConversationList = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState(null);

  const fetchConversations = useCallback(async () => {
    try {
      setError(null);
      const customerId = await AsyncStorage.getItem('userId');
      if (!customerId) {
        setConversations([]);
        return;
      }

      const { data: vendors } = await api.get('/chat/vendors/get');

      const results = await Promise.allSettled(
        (vendors || []).map((vendor) =>
          api
            .get('/chat/history', {
              params: { vendorId: vendor._id, targetId: customerId, chatType: 'customer' },
            })
            .then((res) => ({ vendor, history: res.data || [] }))
        )
      );

      const threads = results
        .filter((r) => r.status === 'fulfilled' && r.value.history.length > 0)
        .map((r) => {
          const { vendor, history } = r.value;
          const lastMessage = history[history.length - 1];
          return {
            vendorId: vendor._id,
            vendorName: vendor.name,
            lastMessage,
          };
        })
        .sort((a, b) => new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp));

      setConversations(threads);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('Unable to load your conversations. Try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const openConversation = (item) => {
    navigation.navigate('ChatConversation', { vendorId: item.vendorId, vendorName: item.vendorName });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.vendorId}
        renderItem={({ item }) => (
          <ConversationRow item={item} onPress={() => openConversation(item)} />
        )}
        contentContainerStyle={conversations.length === 0 ? styles.emptyListContent : styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>
              {error || 'No conversations yet'}
            </Text>
            {!error && (
              <Text style={styles.emptySubtitle}>Start a conversation with a vendor</Text>
            )}
            <ThemedButton
              title={error ? 'Retry' : '+ New Chat'}
              variant="primary"
              onPress={() => (error ? fetchConversations() : navigation.navigate('NewChat'))}
              style={{ marginTop: spacing.lg }}
            />
          </View>
        }
      />

      {conversations.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('NewChat')}
          activeOpacity={0.85}
        >
          <Text style={styles.fabText}>+ New Chat</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default CustomerConversationList;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.muted,
    marginTop: spacing.md,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl * 2,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight + '30',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    ...typography.h4,
    color: colors.primary,
  },
  rowBody: {
    flex: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vendorName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  timestamp: {
    ...typography.caption,
    color: colors.text.muted,
  },
  lastMessage: {
    ...typography.bodySmall,
    color: colors.text.muted,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h4,
    color: colors.text.primary,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.text.muted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.round,
    ...shadows.md,
  },
  fabText: {
    ...typography.button,
    color: colors.text.light,
  },
});
