/**
 * VendorChat.js
 * Premium chat interface for vendor-to-customer/driver communication
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { SlideInView, FadeInView } from '../../components/AnimatedComponents';

/* ------------------------------------------------------------------ *
 * CONFIG
 * ------------------------------------------------------------------ */
const API_BASE = API_BASE_URL;
const PUSHER_KEY = '562e97ac482dc6689524';
const PUSHER_CLUSTER = 'ap2';
const CHAT_EVENT = 'new-message';

/**
 * VendorChat - Premium chat for vendors
 */
export default function VendorChat({
  vendorId: propVendorId,
  chatType,
  targetId,
  targetName = '',
  onBack,
}) {
  const [vendorId, setVendorId] = useState(propVendorId);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatRef = useRef(null);

  // Get vendor ID
  useEffect(() => {
    if (vendorId) return;
    AsyncStorage.getItem('userId').then((id) => id && setVendorId(id));
  }, [vendorId]);

  // Pusher + history
  useEffect(() => {
    if (!vendorId || !targetId || !chatType) return;

    const channelName = `private-chat-${vendorId}-${targetId}`;
    let pusher;
    let channel;
    let cancelled = false;

    (async () => {
      // Pusher's authorizer makes its own HTTP request outside of our axios
      // instance, so the JWT has to be attached to it explicitly.
      const token = await AsyncStorage.getItem('token');
      if (cancelled) return;

      try {
        pusher = new Pusher(PUSHER_KEY, {
          cluster: PUSHER_CLUSTER,
          authEndpoint: `${API_BASE}/chat/pusher/auth`,
          auth: { headers: { Authorization: `Bearer ${token}` } },
        });

        channel = pusher.subscribe(channelName);

        channel.bind(CHAT_EVENT, (data) => {
          setMessages((prev) => {
            if (prev.some((m) => m._id === data._id)) return prev;
            const next = [...prev, data];
            next.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            return next;
          });
        });
      } catch (err) {
        console.error('Pusher error:', err);
      }
    })();

    // History
    api
      .get('/chat/history', {
        params: { vendorId, targetId, chatType },
      })
      .then((res) => {
        const ordered = (res.data || [])
          .slice()
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        setMessages(ordered);
      })
      .finally(() => setLoading(false));

    return () => {
      cancelled = true;
      if (channel) {
        channel.unbind_all();
        channel.unsubscribe();
      }
      if (pusher) pusher.disconnect();
    };
  }, [vendorId, targetId, chatType]);

  // Send
  const sendMessage = useCallback(async () => {
    if (!input.trim() || sending) return;

    const messageText = input.trim();
    setInput('');
    setSending(true);

    const optimistic = {
      _id: `temp-${Date.now()}`,
      senderId: vendorId,
      content: messageText,
      timestamp: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    const body = { vendorId, content: messageText, senderType: 'vendor' };
    if (chatType === 'customer') body.customerId = targetId;
    if (chatType === 'driver') body.driverId = targetId;

    try {
      await api.post('/chat/send', body);
      setMessages((prev) => prev.filter((m) => m._id !== optimistic._id));
    } catch (err) {
      console.error('Send error', err);
      setMessages((prev) =>
        prev.map((m) =>
          m._id === optimistic._id ? { ...m, failed: true, pending: false } : m
        )
      );
    } finally {
      setSending(false);
    }
  }, [input, sending, vendorId, targetId, chatType]);

  // Auto-scroll
  useEffect(() => {
    if (flatRef.current && messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const formatTime = (ts) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const renderItem = ({ item }) => {
    const mine = item.senderId === vendorId;
    return (
      <SlideInView
        direction={mine ? 'right' : 'left'}
        delay={0}
        style={[styles.wrap, mine ? styles.alignRight : styles.alignLeft]}
      >
        <View
          style={[
            styles.bubble,
            mine ? styles.bubbleRight : styles.bubbleLeft,
            item.pending && styles.pending,
            item.failed && styles.failed,
          ]}
        >
          <Text style={[styles.text, mine ? styles.textRight : styles.textLeft]}>
            {item.content}
          </Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.ts}>{formatTime(item.timestamp)}</Text>
          {item.pending && <Text style={styles.status}>⏳</Text>}
          {item.failed && <Text style={styles.status}>❌</Text>}
        </View>
      </SlideInView>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={gradients.forest}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {targetName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>{targetName}</Text>
            <Text style={styles.headerSub}>
              {chatType === 'customer' ? 'Customer' : 'Driver'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(item, i) => item._id || String(i)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <FadeInView style={styles.empty}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyText}>Start a conversation</Text>
          </FadeInView>
        }
      />

      {/* Composer */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={styles.composer}>
          <View style={styles.inputWrap}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Type a message..."
              placeholderTextColor={colors.text.muted}
              style={styles.input}
              onSubmitEditing={sendMessage}
              multiline
            />
          </View>
          <TouchableOpacity
            onPress={sendMessage}
            disabled={!input.trim() || sending}
            style={styles.sendBtn}
          >
            <LinearGradient
              colors={!input.trim() || sending ? ['#9CA3AF', '#6B7280'] : gradients.primary}
              style={styles.sendGradient}
            >
              <Text style={styles.sendIcon}>{sending ? '⏳' : '➤'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { ...typography.body, color: colors.text.muted, marginTop: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  backIcon: { fontSize: 20, color: colors.text.light, fontWeight: 'bold' },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  avatarText: { fontSize: 16, fontWeight: 'bold', color: colors.text.light },
  headerTitle: { ...typography.bodyMedium, color: colors.text.light },
  headerSub: { ...typography.caption, color: 'rgba(255,255,255,0.7)' },
  list: { padding: spacing.md, flexGrow: 1 },
  wrap: { marginVertical: spacing.xs, maxWidth: '80%' },
  alignLeft: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  alignRight: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  bubbleLeft: { backgroundColor: colors.background.card, borderBottomLeftRadius: spacing.xs },
  bubbleRight: { backgroundColor: colors.primary, borderBottomRightRadius: spacing.xs },
  pending: { opacity: 0.7 },
  failed: { backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.error },
  text: { ...typography.body, lineHeight: 22 },
  textLeft: { color: colors.text.primary },
  textRight: { color: colors.text.light },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xxs },
  ts: { ...typography.caption, color: colors.text.muted, marginRight: spacing.xs },
  status: { fontSize: 10, color: colors.text.muted },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.xxl * 2 },
  emptyIcon: { fontSize: 56, marginBottom: spacing.md },
  emptyText: { ...typography.h3, color: colors.text.muted },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    backgroundColor: colors.background.card,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
  },
  input: { ...typography.body, color: colors.text.primary, minHeight: 24 },
  sendBtn: { borderRadius: 24, overflow: 'hidden' },
  sendGradient: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  sendIcon: { fontSize: 20, color: colors.text.light },
});
