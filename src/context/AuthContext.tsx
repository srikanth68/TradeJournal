import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';

// ─────────────────────────────────────────────────────────────────────────────
// Google Sign-In configuration
//
// To obtain a webClientId:
//   1. Go to https://console.cloud.google.com
//   2. Select (or create) your project
//   3. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
//   4. Application type: "Web application" — copy the Client ID
//   5. Also create an "iOS" client ID and note the reversed client ID for app.json
//   6. Replace the placeholder below with your actual Web Client ID
// ─────────────────────────────────────────────────────────────────────────────
const GOOGLE_WEB_CLIENT_ID =
  'REPLACE_WITH_YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';

GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

// ─── Types ───────────────────────────────────────────────────────────────────

export type AuthProvider = 'apple' | 'google' | 'guest';

export interface AuthUser {
  userId: string;
  email: string | null;
  name: string | null;
  provider: AuthProvider;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoaded: boolean;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
}

// ─── Storage key ─────────────────────────────────────────────────────────────

const STORAGE_KEY = '@auth_identity';

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Restore identity from storage on boot
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setUser(JSON.parse(raw));
      })
      .finally(() => setIsLoaded(true));
  }, []);

  async function persist(u: AuthUser) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
  }

  // ── Sign in with Apple ──────────────────────────────────────────────────────
  async function signInWithApple() {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const firstName = credential.fullName?.givenName ?? null;
    const lastName = credential.fullName?.familyName ?? null;
    const name =
      firstName || lastName
        ? [firstName, lastName].filter(Boolean).join(' ')
        : null;

    await persist({
      userId: `apple:${credential.user}`,
      email: credential.email ?? null,
      // Apple only returns the name on first sign-in; preserve previously stored name
      name: name ?? (user?.provider === 'apple' ? user.name : null),
      provider: 'apple',
    });
  }

  // ── Sign in with Google ─────────────────────────────────────────────────────
  async function signInWithGoogle() {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();

    // response.data is present for successful sign-ins (SDK v13+)
    const info = response.data?.user ?? (response as any).user;
    await persist({
      userId: `google:${info.id}`,
      email: info.email ?? null,
      name: info.name ?? null,
      provider: 'google',
    });
  }

  // ── Continue without account ────────────────────────────────────────────────
  async function continueAsGuest() {
    await persist({
      userId: 'guest',
      email: null,
      name: null,
      provider: 'guest',
    });
  }

  // ── Sign out — clears identity only, trade data is untouched ───────────────
  async function signOut() {
    await AsyncStorage.removeItem(STORAGE_KEY);
    if (user?.provider === 'google') {
      try {
        await GoogleSignin.signOut();
      } catch {
        // best-effort
      }
    }
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoaded, signInWithApple, signInWithGoogle, continueAsGuest, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
