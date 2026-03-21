import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, View } from 'react-native';

import CameraScreen from './src/screens/CameraScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';

type TabKey = 'home' | 'camera' | 'profile';

const tabs: Array<{
  key: TabKey;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'home', icon: 'home-outline' },
  { key: 'camera', icon: 'camera-outline' },
  { key: 'profile', icon: 'person-outline' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('camera');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.screen}>
        {activeTab === 'home' && <HomeScreen />}
        {activeTab === 'camera' && <CameraScreen />}
        {activeTab === 'profile' && <ProfileScreen />}
      </View>

      <View style={styles.tabShell}>
        <View style={styles.tabBar}>
          {tabs.map((tab) => {
            const active = activeTab === tab.key;

            return (
              <Pressable
                key={tab.key}
                accessibilityRole="button"
                accessibilityLabel={`${tab.key} tab`}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tabButton, active && styles.activeTabButton]}
              >
                <Ionicons
                  color={active ? '#ffffff' : '#111111'}
                  name={tab.icon}
                  size={24}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f0e8',
  },
  screen: {
    flex: 1,
  },
  tabShell: {
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  tabBar: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d9d4c7',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    minWidth: 168,
    paddingHorizontal: 18,
    paddingVertical: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  activeTabButton: {
    backgroundColor: '#000000',
  },
});
