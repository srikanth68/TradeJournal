import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { runMigrations } from '../src/db';
import { seedStrategies, seedDemoTrades } from '../src/db/seed';
import { AuthProvider, useAuth } from '../src/context/AuthContext';

function RootNavigator() {
  const { user, isLoaded } = useAuth();
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    (async () => {
      await runMigrations();
      await seedStrategies();
      await seedDemoTrades();
      setDbReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!isLoaded || !dbReady) return;

    if (user) {
      router.replace('/(tabs)');
    } else {
      router.replace('/login');
    }
  }, [isLoaded, dbReady, user]);

  if (!isLoaded || !dbReady) return null;

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
