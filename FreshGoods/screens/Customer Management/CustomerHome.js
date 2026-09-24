/**
 * CustomerHome.js
 * Customer role navigator: bottom tabs (Home / Shipments / Browse / Chat /
 * Profile) for primary destinations, each with its own nested stack for
 * real back-history; Rescue/Notifications/Settings stay on the outer stack,
 * reached from the (unchanged) SidebarMenu drawer. Visuals are unchanged —
 * every screen below is the same component that rendered under the old
 * activeSection switch; only how you reach it changed.
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

// Screens
import CustomerDashboard from './components/CustomerHomePlaceholder';
import CustomerProfile from './components/CustomerProfile';
import CustomerViewGoods from './components/CustomerViewGoods';
import CustomerMyShipments from './components/CustomerMyShipments';
import CustomerShipmentDetails from './components/CustomerShipmentDetails';
import VendorSelectList from './components/VendorSelectList';
import CustomerChat from './components/CustomerChatPlaceholder';
import CustomerConversationList from './components/CustomerConversationList';
import CustomerRescueOpportunities from './components/CustomerRescueOpportunities';
import RescueSaleDetails from './components/RescueSaleDetails';

// Components
import SidebarMenu from '../components/SidebarMenu';
import AppHeader from '../components/AppHeader';
import SettingsScreen from '../components/SettingsScreen';
import NotificationCenter from '../components/NotificationCenter';
import { colors } from '../theme';

// Bottom tabs — the primary, high-frequency destinations (matches the
// dashboard's own "Quick Actions": Browse Goods, My Shipments, Chat, Profile)
const TAB_ICONS = { HomeTab: '🏠', ShipmentsTab: '📦', BrowseTab: '🛒', ChatTab: '💬', ProfileTab: '👤' };
const TAB_LABELS = { HomeTab: 'Home', ShipmentsTab: 'Shipments', BrowseTab: 'Browse', ChatTab: 'Chat', ProfileTab: 'Profile' };

// Sidebar — secondary items (everything the dashboard doesn't already treat as primary)
const MENU_ITEMS = [
  { id: 'Rescue', label: 'Rescue Opportunities', icon: '🚨' },
  { id: 'Notifications', label: 'Notifications', icon: '🔔' },
  { id: 'Settings', label: 'Settings', icon: '⚙️' },
];

const Tab = createBottomTabNavigator();
const OuterStack = createNativeStackNavigator();
const HomeTabStack = createNativeStackNavigator();
const ShipmentsTabStack = createNativeStackNavigator();
const BrowseTabStack = createNativeStackNavigator();
const ChatTabStack = createNativeStackNavigator();
const ProfileTabStack = createNativeStackNavigator();

const HeaderMenuButton = ({ onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.menuButton}>
    <Text style={styles.menuIcon}>☰</Text>
  </TouchableOpacity>
);

const HeaderMenuContext = createContext(null);

const HomeTabNavigator = () => {
  const renderHeader = useContext(HeaderMenuContext);
  return (
    <HomeTabStack.Navigator screenOptions={{ header: renderHeader }}>
      <HomeTabStack.Screen name="Dashboard" options={{ title: 'Home' }}>
        {({ navigation }) => (
          <CustomerDashboard
            onNavigate={(section, data) => {
              switch (section) {
                case 'shipmentDetails': navigation.navigate('ShipmentDetails', data); break;
                case 'viewGoods': navigation.navigate('BrowseTab'); break;
                case 'myShipments': navigation.navigate('ShipmentsTab'); break;
                case 'chat': navigation.navigate('ChatTab'); break;
                case 'profile': navigation.navigate('ProfileTab'); break;
                case 'notifications': navigation.navigate('Notifications'); break;
                default: break;
              }
            }}
          />
        )}
      </HomeTabStack.Screen>
      <HomeTabStack.Screen name="ShipmentDetails" options={{ title: 'Shipment Details' }}>
        {({ route, navigation }) => (
          <CustomerShipmentDetails
            exportId={route.params?.exportId}
            exportData={route.params?.exportData}
            onBack={() => navigation.goBack()}
          />
        )}
      </HomeTabStack.Screen>
    </HomeTabStack.Navigator>
  );
};

const ShipmentsTabNavigator = () => {
  const renderHeader = useContext(HeaderMenuContext);
  return (
    <ShipmentsTabStack.Navigator screenOptions={{ header: renderHeader }}>
      <ShipmentsTabStack.Screen name="MyShipments" options={{ title: 'My Shipments' }}>
        {({ navigation }) => (
          <CustomerMyShipments
            onTrack={(exportData) => navigation.navigate('ShipmentDetails', { exportData })}
          />
        )}
      </ShipmentsTabStack.Screen>
      <ShipmentsTabStack.Screen name="ShipmentDetails" options={{ title: 'Shipment Details' }}>
        {({ route, navigation }) => (
          <CustomerShipmentDetails
            exportId={route.params?.exportId}
            exportData={route.params?.exportData}
            onBack={() => navigation.goBack()}
          />
        )}
      </ShipmentsTabStack.Screen>
    </ShipmentsTabStack.Navigator>
  );
};

const BrowseTabNavigator = () => {
  const renderHeader = useContext(HeaderMenuContext);
  return (
    <BrowseTabStack.Navigator screenOptions={{ header: renderHeader }}>
      <BrowseTabStack.Screen name="ViewGoods" options={{ title: 'Browse Goods' }}>
        {({ navigation }) => (
          <CustomerViewGoods
            onTrack={(exportData) => navigation.navigate('ShipmentDetails', { exportData })}
          />
        )}
      </BrowseTabStack.Screen>
      <BrowseTabStack.Screen name="ShipmentDetails" options={{ title: 'Shipment Details' }}>
        {({ route, navigation }) => (
          <CustomerShipmentDetails
            exportId={route.params?.exportId}
            exportData={route.params?.exportData}
            onBack={() => navigation.goBack()}
          />
        )}
      </BrowseTabStack.Screen>
    </BrowseTabStack.Navigator>
  );
};

const ChatTabNavigator = () => {
  const renderHeader = useContext(HeaderMenuContext);
  return (
    <ChatTabStack.Navigator screenOptions={{ header: renderHeader }}>
      <ChatTabStack.Screen name="ConversationList" component={CustomerConversationList} options={{ title: 'Chat' }} />
      <ChatTabStack.Screen name="NewChat" options={{ title: 'New Chat' }}>
        {({ navigation }) => (
          <VendorSelectList
            onSelectVendor={(id, name) =>
              // replace (not push) so Back from the new conversation returns
              // to the conversation list, not to the picker
              navigation.replace('ChatConversation', { vendorId: id, vendorName: name })
            }
          />
        )}
      </ChatTabStack.Screen>
      <ChatTabStack.Screen
        name="ChatConversation"
        options={({ route }) => ({
          title: route.params?.vendorName ? `Chat with ${route.params.vendorName}` : 'Chat',
          headerShown: false,
        })}
      >
        {({ route, navigation }) => (
          <CustomerChat
            vendorId={route.params?.vendorId}
            vendorName={route.params?.vendorName}
            onBack={() => navigation.goBack()}
          />
        )}
      </ChatTabStack.Screen>
    </ChatTabStack.Navigator>
  );
};

const ProfileTabNavigator = () => {
  const renderHeader = useContext(HeaderMenuContext);
  return (
    <ProfileTabStack.Navigator screenOptions={{ header: renderHeader }}>
      <ProfileTabStack.Screen name="Profile" component={CustomerProfile} options={{ title: 'Profile' }} />
    </ProfileTabStack.Navigator>
  );
};

const CustomerTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.text.muted,
      tabBarIcon: () => <Text style={{ fontSize: 20 }}>{TAB_ICONS[route.name]}</Text>,
      tabBarLabel: TAB_LABELS[route.name],
    })}
  >
    <Tab.Screen name="HomeTab" component={HomeTabNavigator} />
    <Tab.Screen name="ShipmentsTab" component={ShipmentsTabNavigator} />
    <Tab.Screen name="BrowseTab" component={BrowseTabNavigator} />
    <Tab.Screen name="ChatTab" component={ChatTabNavigator} />
    <Tab.Screen name="ProfileTab" component={ProfileTabNavigator} />
  </Tab.Navigator>
);

const CustomerHome = () => {
  const navigation = useNavigation();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [userName, setUserName] = useState('Customer');
  const [userEmail, setUserEmail] = useState('');
  const [activeRoute, setActiveRoute] = useState('CustomerTabs');

  useEffect(() => {
    const fetchUserData = async () => {
      const name = await AsyncStorage.getItem('userName');
      const email = await AsyncStorage.getItem('userEmail');
      if (name) setUserName(name);
      if (email) setUserEmail(email);
    };
    fetchUserData();
  }, []);

  const renderHeader = (props) => (
    <AppHeader
      title={props.options.title || 'Home'}
      subtitle="Customer"
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
          <OuterStack.Screen name="CustomerTabs" component={CustomerTabs} options={{ headerShown: false }} />
          <OuterStack.Screen name="Rescue" options={{ title: 'Rescue Opportunities' }}>
            {({ navigation }) => (
              <CustomerRescueOpportunities
                onOpen={(id) => navigation.navigate('RescueDetails', { rescueSaleId: id })}
              />
            )}
          </OuterStack.Screen>
          <OuterStack.Screen name="RescueDetails" options={{ title: 'Rescue Sale', headerShown: false }}>
            {({ route, navigation }) => (
              <RescueSaleDetails
                rescueSaleId={route.params?.rescueSaleId}
                onBack={() => navigation.goBack()}
              />
            )}
          </OuterStack.Screen>
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
          onItemPress={(id) => navigation.navigate('CustomerRoot', { screen: id })}
          navigation={navigation}
          userName={userName}
          userEmail={userEmail}
          userRole="Customer"
        />
      </View>
    </HeaderMenuContext.Provider>
  );
};

export default CustomerHome;

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
