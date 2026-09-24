/**
 * CustomerChatPlaceholder.js
 * Premium chat interface with modern UI and error handling
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import Pusher from 'pusher-js';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { API_BASE_URL } from '../../config/env';
import {
  colors,
  gradients,
  spacing,
  borderRadius,
  typography,
  shadows,
} from '../../theme';
import { FadeInView, SlideInView } from '../../components/AnimatedComponents';

/* ------------------------------------------------------------------ *
 * Config
 * ------------------------------------------------------------------ */
const API_BASE = API_BASE_URL;
const PUSHER_KEY = '562e97ac482dc6689524';
const PUSHER_CLUSTER = 'ap2';
const CHAT_EVENT = 'new-message';

/**
 * CustomerChat - Premium chat interface
 */
export default function CustomerChat({
  vendorId,
  vendorName = 'Vendor',
  customerId: cidProp,
  onBack,
}) {
  const nav = useNavigation();
  const [customerId, setCustomerId] = useState(cidProp || null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const flatRef = useRef(null);

  // Get customer ID
  useEffect(() => {
    if (customerId) return;
    AsyncStorage.getItem('userId').then((id) => id && setCustomerId(id));
  }, [customerId]);

  // Setup Pusher and fetch history
  useEffect(() => {
    if (!customerId || !vendorId) return;

    let pusher;
    let channel;
    let cancelled = false;

    (async () => {
      // Pusher's authorizer makes its own HTTP request outside of our axios
      // instance, so the JWT has to be attached to it explicitly — the
      // backend's /chat/pusher/auth route now requires a valid Bearer token
      // (identity is derived from the verified token, not a client header).
      const token = await AsyncStorage.getItem('token');
      if (cancelled) return;

      try {
        pusher = new Pusher(PUSHER_KEY, {
          cluster: PUSHER_CLUSTER,
          authEndpoint: `${API_BASE}/chat/pusher/auth`,
          auth: { headers: { Authorization: `Bearer ${token}` } },
        });

        const channelName = `private-chat-${vendorId}-${customerId}`;
        channel = pusher.subscribe(channelName);

        channel.bind(CHAT_EVENT, (data) => {
          setMessages((prev) => {
            const exists = prev.some((m) => m._id === data._id);
            if (exists) return prev;
            const updated = [...prev, data];
            updated.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            return updated;
          });
        });
      } catch (err) {
        console.error('Pusher setup error:', err);
      }
    })();

    // Fetch chat history
    api
      .get('/chat/history', {
        params: {
          vendorId,
          targetId: customerId,
          chatType: 'customer',
        },
      })
      .then((res) => {
        const ordered = (res.data || [])
          .slice()
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        setMessages(ordered);
        setError(null);
      })
      .catch((err) => {
        console.error('Fetch history error:', err);
        setError('Could not load chat history');
      })
      .finally(() => setLoading(false));

    return () => {
      cancelled = true;
      if (channel) {
        channel.unbind_all();
        channel.unsubscribe();
      }
      if (pusher) {
        pusher.disconnect();
      }
    };
  }, [customerId, vendorId]);

  // Send message
  const send = useCallback(async () => {
    if (!input.trim() || sending) return;

    const messageText = input.trim();
    setInput('');
    setSending(true);

    // Optimistic update
    const optimisticMessage = {
      _id: `temp-${Date.now()}`,
      senderId: customerId,
      content: messageText,
      timestamp: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      await api.post('/chat/send', {
        vendorId,
        customerId,
        content: messageText,
        senderType: 'customer',
      });
      // Remove optimistic message (real one will come via Pusher)
      setMessages((prev) =>
        prev.filter((m) => m._id !== optimisticMessage._id)
      );
    } catch (err) {
      console.error('Send error', err);
      // Mark optimistic message as failed
      setMessages((prev) =>
        prev.map((m) =>
          m._id === optimisticMessage._id ? { ...m, failed: true, pending: false } : m
        )
      );
      Alert.alert('Send Failed', 'Could not send message. Tap to retry.');
    } finally {
      setSending(false);
    }
  }, [input, sending, customerId, vendorId]);

  // Auto-scroll
  useEffect(() => {
    if (flatRef.current && messages.length > 0) {
      setTimeout(() => {
        flatRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Format time
  const formatTime = (ts) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format date divider
  const formatDate = (ts) => {
    const date = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString();
  };

  // Retry failed message
  const retryMessage = (message) => {
    setMessages((prev) => prev.filter((m) => m._id !== message._id));
    setInput(message.content);
  };

  // Back handler
  const handleBack = () => (onBack ? onBack() : nav.goBack());

  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </View>
    );
  }

  // Message bubble
  const renderMessage = ({ item, index }) => {
    const isMine = item.senderId === customerId;
    const showDateDivider =
      index === 0 ||
      formatDate(item.timestamp) !==
      formatDate(messages[index - 1]?.timestamp);

    return (
      <>
        {showDateDivider && (
          <View style={styles.dateDivider}>
            <View style={styles.dateLine} />
            <Text style={styles.dateText}>{formatDate(item.timestamp)}</Text>
            <View style={styles.dateLine} />
          </View>
        )}
        <SlideInView
          direction={isMine ? 'right' : 'left'}
          delay={0}
          style={[
            styles.bubbleWrapper,
            isMine ? styles.alignRight : styles.alignLeft,
          ]}
        >
          <TouchableOpacity
            activeOpacity={item.failed ? 0.7 : 1}
            onPress={() => item.failed && retryMessage(item)}
          >
            <View
              style={[
                styles.bubble,
                isMine ? styles.bubbleRight : styles.bubbleLeft,
                item.pending && styles.bubblePending,
                item.failed && styles.bubbleFailed,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  isMine ? styles.textRight : styles.textLeft,
                ]}
              >
                {item.content}
              </Text>
            </View>
          </TouchableOpacity>
          <View style={styles.messageFooter}>
            <Text style={styles.timestamp}>{formatTime(item.timestamp)}</Text>
            {item.pending && <Text style={styles.statusIcon}>⏳</Text>}
            {item.failed && <Text style={styles.statusIcon}>❌ Tap to retry</Text>}
            {isMine && !item.pending && !item.failed && (
              <Text style={styles.statusIcon}>✓</Text>
            )}
          </View>
        </SlideInView>
      </>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={gradients.forest}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarText}>
              {vendorName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>{vendorName}</Text>
            <Text style={styles.headerSubtitle}>Online</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton}>
            <Text style={styles.headerButtonIcon}>📞</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(item, i) => item._id || String(i)}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <FadeInView style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>Start a Conversation</Text>
            <Text style={styles.emptySubtext}>
              Send a message to {vendorName}
            </Text>
          </FadeInView>
        }
      />

      {/* Compose Bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={styles.composeBar}>
          <View style={styles.inputContainer}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Type a message..."
              placeholderTextColor={colors.text.muted}
              style={styles.input}
              onSubmitEditing={send}
              multiline
              maxLength={1000}
            />
          </View>
          <TouchableOpacity
            onPress={send}
            disabled={!input.trim() || sending}
            style={[
              styles.sendButton,
              (!input.trim() || sending) && styles.sendButtonDisabled,
            ]}
          >
            <LinearGradient
              colors={
                !input.trim() || sending
                  ? ['#9CA3AF', '#6B7280']
                  : gradients.primary
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sendButtonGradient}
            >
              <Text style={styles.sendIcon}>{sending ? '⏳' : '➤'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Styles
 * ------------------------------------------------------------------ */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  backIcon: {
    fontSize: 20,
    color: colors.text.light,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.light,
  },
  headerTitle: {
    ...typography.bodyMedium,
    color: colors.text.light,
  },
  headerSubtitle: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonIcon: {
    fontSize: 18,
  },
  errorBanner: {
    backgroundColor: colors.errorBg,
    padding: spacing.sm,
    alignItems: 'center',
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
  },
  messageList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexGrow: 1,
  },
  dateDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.light,
  },
  dateText: {
    ...typography.caption,
    color: colors.text.muted,
    marginHorizontal: spacing.md,
  },
  bubbleWrapper: {
    marginVertical: spacing.xs,
    maxWidth: '80%',
  },
  alignLeft: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  alignRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  bubbleLeft: {
    backgroundColor: colors.background.card,
    borderBottomLeftRadius: spacing.xs,
  },
  bubbleRight: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: spacing.xs,
  },
  bubblePending: {
    opacity: 0.7,
  },
  bubbleFailed: {
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.error,
  },
  messageText: {
    ...typography.body,
    lineHeight: 22,
  },
  textLeft: {
    color: colors.text.primary,
  },
  textRight: {
    color: colors.text.light,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xxs,
  },
  timestamp: {
    ...typography.caption,
    color: colors.text.muted,
    marginRight: spacing.xs,
  },
  statusIcon: {
    fontSize: 10,
    color: colors.text.muted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyIcon: {
    fontSize: 56,
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
  },
  composeBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    backgroundColor: colors.background.card,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    ...shadows.sm,
  },
  inputContainer: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    maxHeight: 120,
  },
  input: {
    ...typography.body,
    color: colors.text.primary,
    minHeight: 24,
    maxHeight: 100,
  },
  sendButton: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonGradient: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    fontSize: 20,
    color: colors.text.light,
  },
});
