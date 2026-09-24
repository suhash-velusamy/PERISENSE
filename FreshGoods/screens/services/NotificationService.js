/**
 * NotificationService - Centralized notification handling
 * Handles registration, listeners, and navigation from notifications
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

// Configure how notifications are displayed when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

class NotificationService {
    static notificationListener = null;
    static responseListener = null;

    /**
     * Initialize notification service
     * Call this in App.js on mount
     */
    static async initialize(navigationRef) {
        // Register for push notifications
        const token = await this.registerForPushNotifications();

        if (token) {
            await this.saveTokenToServer(token);
        }

        // Listen for incoming notifications while app is foregrounded
        this.notificationListener = Notifications.addNotificationReceivedListener(
            (notification) => {
                console.log('📬 Notification received:', notification);
                // You can update app state here if needed
            }
        );

        // Listen for user interactions with notifications
        this.responseListener = Notifications.addNotificationResponseReceivedListener(
            (response) => {
                console.log('👆 Notification tapped:', response);
                this.handleNotificationResponse(response, navigationRef);
            }
        );

        return token;
    }

    /**
   * Clean up listeners
   * Call this in App.js on unmount
   */
    static cleanup() {
        if (this.notificationListener) {
            this.notificationListener.remove();
            this.notificationListener = null;
        }
        if (this.responseListener) {
            this.responseListener.remove();
            this.responseListener = null;
        }
    }

    /**
     * Register for push notifications and get token
     */
    static async registerForPushNotifications() {
        let token = null;

        if (!Device.isDevice) {
            console.log('Push notifications require a physical device');
            return null;
        }

        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('Notification permissions not granted');
                return null;
            }

            // Get Expo push token
            const tokenData = await Notifications.getExpoPushTokenAsync({
                projectId: undefined, // Will use projectId from app.json
            });
            token = tokenData.data;
            console.log('📱 Push token:', token);

            // Configure Android notification channel
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'Default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#007AFF',
                });

                await Notifications.setNotificationChannelAsync('orders', {
                    name: 'Order Updates',
                    description: 'Notifications about your order status',
                    importance: Notifications.AndroidImportance.HIGH,
                    sound: 'default',
                });

                await Notifications.setNotificationChannelAsync('chat', {
                    name: 'Chat Messages',
                    description: 'New message notifications',
                    importance: Notifications.AndroidImportance.DEFAULT,
                });
            }
        } catch (error) {
            console.error('Error registering for push notifications:', error);
        }

        return token;
    }

    /**
     * Save push token to server
     */
    static async saveTokenToServer(token) {
        try {
            const userId = await AsyncStorage.getItem('userId');
            if (!userId) {
                console.log('No userId found, skipping token save');
                return;
            }

            await api.post('/api/user/token', {
                userId,
                pushToken: token,
            });
            console.log('✅ Push token saved to server');
        } catch (error) {
            console.error('Error saving push token:', error);
        }
    }

    /**
     * Handle notification tap - navigate to relevant screen
     */
    static handleNotificationResponse(response, navigationRef) {
        const data = response.notification.request.content.data;

        if (!navigationRef?.current) {
            console.log('Navigation not ready');
            return;
        }

        // Navigate based on notification type
        switch (data?.type) {
            case 'order_update':
                // Navigate to order details or tracking
                if (data.exportId) {
                    // navigationRef.current.navigate('OrderTracking', { exportId: data.exportId });
                }
                break;

            case 'chat_message':
                // Navigate to chat
                if (data.chatWith) {
                    // navigationRef.current.navigate('Chat', { userId: data.chatWith });
                }
                break;

            case 'delivery_alert':
                // Navigate to map view
                break;

            default:
                console.log('Unknown notification type:', data?.type);
        }
    }

    /**
     * Schedule a local notification (for testing)
     */
    static async scheduleLocalNotification(title, body, data = {}) {
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data,
                sound: 'default',
            },
            trigger: { seconds: 1 },
        });
    }
}

export default NotificationService;
