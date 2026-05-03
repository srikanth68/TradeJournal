import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';

export default function AuthCallback() {
  const params = useLocalSearchParams();

  useEffect(() => {
    const code = params.code as string | undefined;
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(() => {
        router.replace('/(tabs)');
      });
    } else {
      router.replace('/login');
    }
  }, [params.code]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
      <ActivityIndicator color="#C9A84C" size="large" />
    </View>
  );
}
