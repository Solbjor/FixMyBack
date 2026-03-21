import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from './src/api';
import LoginScreen from './src/screens/LoginScreen';
import CameraScreen from './src/screens/CameraScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';

type TabKey = 'home' | 'camera' | 'profile';
type AppStage = 'login' | 'welcome' | 'app';

interface Session {
  email: string;
  uid: string;
  idToken: string;
}

const tabs: Array<{
  key: TabKey;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'home',    icon: 'home-outline',   activeIcon: 'home'   },
  { key: 'camera',  icon: 'camera-outline', activeIcon: 'camera' },
  { key: 'profile', icon: 'person-outline', activeIcon: 'person' },
];

// ─── Animated tab button ──────────────────────────────────────────────────────

function TabButton({
  tab,
  active,
  onPress,
}: {
  tab: (typeof tabs)[number];
  active: boolean;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const liftAnim  = useRef(new Animated.Value(active ? -3 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(liftAnim, {
        toValue: active ? -3 : 0,
        useNativeDriver: true,
        tension: 120,
        friction: 9,
      }),
      Animated.spring(scaleAnim, {
        toValue: active ? 1.06 : 1,
        useNativeDriver: true,
        tension: 140,
        friction: 8,
      }),
    ]).start();
  }, [active, liftAnim, scaleAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: active ? 0.96 : 0.9,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: active ? 1.06 : 1,
      useNativeDriver: true,
      tension: 120,
      friction: 6,
    }).start();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tab.key} tab`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.tabButton,
          active && styles.tabButtonActive,
          { transform: [{ translateY: liftAnim }, { scale: scaleAnim }] },
        ]}
      >
        <Ionicons
          name={active ? tab.activeIcon : tab.icon}
          size={22}
          color={active ? '#ffffff' : '#111111'}
        />
      </Animated.View>
    </Pressable>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('camera');
  const [stage, setStage] = useState<AppStage>('login');
  const [session, setSession] = useState<Session | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  const handleTabPress = (tabKey: TabKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
      // Ignore haptics failures on unsupported devices/platforms.
    });
    setActiveTab(tabKey);
  };

  const handleLogin = async (email: string, password: string) => {
    const data = await api.login(email,password);
    setLoggedIn(true);

    setSession({
      email,
      uid: data.uid,
      idToken: data.idToken,
    });
    setStage('welcome');
  };

  const handleSignup = async (
    email: string,
    password: string,
    displayName: string,
  ) => {
    const data = await api.signup(email, password, displayName)

    setSession({
      email: data.email ?? email,
      uid: data.uid,
      idToken: '',
    });
    setStage('welcome');
  };

  const handleContinue = () => {
    Haptics.selectionAsync().catch(() => {
      // Ignore haptics failures on unsupported devices/platforms.
    });
    setStage('app');
  };

  const handleLogout = () => {
    setSession(null);
    setStage('login');
    setActiveTab('camera');
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <StatusBar style="dark" />

      <View style={styles.screen}>
        {stage === 'login' && (
          <LoginScreen onLogin={handleLogin} onSignup={handleSignup} />
        )}
        {stage === 'welcome' && session && (
          <WelcomeScreen
            email={session.email}
            onContinue={handleContinue}
            onLogout={handleLogout}
          />
        )}
        {stage === 'app' && (
          <>
            {activeTab === 'home' && <HomeScreen />}
            {activeTab === 'camera' && <CameraScreen />}
            {activeTab === 'profile' && (
              <ProfileScreen email={session?.email} onLogout={handleLogout} />
            )}
          </>
        )}
      </View>

      {stage === 'app' && (
        <View style={styles.tabShell}>
          <View style={styles.tabBar}>
            {tabs.map((tab) => (
              <TabButton
                key={tab.key}
                tab={tab}
                active={activeTab === tab.key}
                onPress={() => handleTabPress(tab.key)}
              />
            ))}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    paddingBottom: 30,
  },
  tabBar: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d9d4c7',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
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
  tabButtonActive: {
    backgroundColor: '#111111',
  },
});
