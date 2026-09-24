/**
 * DriverHome.js
 * Driver role navigator: bottom tabs (Home / Jobs / History / Chat /
 * Profile) — a direct 1:1 lift of the driver's existing 5 sidebar items,
 * each with its own nested stack for real back-history. Notifications and
 * Settings are added to the (unchanged) SidebarMenu drawer for parity with
 * the other two roles — components already existed app-wide but weren't
 * wired into the driver menu before. Visuals are unchanged — every screen
 * below is the same component that rendered under the old activeSection
 * switch; only how you reach it changed.
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
import DriverProfile from './components/DriverProfile';
import DriverAssignedExports from './components/DriverAssignedExports';
import DriverDeliveryHistory from './components/DriverDeliveryHistory';
import DriverHomePlaceholder from './components/DriverHomePlaceholder';
import GoodsHealthScreen from './components/GoodsHealthScreen';

// Chat helpers
import VendorSelectList from './components/VendorSelectList';
import DriverChat from './components/DriverChat';

// Components
import SidebarMenu from '../components/SidebarMenu';
import AppHeader from '../components/AppHeader';
import SettingsScreen from '../components/SettingsScreen';
import NotificationCenter from '../components/NotificationCenter';
import { colors } from '../theme';

// Bottom tabs — a direct 1:1 lift of the driver's existing 5 menu items
const TAB_ICONS = { HomeTab: '🏠', JobsTab: '📦', HistoryTab: '📜', ChatTab: '💬', ProfileTab: '👤' };
const TAB_LABELS = { HomeTab: 'Home', JobsTab: 'Jobs', HistoryTab: 'History', ChatTab: 'Chat', ProfileTab: 'Profile' };

// Sidebar — secondary items (parity with Customer/Vendor; driver's menu never had these before)
const MENU_ITEMS = [
  { id: 'GoodsHealth', label: 'Goods Health', icon: '🍏' },
  { id: 'Notifications', label: 'Notifications', icon: '🔔' },
  { id: 'Settings', label: 'Settings', icon: '⚙️' },
];

const Tab = createBottomTabNavigator();
const OuterStack = createNativeStackNavigator();
const HomeTabStack = createNativeStackNavigator();
const JobsTabStack = createNativeStackNavigator();
const HistoryTabStack = createNativeStackNavigator();
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
          <DriverHomePlaceholder
            onViewAllJobs={() => navigation.navigate('JobsTab')}
            onChatWithVendor={(id, name) =>
              navigation.navigate('ChatTab', { screen: 'ChatConversation', params: { vendorId: id, vendorName: name } })
            }
          />
        )}
      </HomeTabStack.Screen>
    </HomeTabStack.Navigator>
  );
};

const JobsTabNavigator = () => {
  const renderHeader = useContext(HeaderMenuContext);
  return (
    <JobsTabStack.Navigator screenOptions={{ header: renderHeader }}>
      <JobsTabStack.Screen name="AssignedExports" options={{ title: 'Assigned Exports' }}>
        {({ navigation }) => (
          <DriverAssignedExports
            onChatWithVendor={(id, name) =>
              navigation.navigate('ChatTab', { screen: 'ChatConversation', params: { vendorId: id, vendorName: name } })
            }
          />
        )}
      </JobsTabStack.Screen>
    </JobsTabStack.Navigator>
  );
};

const HistoryTabNavigator = () => {
  const renderHeader = useContext(HeaderMenuContext);
  return (
    <HistoryTabStack.Navigator screenOptions={{ header: renderHeader }}>
      <HistoryTabStack.Screen name="DeliveryHistory" component={DriverDeliveryHistory} options={{ title: 'Delivery History' }} />
    </HistoryTabStack.Navigator>
  );
};

const ProfileTabNavigator = () => {
  const renderHeader = useContext(HeaderMenuContext);
  return (
    <ProfileTabStack.Navigator screenOptions={{ header: renderHeader }}>
      <ProfileTabStack.Screen name="Profile" component={DriverProfile} options={{ title: 'Profile' }} />
    </ProfileTabStack.Navigator>
  );
};

// DriverChat self-fetches its own driverId from AsyncStorage (same fallback
// pattern already used by CustomerChat/VendorChat), so this tab needs no
// prop threaded down from DriverHome.
const ChatTabNavigator = () => {
  const renderHeader = useContext(HeaderMenuContext);
  return (
    <ChatTabStack.Navigator screenOptions={{ header: renderHeader }}>
      <ChatTabStack.Screen name="ChatVendorSelect" options={{ title: 'Chat' }}>
        {({ navigation }) => (
          <VendorSelectList
            onSelect={(id, name) => navigation.navigate('ChatConversation', { vendorId: id, vendorName: name })}
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
          <DriverChat
            vendorId={route.params?.vendorId}
            vendorName={route.params?.vendorName}
            onBack={() => navigation.goBack()}
          />
        )}
      </ChatTabStack.Screen>
    </ChatTabStack.Navigator>
  );
};

const DriverTabs = () => (
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
    <Tab.Screen name="JobsTab" component={JobsTabNavigator} />
    <Tab.Screen name="HistoryTab" component={HistoryTabNavigator} />
    <Tab.Screen name="ChatTab" component={ChatTabNavigator} />
    <Tab.Screen name="ProfileTab" component={ProfileTabNavigator} />
  </Tab.Navigator>
);

const DriverHome = () => {
  const navigation = useNavigation();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [userName, setUserName] = useState('Driver');
  const [userEmail, setUserEmail] = useState('');
  const [activeRoute, setActiveRoute] = useState('DriverTabs');

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
      subtitle="Driver"
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
          <OuterStack.Screen name="DriverTabs" component={DriverTabs} options={{ headerShown: false }} />
          <OuterStack.Screen name="GoodsHealth" options={{ title: 'Goods Health' }}>
            {({ navigation }) => <GoodsHealthScreen navigation={navigation} />}
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
          onItemPress={(id) => navigation.navigate('DriverRoot', { screen: id })}
          navigation={navigation}
          userName={userName}
          userEmail={userEmail}
          userRole="Driver"
        />
      </View>
    </HeaderMenuContext.Provider>
  );
};

export default DriverHome;

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
