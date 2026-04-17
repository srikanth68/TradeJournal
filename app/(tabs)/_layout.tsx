import { useRef, useEffect, useState } from 'react';
import { Tabs, usePathname, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  PanResponder, View, Text, TouchableOpacity,
  StyleSheet, Modal, Alert, Image,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';

const TAB_ORDER = ['/', '/trades', '/add', '/calendar', '/journal', '/coach'];

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  index:    { active: 'bar-chart',       inactive: 'bar-chart-outline' },
  trades:   { active: 'list',            inactive: 'list-outline' },
  add:      { active: 'add-circle',      inactive: 'add-circle-outline' },
  calendar: { active: 'calendar',        inactive: 'calendar-outline' },
  journal:  { active: 'book',            inactive: 'book-outline' },
  coach:    { active: 'sparkles',        inactive: 'sparkles-outline' },
};

function ProfileModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, isDark } = useTheme();
  const { user, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => { onClose(); await signOut(); },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={ps.overlay} activeOpacity={1} onPress={onClose}>
        <BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      </TouchableOpacity>
      <View style={[ps.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Avatar */}
        <View style={[ps.avatarRow, { borderBottomColor: colors.border }]}>
          {user?.avatarUrl
            ? <Image source={{ uri: user.avatarUrl }} style={ps.avatar} />
            : (
              <View style={[ps.avatarFallback, { backgroundColor: colors.primary + '22' }]}>
                <Text style={[ps.avatarInitial, { color: colors.primary }]}>
                  {(user?.name ?? 'T')[0].toUpperCase()}
                </Text>
              </View>
            )
          }
          <View style={ps.userInfo}>
            <Text style={[ps.userName, { color: colors.textPrimary }]}>{user?.name ?? 'Trader'}</Text>
            <Text style={[ps.userEmail, { color: colors.textSecondary }]}>
              {user?.isGuest ? 'Guest · local data only' : user?.email ?? ''}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <TouchableOpacity style={[ps.menuItem, { borderBottomColor: colors.border }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }}>
          <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
          <Text style={[ps.menuLabel, { color: colors.textPrimary }]}>Settings</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity style={ps.menuItem} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color={colors.loss} />
          <Text style={[ps.menuLabel, { color: colors.loss }]}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const pathname = usePathname();
  const currentIdxRef = useRef(0);
  const [profileVisible, setProfileVisible] = useState(false);

  useEffect(() => {
    const idx = TAB_ORDER.indexOf(pathname);
    if (idx !== -1) currentIdxRef.current = idx;
  }, [pathname]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > Math.abs(gs.dy) * 2 && Math.abs(gs.dx) > 10,
      onPanResponderRelease: (_, gs) => {
        if (Math.abs(gs.dx) < 50) return;
        const idx = currentIdxRef.current;
        if (gs.dx < 0 && idx < TAB_ORDER.length - 1) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.navigate(TAB_ORDER[idx + 1] as never);
        } else if (gs.dx > 0 && idx > 0) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.navigate(TAB_ORDER[idx - 1] as never);
        }
      },
    })
  ).current;

  const avatarInitial = (user?.name ?? 'T')[0].toUpperCase();

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <ProfileModal visible={profileVisible} onClose={() => setProfileVisible(false)} />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#C9A84C',
          tabBarInactiveTintColor: '#9B9B9B',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#E8E8E8',
            borderTopWidth: 1,
          },
          headerStyle: {
            backgroundColor: '#FFFFFF',
          },
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 17,
            color: '#1A1A1A',
          },
        }}
      >
        <Tabs.Screen name="index"    options={{ title: 'Dashboard' }} />
        <Tabs.Screen name="trades"   options={{ title: 'Trades' }} />
        <Tabs.Screen name="add"      options={{ title: 'New Trade' }} />
        <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
        <Tabs.Screen name="journal"  options={{ title: 'Journal' }} />
        <Tabs.Screen name="coach"    options={{ title: 'AI Coach' }} />
      </Tabs>
    </View>
  );
}

const ps = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden', zIndex: 1,
  },
  avatarRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 20, gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 22, fontWeight: '700' },
  userInfo: { flex: 1 },
  userName: { fontSize: 17, fontWeight: '700', marginBottom: 2 },
  userEmail: { fontSize: 13, fontWeight: '400' },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 20,
    gap: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: '500' },
});
