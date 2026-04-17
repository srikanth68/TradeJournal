import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { runMigrations } from '../src/db';
import { seedStrategies, seedDemoTrades } from '../src/db/seed';
import { AuthProvider, useAuth } from '../src/context/AuthContext';

function AuthGuard({ dbReady }: { dbReady: boolean }) {
  const { user, loading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (!dbReady || loading) return;
    const inAuthFlow = segments[0] === 'login' || (segments[0] as string) === 'auth';
    if (!user && !inAuthFlow) {
      router.replace('/login');
    } else if (user && inAuthFlow) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments, dbReady]);

  return null;
}

function RootLayoutInner() {
  const [dbReady, setDbReady] = useState(false);
  const { loading: authLoading } = useAuth();
  const scheme = useColorScheme();

  useEffect(() => {
    (async () => {
      await runMigrations();
      await seedStrategies();
      await seedDemoTrades();
      setDbReady(true);
    })();
  }, []);

  if (!dbReady || authLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: scheme === 'dark' ? '#000000' : '#F2F2F7' }}>
        <ActivityIndicator size="large" color="#0A84FF" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <AuthGuard dbReady={dbReady} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="position/[id]" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutInner />
    </AuthProvider>
  );
}
