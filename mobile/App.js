import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';

import { AppProvider, useApp } from './src/context/AppContext';
import HomeScreen from './src/screens/HomeScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import EventDetailScreen from './src/screens/EventDetailScreen';
import CreateEventScreen from './src/screens/CreateEventScreen';
import MyTicketScreen from './src/screens/MyTicketScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import InterestsScreen from './src/screens/InterestsScreen';
import api, {
  AUTH_TOKEN_KEY,
  extractUser,
  setUnauthorizedHandler,
} from './src/services/api';
import ScreenErrorBoundary from './src/components/ScreenErrorBoundary';
import { COLORS } from './src/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HomeScreenWithBoundary(props) {
  return (
    <ScreenErrorBoundary screenName="HomeScreen">
      <HomeScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function CalendarScreenWithBoundary(props) {
  return (
    <ScreenErrorBoundary screenName="CalendarScreen">
      <CalendarScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function NotificationsScreenWithBoundary(props) {
  return (
    <ScreenErrorBoundary screenName="NotificationsScreen">
      <NotificationsScreen {...props} />
    </ScreenErrorBoundary>
  );
}

function EventsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreenWithBoundary} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} />
      <Stack.Screen name="MyTicket" component={MyTicketScreen} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="MyTicket" component={MyTicketScreen} />
    </Stack.Navigator>
  );
}

function CalendarStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CalendarMain" component={CalendarScreenWithBoundary} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="MyTicket" component={MyTicketScreen} />
    </Stack.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="InterestsOnboarding" component={InterestsScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const { unreadCount } = useApp();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.ink,
          borderTopColor: '#222',
          borderTopWidth: 1,
          paddingBottom: 4,
          height: 60,
        },
        tabBarActiveTintColor: COLORS.amber,
        tabBarInactiveTintColor: '#555',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color }) => {
          const icons = {
            Events: focused ? 'calendar' : 'calendar-outline',
            Calendar: 'calendar-outline',
            Notifications: focused ? 'notifications' : 'notifications-outline',
            Profile: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Events" component={EventsStack} />
      <Tab.Screen
        name="Calendar"
        component={CalendarStack}
        options={{ tabBarLabel: 'My Events' }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreenWithBoundary}
        options={{
          lazy: false,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.red, fontSize: 10 },
        }}
      />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { currentUser, setCurrentUser } = useApp();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let isMounted = true;

    setUnauthorizedHandler(async () => {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      if (isMounted) {
        setCurrentUser(null);
      }
    });

    return () => {
      isMounted = false;
      setUnauthorizedHandler(null);
    };
  }, [setCurrentUser]);

  useEffect(() => {
    let isMounted = true;

    const hydrateAuth = async () => {
      try {
        const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);

        if (!token) {
          return;
        }

        const meResponse = await api.me(token);
        const user = extractUser(meResponse) || meResponse;

        if (user && typeof user === 'object') {
          if (isMounted) {
            setCurrentUser(user);
          }
          return;
        }

        throw new Error('Invalid profile response');
      } catch (error) {
        await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
        if (isMounted) {
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) {
          setCheckingAuth(false);
        }
      }
    };

    hydrateAuth();

    return () => {
      isMounted = false;
    };
  }, [setCurrentUser]);

  useEffect(() => {
    if (checkingAuth || !currentUser?.id) {
      return undefined;
    }

    let isMounted = true;

    const registerPushNotifications = async () => {
      try {
        const permissionStatus = await Notifications.getPermissionsAsync();
        let finalStatus = permissionStatus.status;

        if (finalStatus !== 'granted') {
          const requestedPermission = await Notifications.requestPermissionsAsync();
          finalStatus = requestedPermission.status;
        }

        if (finalStatus !== 'granted') {
          return;
        }

        const tokenResponse = await Notifications.getExpoPushTokenAsync();
        const token = tokenResponse?.data;

        if (token && isMounted) {
          await api.registerPushToken(token);
        }
      } catch (error) {
        console.warn('Push registration error:', error?.message || error);
      }
    };

    registerPushNotifications();

    const receivedSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        if (!isMounted) {
          return;
        }

        const title = notification?.request?.content?.title || 'Notification';
        const body =
          notification?.request?.content?.body || 'You have a new notification.';

        Alert.alert(title, body);
      }
    );

    return () => {
      isMounted = false;
      receivedSubscription.remove();
    };
  }, [checkingAuth, currentUser?.id]);

  if (checkingAuth) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={COLORS.amber} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={currentUser ? 'light' : 'dark'} />
      {currentUser ? <MainTabs /> : <AuthStack />}
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cream,
  },
});
