// App.js - FreshGoods Mobile App with Auto-Login & Notifications (SDK 54)
import React, { useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from './navigation/AuthContext';
import RootNavigator from './navigation/RootNavigator';

/* --- services --- */
import NotificationService from './screens/services/NotificationService';
import ErrorBoundary from './screens/components/ErrorBoundary';

export const navigationRef = createNavigationContainerRef();

export default function App() {
  useEffect(() => {
    const initNotifications = async () => {
      try {
        await NotificationService.initialize(navigationRef);
      } catch (error) {
        console.log('Notification init error:', error);
      }
    };

    initNotifications();

    return () => {
      NotificationService.cleanup();
    };
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <PaperProvider>
          <NavigationContainer ref={navigationRef}>
            <StatusBar style="light" backgroundColor="#1B3A57" />
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          </NavigationContainer>
        </PaperProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

