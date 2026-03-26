import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { runMigrations } from '../src/db';
import { seedStrategies } from '../src/db/seed';

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    (async () => {
      await runMigrations();
      await seedStrategies();
      setDbReady(true);
    })();
  }, []);

  if (!dbReady) return null;

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
