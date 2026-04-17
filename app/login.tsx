import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { useTheme, type AppColors } from '../src/theme';

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { signInWithApple, signInWithGoogle, continueAsGuest } = useAuth();
  const [loading, setLoading] = useState<'apple' | 'google' | 'guest' | null>(null);

  async function handleApple() {
    setLoading('apple');
    try {
      await signInWithApple();
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Sign-in failed', e.message ?? 'Something went wrong');
      }
    } finally {
      setLoading(null);
    }
  }

  async function handleGoogle() {
    setLoading('google');
    try {
      await signInWithGoogle();
    } catch (e: any) {
      const { statusCodes } = await import('@react-native-google-signin/google-signin');
      if (e.code !== statusCodes.SIGN_IN_CANCELLED) {
        if (e.code === statusCodes.IN_PROGRESS) return;
        if (
          e.message?.includes('REPLACE_WITH_YOUR_WEB_CLIENT_ID') ||
          e.message?.includes('12500') ||
          e.message?.includes('developer_error')
        ) {
          Alert.alert(
            'Google Sign-In not configured',
            'Add your Google Web Client ID in src/context/AuthContext.tsx to enable Google Sign-In.',
          );
        } else {
          Alert.alert('Sign-in failed', e.message ?? 'Something went wrong');
        }
      }
    } finally {
      setLoading(null);
    }
  }

  async function handleGuest() {
    setLoading('guest');
    try {
      await continueAsGuest();
    } finally {
      setLoading(null);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Branding */}
      <View style={styles.hero}>
        <View style={styles.iconWrap}>
          <Ionicons name="bar-chart" size={48} color={colors.primary} />
        </View>
        <Text style={styles.appName}>TradeJournal</Text>
        <Text style={styles.tagline}>Track every trade. Master your edge.</Text>
      </View>

      {/* Sign-in buttons */}
      <View style={styles.buttons}>
        {/* Sign in with Apple — iOS/macOS only */}
        {Platform.OS === 'ios' || Platform.OS === 'macos' ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={
              colors.surface === '#FFFFFF'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                : AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            }
            cornerRadius={12}
            style={styles.appleButton}
            onPress={handleApple}
          />
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.appleButtonFallback]}
            onPress={handleApple}
            disabled={!!loading}
          >
            {loading === 'apple' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="logo-apple" size={20} color="#fff" style={styles.btnIcon} />
                <Text style={[styles.btnText, { color: '#fff' }]}>Sign in with Apple</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Sign in with Google */}
        <TouchableOpacity
          style={[styles.button, styles.googleButton]}
          onPress={handleGoogle}
          disabled={!!loading}
          activeOpacity={0.8}
        >
          {loading === 'google' ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <>
              <GoogleIcon style={styles.btnIcon} />
              <Text style={[styles.btnText, { color: colors.textPrimary }]}>
                Sign in with Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Continue without account */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleGuest}
          disabled={!!loading}
          activeOpacity={0.6}
        >
          {loading === 'guest' ? (
            <ActivityIndicator color={colors.textSecondary} size="small" />
          ) : (
            <Text style={styles.skipText}>Continue without account</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.footnote}>
        Your identity is stored only on this device.{'\n'}
        Trade data is never uploaded automatically.
      </Text>
    </SafeAreaView>
  );
}

// ─── Minimal Google "G" icon ─────────────────────────────────────────────────

function GoogleIcon({ style }: { style?: object }) {
  return (
    <View style={[{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }, style]}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#4285F4' }}>G</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'space-between',
      paddingHorizontal: 32,
      paddingBottom: 32,
    },
    hero: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    iconWrap: {
      width: 88,
      height: 88,
      borderRadius: 22,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    appName: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.5,
    },
    tagline: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    buttons: {
      gap: 12,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 52,
      borderRadius: 12,
      paddingHorizontal: 20,
    },
    appleButton: {
      height: 52,
    },
    appleButtonFallback: {
      backgroundColor: '#000',
    },
    googleButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    btnIcon: {
      marginRight: 10,
    },
    btnText: {
      fontSize: 16,
      fontWeight: '600',
    },
    skipButton: {
      alignItems: 'center',
      paddingVertical: 14,
    },
    skipText: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    footnote: {
      fontSize: 12,
      color: colors.textTertiary,
      textAlign: 'center',
      lineHeight: 18,
      marginTop: 16,
    },
  });
}
