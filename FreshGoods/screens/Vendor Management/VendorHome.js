/**
 * VendorHome.js
 * Vendor role navigator: bottom tabs (Dashboard / Shipments / Fleet / Rescue
 * / Chat) for primary destinations, each with its own nested stack for real
 * back-history. Analytics, Goods Health, and Create Export live inside the
 * Shipments tab (via ShipmentsHome); Service Requests lives inside the
 * Rescue tab (via VendorRescueSales' entry point); both chat modes live
 * inside the Chat tab (via VendorChatHome). Only Profile/Settings stay on
 * the outer stack, reached from the sidebar drawer — the sidebar no longer
 * carries any business/functional navigation. Every screen below is the
 * same component that rendered before; only how you reach it changed.
 *
 * HeaderMenuContext shares the role-root's renderHeader (AppHeader +
 * hamburger) with every inner tab stack — each bottom tab owns its own
 * nested Stack.Navigator for real back-history, so the header has to be
 * wired to each of them individually, not just the outer stack.
 */

import React, { useState, useEffect, useContext, createContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Management sub‑pages
import DriverManagement from './components/DriverManagement';
import VehicleManagement from './components/VehicleManagement';
import ExportManagement from './components/ExportManagement';
import VendorHomePlaceHolder from './components/vendorHomePlaceHolder';
import ServiceRequestManager from './components/ServiceRequestManager';
import VendorExportDashboard from './components/VendorExportDashboard';
import VendorAnalytics from './components/VendorAnalytics';
import VendorRescueSales from './components/VendorRescueSales';
import FleetHome from './components/FleetHome';
import VehicleDetails from './components/VehicleDetails';
import DriverDetails from './components/DriverDetails';
import DeviceManagement from './components/DeviceManagement';
import GoodsHealthScreen from './components/GoodsHealthScreen';
import ShipmentsHome from './components/ShipmentsHome';
import VendorChatHome from './components/VendorChatHome';
import VendorProfile from './components/VendorProfile';

// Chat helpers
import CustomerSelectList from './components/CustomerSelectionList';
import DriverSelectList from './components/DriverSelectList';
import VendorChat from './components/VendorChat';

// Components
import SidebarMenu from '../components/SidebarMenu';
import AppHeader from '../components/AppHeader';
import SettingsScreen from '../components/SettingsScreen';
import NotificationCenter from '../components/NotificationCenter';
import { colors } from '../theme';

// Bottom tabs — the primary, high-frequency destinations
const TAB_ICONS = { DashboardTab: '🏠', ShipmentsTab: '📊', FleetTab: '🚗', RescueTab: '🚨', ChatTab: '💬' };
const TAB_LABELS = { DashboardTab: 'Dashboard', ShipmentsTab: 'Shipments', FleetTab: 'Fleet', RescueTab: 'Rescue', ChatTab: 'Chat' };

// Sidebar — account-level items only. Business/functional features (Analytics,
// Goods Health, Create Export, Service Requests, Chat) now live inside their
// relevant bottom-navigation section instead — see ShipmentsTabNavigator,
// RescueTabNavigator, and ChatTabNavigator below.
const MENU_ITEMS = [
  { id: 'Profile', label: 'Profile', icon: '👤' },
  { id: 'Settings', label: 'Settings', icon: '⚙️' },
];

const Tab = createBottomTabNavigator();
const OuterStack = createNativeStackNavigator();
const DashboardTabStack = createNativeStackNavigator();
const ShipmentsTabStack = createNativeStackNavigator();
const FleetTabStack = createNativeStackNavigator();
const RescueTabStack = createNativeStackNavigator();
const ChatTabStack = createNativeStackNavigator();

const HeaderMenuButton = ({ onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.menuButton}>
    <Text style={styles.menuIcon}>☰</Text>
  </TouchableOpacity>
);

const HeaderMenuContext = createContext(null);

const DashboardTabNavigator = () => {
  const renderHeader = useContext(HeaderMenuContext);
  return (
    <DashboardTabStack.Navigator screenOptions={{ header: renderHeader }}>
      <DashboardTabStack.Screen name="Dashboard" options={{ title: 'Home' }}>
        {({ navigation }) => (
          <VendorHomePlaceHolder
            onChatWithDriver={(id, name) => navigation.navigate('DriverChatConversation', { targetId: id, targetName: name })}
          />
        )}
      </DashboardTabStack.Screen>
    </DashboardTabStack.Navigator>
  );
};

const ShipmentsTabNavigator = () => {
  const renderHeader = useContext(HeaderMenuContext);
  return (
    <ShipmentsTabStack.Navigator screenOptions={{ header: renderHeader }}>
      <ShipmentsTabStack.Screen name="ShipmentsHome" component={ShipmentsHome} options={{ title: 'Shipments' }} />
      <ShipmentsTabStack.Screen name="ExportDashboard" options={{ title: 'Export Dashboard' }}>
        {({ navigation }) => (
          <VendorExportDashboard
            onChatWithDriver={(id, name) => navigation.navigate('DriverChatConversation', { targetId: id, targetName: name })}
          />
        )}
      </ShipmentsTabStack.Screen>
      <ShipmentsTabStack.Screen name="Analytics" options={{ title: 'Analytics', headerShown: false }}>
        {({ navigation }) => <VendorAnalytics onBack={() => navigation.goBack()} />}
      </ShipmentsTabStack.Screen>
      <ShipmentsTabStack.Screen name="GoodsHealth" component={GoodsHealthScreen} options={{ title: 'Goods Health' }} />
      <ShipmentsTabStack.Screen name="CreateExport" component={ExportManagement} options={{ title: 'Create Export' }} />
    </ShipmentsTabStack.Navigator>
  );
};

const FleetTabNavigator = () => {
  const renderHeader = useContext(HeaderMenuContext);
  return (
    <FleetTabStack.Navigator screenOptions={{ header: renderHeader }}>
      <FleetTabStack.Screen name="FleetHome" component={FleetHome} options={{ title: 'Fleet' }} />
      <FleetTabStack.Screen name="Drivers" component={DriverManagement} options={{ title: 'Driver Management' }} />
      <FleetTabStack.Screen name="Vehicles" component={VehicleManagement} options={{ title: 'Vehicle Management' }} />
      <FleetTabStack.Screen name="Devices" component={DeviceManagement} options={{ title: 'Devices' }} />
      <FleetTabStack.Screen
        name="VehicleDetails"
        component={VehicleDetails}
        options={({ route }) => ({ title: route.params?.vehicle?.vehicleNumber || 'Vehicle Details' })}
      />
      <FleetTabStack.Screen
        name="DriverDetails"
        component={DriverDetails}
        options={({ route }) => ({ title: route.params?.driver?.name || 'Driver Details' })}
      />
    </FleetTabStack.Navigator>
  );
};

const RescueTabNavigator = () => {
  const renderHeader = useContext(HeaderMenuContext);
  const [vendorId, setVendorId] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('userId').then((id) => id && setVendorId(id));
  }, []);

  return (
    <RescueTabStack.Navigator screenOptions={{ header: renderHeader }}>
      <RescueTabStack.Screen name="RescueSales" component={VendorRescueSales} options={{ title: 'Rescue Sales' }} />
      <RescueTabStack.Screen name="ServiceRequests" options={{ title: 'Service Requests' }}>
        {() => <ServiceRequestManager vendorId={vendorId} />}
      </RescueTabStack.Screen>
    </RescueTabStack.Navigator>
  );
};

