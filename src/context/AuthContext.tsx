import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { generateUUID } from '../utils/uuid';

WebBrowser.maybeCompleteAuthSession();

const GUEST_USER_KEY = 'guest_user_id';
const GUEST_NAME_KEY = 'guest_display_name';

export type AuthUser = {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  isGuest: boolean;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string, isSignUp: boolean) => Promise<void>;
  sendPhoneOtp: (phone: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<void>;
  continueAsGuest: (name?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function sessionToUser(session: Session): AuthUser {
  const u = session.user;
  return {
    id: u.id,
    email: u.email ?? undefined,
    name:
      u.user_metadata?.full_name ??
      u.user_metadata?.name ??
      u.email?.split('@')[0],
    avatarUrl:
      u.user_metadata?.avatar_url ??
      u.user_metadata?.picture ??
      undefined,
    isGuest: false,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Bootstrap: check for existing session or guest user
  useEffect(() => {
    (async () => {
      try {
        if (isSupabaseConfigured) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            setUser(sessionToUser(data.session));
            setLoading(false);
            return;
          }
        }
        // Check guest mode
        const guestId = await SecureStore.getItemAsync(GUEST_USER_KEY);
        if (guestId) {
          const guestName = await SecureStore.getItemAsync(GUEST_NAME_KEY);
          setUser({ id: guestId, name: guestName ?? 'Trader', isGuest: true });
        }
      } catch (e) {
        console.warn('Auth bootstrap error:', e);
      } finally {
        setLoading(false);
      }
    })();

    if (isSupabaseConfigured) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) setUser(sessionToUser(session));
        else setUser(null);
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured) {
      Alert.alert('Setup Required', 'Add your Supabase credentials to .env to enable Google Sign-In.');
      return;
    }
    const redirectUrl = makeRedirectUri({ scheme: 'tradejournal', path: 'auth/callback' });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
    });
    if (error || !data.url) {
      Alert.alert('Error', error?.message ?? 'Could not start Google sign-in.');
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    if (result.type === 'success') {
      const url = new URL(result.url);
      const code = url.searchParams.get('code');
      if (code) await supabase.auth.exchangeCodeForSession(code);
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    try {
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        Alert.alert('Not Available', 'Apple Sign In is only available on iOS devices.');
        return;
      }
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('No identity token from Apple');

      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });
        if (error) throw error;
      } else {
        // Fallback: use Apple credential locally
        const name = [credential.fullName?.givenName, credential.fullName?.familyName]
          .filter(Boolean).join(' ') || 'Trader';
        await continueAsGuest(name);
      }
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple Sign In Error', e?.message ?? 'Something went wrong.');
      }
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string, isSignUp: boolean) => {
    if (!isSupabaseConfigured) {
      // Local-only mode: derive a deterministic UUID from email and treat as guest
      // Sanitize email to a valid SecureStore key (alphanumeric + . - _)
      const emailKey = `local_user_${email.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const localId = await SecureStore.getItemAsync(emailKey) ?? generateUUID();
      await SecureStore.setItemAsync(emailKey, localId);
      await SecureStore.setItemAsync(GUEST_USER_KEY, localId);
      await SecureStore.setItemAsync(GUEST_NAME_KEY, email.split('@')[0]);
      setUser({ id: localId, email, name: email.split('@')[0], isGuest: false });
      return;
    }
    const fn = isSignUp
      ? () => supabase.auth.signUp({ email, password })
      : () => supabase.auth.signInWithPassword({ email, password });
    const { error } = await fn();
    if (error) throw error;
    if (isSignUp) {
      Alert.alert('Check your email', 'A confirmation link has been sent to your inbox.');
    }
  }, []);

  const sendPhoneOtp = useCallback(async (phone: string) => {
    if (!isSupabaseConfigured) {
      Alert.alert('Setup Required', 'Phone auth requires a Supabase project with SMS enabled.');
      throw new Error('Supabase not configured');
    }
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw error;
  }, []);

  const verifyPhoneOtp = useCallback(async (phone: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error) throw error;
  }, []);

  const continueAsGuest = useCallback(async (name?: string) => {
    let guestId = await SecureStore.getItemAsync(GUEST_USER_KEY);
    if (!guestId) {
      guestId = generateUUID();
      await SecureStore.setItemAsync(GUEST_USER_KEY, guestId);
    }
    const displayName = name ?? 'Trader';
    await SecureStore.setItemAsync(GUEST_NAME_KEY, displayName);
    setUser({ id: guestId, name: displayName, isGuest: true });
  }, []);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut();
    await SecureStore.deleteItemAsync(GUEST_USER_KEY);
    await SecureStore.deleteItemAsync(GUEST_NAME_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user, loading,
        signInWithGoogle, signInWithApple,
        signInWithEmail, sendPhoneOtp, verifyPhoneOtp,
        continueAsGuest, signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
