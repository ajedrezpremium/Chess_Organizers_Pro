import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import QRScannerScreen from './src/screens/QRScannerScreen';

const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }) {
  const icons = { Inicio: '♛', Escáner: '📷' };
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 20 }}>{icons[label] || '●'}</Text>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#0f172a',
            borderTopColor: '#1e293b',
            borderTopWidth: 1,
            paddingBottom: 4,
            paddingTop: 4,
            height: 60,
          },
          tabBarActiveTintColor: '#f59e0b',
          tabBarInactiveTintColor: '#64748b',
        }}
      >
        <Tab.Screen
          name="Inicio"
          component={HomeScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon label="Inicio" focused={focused} /> }}
        />
        <Tab.Screen
          name="Escáner"
          component={QRScannerScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon label="Escáner" focused={focused} /> }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
