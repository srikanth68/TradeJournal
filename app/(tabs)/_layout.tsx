import { useRef, useEffect } from 'react';
import { Tabs, usePathname, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PanResponder, View, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';

const TAB_ORDER = ['/', '/trades', '/add', '/calendar', '/journal', '/coach'];

export default function TabLayout() {
  const { colors } = useTheme();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const currentIdxRef = useRef(0);

  function handleAccountPress() {
    const title = user?.name ?? user?.email ?? (user?.provider === 'guest' ? 'Guest' : 'Account');
    Alert.alert(title, user?.email ?? undefined, [
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  useEffect(() => {
    const idx = TAB_ORDER.indexOf(pathname);
    if (idx !== -1) currentIdxRef.current = idx;
  }, [pathname]);

  const panResponder = useRef(
    PanResponder.create({
      // Only claim gesture if clearly more horizontal than vertical
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > Math.abs(gs.dy) * 2 && Math.abs(gs.dx) > 10,
      onPanResponderRelease: (_, gs) => {
        if (Math.abs(gs.dx) < 50) return;
        const idx = currentIdxRef.current;
        if (gs.dx < 0 && idx < TAB_ORDER.length - 1) {
          // Swipe left → next tab
          router.navigate(TAB_ORDER[idx + 1] as never);
        } else if (gs.dx > 0 && idx > 0) {
          // Swipe right → previous tab
          router.navigate(TAB_ORDER[idx - 1] as never);
        }
      },
    })
  ).current;

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 17,
            color: colors.textPrimary,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bar-chart" size={size} color={color} />
            ),
            headerShown: true,
            headerRight: () => (
              <TouchableOpacity onPress={handleAccountPress} style={{ marginRight: 16 }}>
                <Ionicons name="person-circle-outline" size={26} color={colors.primary} />
              </TouchableOpacity>
            ),
          }}
        />
        <Tabs.Screen
          name="trades"
          options={{
            title: 'Trades',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="list" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="add"
          options={{
            title: 'Add Trade',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="add-circle" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Calendar',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="journal"
          options={{
            title: 'Journal',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="book-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="coach"
          options={{
            title: 'Coach',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="sparkles-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
