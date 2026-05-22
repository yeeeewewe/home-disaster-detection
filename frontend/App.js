import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';

import DashboardScreen from './src/screens/DashboardScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SimulatorScreen from './src/screens/SimulatorScreen';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f1f5f9',
    primary: '#0ea5e9',
  },
};

function tabIcon(emoji) {
  return ({ focused }) => (
    <Text style={{ fontSize: focused ? 22 : 18 }}>{emoji}</Text>
  );
}

export default function App() {
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="dark" />
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#0f172a' },
          headerTitleStyle: { color: '#fff', fontWeight: '700' },
          headerTintColor: '#fff',
          tabBarActiveTintColor: '#0ea5e9',
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ title: '即時儀表板', tabBarIcon: tabIcon('📊') }}
        />
        <Tab.Screen
          name="History"
          component={HistoryScreen}
          options={{ title: '歷史紀錄', tabBarIcon: tabIcon('📜') }}
        />
        <Tab.Screen
          name="Simulator"
          component={SimulatorScreen}
          options={{ title: '模擬測試', tabBarIcon: tabIcon('🧪') }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
