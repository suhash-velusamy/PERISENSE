/**
 * RootNavigator.js
 * Auth-state-driven root: exactly one of AuthStack / CustomerHome / VendorHome
 * / DriverHome is ever registered as a screen at a time, so a role's screens
 * simply don't exist in the tree for any other role or for a signed-out user
 * (role isolation by construction, not by guard checks).
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SplashScreen from '../screens/SplashScreen';
import AuthStack from './AuthStack';
import CustomerHome from '../screens/Customer Management/CustomerHome';
import VendorHome from '../screens/Vendor Management/VendorHome';
import DriverHome from '../screens/Driver Management/DriverHome';
import { useAuth } from './AuthContext';

const Stack = createNativeStackNavigator();

const RootNavigator = () => {
  const { role, isLoading } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!role ? (
        <Stack.Screen name="Auth" component={AuthStack} />
      ) : role === 'Vendor' ? (
        <Stack.Screen name="VendorRoot" component={VendorHome} />
      ) : role === 'Driver' ? (
        <Stack.Screen name="DriverRoot" component={DriverHome} />
      ) : (
        <Stack.Screen name="CustomerRoot" component={CustomerHome} />
      )}
    </Stack.Navigator>
  );
};

export default RootNavigator;
