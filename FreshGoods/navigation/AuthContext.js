/**
 * AuthContext.js
 * Mirrors the existing AsyncStorage('userId','role') auth state in memory so
 * RootNavigator can swap between AuthStack and the role navigators. This is
 * not a second source of truth — AsyncStorage is still written first by
 * LoginScreen/SidebarMenu exactly as before; signIn/signOut just notify
 * React that the mounted navigator tree needs to change.
 */
import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [role, setRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthState = async () => {
      try {
        const [userId, storedRole] = await AsyncStorage.multiGet(['userId', 'role']);
        if (userId[1] && storedRole[1]) {
          setRole(storedRole[1]);
        } else {
          setRole(null);
        }
      } catch (error) {
        console.warn('Auth check failed:', error);
        setRole(null);
      } finally {
        // Small delay to show splash screen branding
        setTimeout(() => setIsLoading(false), 800);
      }
    };
    checkAuthState();
  }, []);

  const signIn = useCallback((nextRole) => {
    setRole(nextRole);
  }, []);

  const signOut = useCallback(() => {
    setRole(null);
  }, []);

  const value = useMemo(() => ({ role, isLoading, signIn, signOut }), [role, isLoading, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