const ChatTabNavigator = () => {
  const renderHeader = useContext(HeaderMenuContext);
  const [vendorId, setVendorId] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('userId').then((id) => id && setVendorId(id));
  }, []);

  return (
    <ChatTabStack.Navigator screenOptions={{ header: renderHeader }}>
      <ChatTabStack.Screen name="ChatHome" component={VendorChatHome} options={{ title: 'Chat' }} />
      <ChatTabStack.Screen name="CustomerChatSelect" options={{ title: 'Chat with Customers' }}>
        {({ navigation }) => (
          <CustomerSelectList
            vendorId={vendorId}
            onSelectCustomer={(id, name) => navigation.navigate('CustomerChatConversation', { targetId: id, targetName: name })}
          />
        )}
      </ChatTabStack.Screen>
      <ChatTabStack.Screen
        name="CustomerChatConversation"
        options={({ route }) => ({
          title: route.params?.targetName ? `Chat with ${route.params.targetName}` : 'Chat',
          headerShown: false,
        })}
      >
        {({ route, navigation }) => (
          <VendorChat
            chatType="customer"
            targetId={route.params?.targetId}
            targetName={route.params?.targetName}
            onBack={() => navigation.goBack()}
          />
        )}
      </ChatTabStack.Screen>
      <ChatTabStack.Screen name="DriverChatSelect" options={{ title: 'Chat with Drivers' }}>
        {({ navigation }) => (
          <DriverSelectList
            vendorId={vendorId}
            onSelect={(id, name) => navigation.navigate('DriverChatConversation', { targetId: id, targetName: name })}
          />
        )}
      </ChatTabStack.Screen>
      <ChatTabStack.Screen
        name="DriverChatConversation"
        options={({ route }) => ({
          title: route.params?.targetName ? `Chat with ${route.params.targetName}` : 'Chat',
          headerShown: false,
        })}
      >
        {({ route, navigation }) => (
          <VendorChat
            chatType="driver"
            targetId={route.params?.targetId}
            targetName={route.params?.targetName}
            onBack={() => navigation.goBack()}
          />
        )}
      </ChatTabStack.Screen>
    </ChatTabStack.Navigator>
  );
};

const VendorTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.text.muted,
      tabBarIcon: () => <Text style={{ fontSize: 20 }}>{TAB_ICONS[route.name]}</Text>,
      tabBarLabel: TAB_LABELS[route.name],
    })}
  >
    <Tab.Screen name="DashboardTab" component={DashboardTabNavigator} />
    <Tab.Screen name="ShipmentsTab" component={ShipmentsTabNavigator} />
    <Tab.Screen name="FleetTab" component={FleetTabNavigator} />
    <Tab.Screen name="RescueTab" component={RescueTabNavigator} />
    <Tab.Screen name="ChatTab" component={ChatTabNavigator} />
  </Tab.Navigator>
);

const VendorHome = () => {
  const navigation = useNavigation();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [userName, setUserName] = useState('Vendor');
  const [userEmail, setUserEmail] = useState('');
  const [activeRoute, setActiveRoute] = useState('VendorTabs');

  useEffect(() => {
    const fetchData = async () => {
      const name = await AsyncStorage.getItem('userName');
      const email = await AsyncStorage.getItem('userEmail');
      if (name) setUserName(name);
      if (email) setUserEmail(email);
    };
    fetchData();
  }, []);

  const renderHeader = (props) => (
    <AppHeader
      title={props.options.title || 'Home'}
      subtitle="Vendor"
      showBack={props.back}
      onBack={() => props.navigation.goBack()}
      rightComponent={!props.back ? <HeaderMenuButton onPress={() => setIsMenuVisible(true)} /> : null}
    />
  );

  return (
    <HeaderMenuContext.Provider value={renderHeader}>
      <View style={styles.container}>
        <OuterStack.Navigator
          screenOptions={{ header: renderHeader }}
          screenListeners={{
            state: (e) => {
              const routes = e.data?.state?.routes;
              if (routes?.length) setActiveRoute(routes[routes.length - 1].name);
            },
          }}
        >
          <OuterStack.Screen name="VendorTabs" component={VendorTabs} options={{ headerShown: false }} />
          <OuterStack.Screen name="Profile" component={VendorProfile} options={{ title: 'Profile' }} />
          <OuterStack.Screen name="Notifications" options={{ title: 'Notifications', headerShown: false }}>
            {({ navigation }) => <NotificationCenter onBack={() => navigation.goBack()} />}
          </OuterStack.Screen>
          <OuterStack.Screen name="Settings" options={{ title: 'Settings', headerShown: false }}>
            {({ navigation }) => <SettingsScreen onBack={() => navigation.goBack()} />}
          </OuterStack.Screen>
        </OuterStack.Navigator>

        <SidebarMenu
          isVisible={isMenuVisible}
          onClose={() => setIsMenuVisible(false)}
          menuItems={MENU_ITEMS}
          activeItem={activeRoute}
          onItemPress={(id) => navigation.navigate('VendorRoot', { screen: id })}
          navigation={navigation}
          userName={userName}
          userEmail={userEmail}
          userRole="Vendor"
        />
      </View>
    </HeaderMenuContext.Provider>
  );
};

export default VendorHome;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIcon: {
    fontSize: 20,
    color: colors.text.light,
    fontWeight: 'bold',
  },
});
