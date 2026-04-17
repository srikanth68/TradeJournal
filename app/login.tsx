import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Dimensions,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { isSupabaseConfigured } from '../src/lib/supabase';

const { width } = Dimensions.get('window');

type AuthTab = 'email' | 'phone';
type PhasePhone = 'input' | 'otp';

export default function LoginScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const { signInWithGoogle, signInWithApple, signInWithEmail, sendPhoneOtp, verifyPhoneOtp, continueAsGuest } = useAuth();

  const [tab, setTab] = useState<AuthTab>('email');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [phonePhase, setPhonePhase] = useState<PhasePhone>('input');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  const handleGoogle = async () => {
    tap();
    setLoading(true);
    try { await signInWithGoogle(); } catch (e: any) { Alert.alert('Error', e?.message); shake(); }
    finally { setLoading(false); }
  };

  const handleApple = async () => {
    tap();
    setLoading(true);
    try { await signInWithApple(); } catch { /* handled in context */ }
    finally { setLoading(false); }
  };

  const handleEmailContinue = async () => {
    tap();
    if (!email.trim() || !password.trim()) { shake(); return; }
    if (password.length < 6) { Alert.alert('Password too short', 'At least 6 characters required.'); shake(); return; }
    setLoading(true);
    try {
      await signInWithEmail(email.trim().toLowerCase(), password, isSignUp);
    } catch (e: any) {
      Alert.alert(isSignUp ? 'Sign Up Failed' : 'Sign In Failed', e?.message ?? 'Please try again.');
      shake();
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    tap();
    if (!phone.trim()) { shake(); return; }
    setLoading(true);
    try {
      await sendPhoneOtp(phone.trim());
      setPhonePhase('otp');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not send OTP.');
      shake();
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    tap();
    if (otp.length < 4) { shake(); return; }
    setLoading(true);
    try {
      await verifyPhoneOtp(phone.trim(), otp.trim());
    } catch (e: any) {
      Alert.alert('Incorrect Code', e?.message ?? 'Please check the code and try again.');
      shake();
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    tap();
    await continueAsGuest();
  };

  const colors = {
    bg1: isDark ? '#0A0A0F' : '#0F1824',
    bg2: isDark ? '#0F1824' : '#1A2D45',
    card: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.10)',
    cardBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.15)',
    text: '#FFFFFF',
    textMuted: 'rgba(255,255,255,0.55)',
    input: 'rgba(255,255,255,0.08)',
    inputBorder: 'rgba(255,255,255,0.15)',
    accent: '#4F8EF7',
    accentAlt: '#7B61FF',
    divider: 'rgba(255,255,255,0.15)',
    pillActive: 'rgba(79,142,247,0.25)',
  };

  return (
    <LinearGradient colors={[colors.bg1, colors.bg2, '#0D2137']} style={s.flex}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── Hero ── */}
          <View style={s.hero}>
            <View style={[s.logoWrap, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Ionicons name="trending-up" size={38} color={colors.accent} />
            </View>
            <Text style={[s.appName, { color: colors.text }]}>TradeJournal</Text>
            <Text style={[s.tagline, { color: colors.textMuted }]}>Your trading edge, sharpened.</Text>
          </View>

          {/* ── Social buttons ── */}
          <Animated.View style={[s.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, transform: [{ translateX: shakeAnim }] }]}>

            <TouchableOpacity style={s.socialBtn} onPress={handleGoogle} activeOpacity={0.75} disabled={loading}>
              <View style={s.socialIcon}>
                <Text style={s.socialIconG}>G</Text>
              </View>
              <Text style={[s.socialLabel, { color: colors.text }]}>Continue with Google</Text>
              {!isSupabaseConfigured && <Ionicons name="lock-closed" size={13} color={colors.textMuted} />}
            </TouchableOpacity>

            <TouchableOpacity style={[s.socialBtn, s.appleBtn]} onPress={handleApple} activeOpacity={0.75} disabled={loading}>
              <Ionicons name="logo-apple" size={22} color={colors.text} style={s.socialIcon} />
              <Text style={[s.socialLabel, { color: colors.text }]}>Continue with Apple</Text>
            </TouchableOpacity>

            {/* ── Divider ── */}
            <View style={s.dividerRow}>
              <View style={[s.dividerLine, { backgroundColor: colors.divider }]} />
              <Text style={[s.dividerText, { color: colors.textMuted }]}>or</Text>
              <View style={[s.dividerLine, { backgroundColor: colors.divider }]} />
            </View>

            {/* ── Tab Pills ── */}
            <View style={[s.tabRow, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: colors.cardBorder }]}>
              {(['email', 'phone'] as AuthTab[]).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.tabPill, tab === t && { backgroundColor: colors.pillActive }]}
                  onPress={() => { tap(); setTab(t); setPhonePhase('input'); }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={t === 'email' ? 'mail-outline' : 'phone-portrait-outline'}
                    size={15}
                    color={tab === t ? colors.accent : colors.textMuted}
                  />
                  <Text style={[s.tabLabel, { color: tab === t ? colors.accent : colors.textMuted }]}>
                    {t === 'email' ? 'Email' : 'Phone'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Email form ── */}
            {tab === 'email' && (
              <View style={s.form}>
                <View style={[s.inputWrap, { backgroundColor: colors.input, borderColor: colors.inputBorder }]}>
                  <Ionicons name="mail-outline" size={17} color={colors.textMuted} style={s.inputIcon} />
                  <TextInput
                    style={[s.input, { color: colors.text }]}
                    placeholder="your@email.com"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
                <View style={[s.inputWrap, { backgroundColor: colors.input, borderColor: colors.inputBorder }]}>
                  <Ionicons name="lock-closed-outline" size={17} color={colors.textMuted} style={s.inputIcon} />
                  <TextInput
                    style={[s.input, { color: colors.text }]}
                    placeholder="Password"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(p => !p)} style={s.eyeBtn}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[s.primaryBtn, { opacity: loading ? 0.6 : 1 }]}
                  onPress={handleEmailContinue}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={[colors.accent, colors.accentAlt]} style={s.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    {loading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={s.primaryBtnText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>}
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { tap(); setIsSignUp(v => !v); }} style={s.toggleBtn}>
                  <Text style={[s.toggleText, { color: colors.textMuted }]}>
                    {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                    <Text style={{ color: colors.accent }}>{isSignUp ? 'Sign in' : 'Sign up'}</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Phone form ── */}
            {tab === 'phone' && phonePhase === 'input' && (
              <View style={s.form}>
                <View style={[s.inputWrap, { backgroundColor: colors.input, borderColor: colors.inputBorder }]}>
                  <Ionicons name="flag-outline" size={17} color={colors.textMuted} style={s.inputIcon} />
                  <TextInput
                    style={[s.input, { color: colors.text }]}
                    placeholder="+1 555 000 1234"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>
                <TouchableOpacity
                  style={[s.primaryBtn, { opacity: loading ? 0.6 : 1 }]}
                  onPress={handleSendOtp}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={[colors.accent, colors.accentAlt]} style={s.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    {loading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={s.primaryBtnText}>Send Code</Text>}
                  </LinearGradient>
                </TouchableOpacity>
                {!isSupabaseConfigured && (
                  <Text style={[s.notice, { color: colors.textMuted }]}>⚠ Phone auth needs Supabase + SMS provider</Text>
                )}
              </View>
            )}

            {tab === 'phone' && phonePhase === 'otp' && (
              <View style={s.form}>
                <Text style={[s.otpHint, { color: colors.textMuted }]}>
                  Code sent to <Text style={{ color: colors.text }}>{phone}</Text>
                </Text>
                <View style={[s.inputWrap, { backgroundColor: colors.input, borderColor: colors.inputBorder }]}>
                  <Ionicons name="keypad-outline" size={17} color={colors.textMuted} style={s.inputIcon} />
                  <TextInput
                    style={[s.input, s.otpInput, { color: colors.text }]}
                    placeholder="6-digit code"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otp}
                    onChangeText={setOtp}
                  />
                </View>
                <TouchableOpacity
                  style={[s.primaryBtn, { opacity: loading ? 0.6 : 1 }]}
                  onPress={handleVerifyOtp}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={[colors.accent, colors.accentAlt]} style={s.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    {loading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={s.primaryBtnText}>Verify Code</Text>}
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { tap(); setPhonePhase('input'); setOtp(''); }} style={s.toggleBtn}>
                  <Text style={[s.toggleText, { color: colors.textMuted }]}>
                    ← <Text style={{ color: colors.accent }}>Use different number</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            )}

          </Animated.View>

          {/* ── Guest access ── */}
          <TouchableOpacity style={s.guestBtn} onPress={handleGuest} activeOpacity={0.7}>
            <Text style={[s.guestText, { color: colors.textMuted }]}>Continue without account</Text>
          </TouchableOpacity>

          <Text style={[s.privacyText, { color: 'rgba(255,255,255,0.22)' }]}>
            Your trade data stays on your device.{'\n'}No account required to use the app.
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 80, paddingBottom: 40 },

  // Hero
  hero: { alignItems: 'center', marginBottom: 36 },
  logoWrap: {
    width: 76, height: 76, borderRadius: 22, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  appName: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5, marginBottom: 6 },
  tagline: { fontSize: 15, fontWeight: '400', letterSpacing: 0.2 },

  // Card
  card: {
    width: '100%', maxWidth: 400,
    borderRadius: 20, borderWidth: 1,
    padding: 20, marginBottom: 16,
    overflow: 'hidden',
  },

  // Social buttons
  socialBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16,
    marginBottom: 10, gap: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  appleBtn: { backgroundColor: 'rgba(255,255,255,0.95)' },
  socialIcon: {
    width: 24, height: 24, borderRadius: 6,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  socialIconG: { fontSize: 15, fontWeight: '700', color: '#4285F4' },
  socialLabel: { flex: 1, fontSize: 15, fontWeight: '600' },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 10 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontWeight: '500' },

  // Tab pills
  tabRow: {
    flexDirection: 'row', borderRadius: 10, borderWidth: 1,
    padding: 3, marginBottom: 16, gap: 4,
  },
  tabPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, borderRadius: 8, gap: 5,
  },
  tabLabel: { fontSize: 13, fontWeight: '600' },

  // Form
  form: { gap: 10 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, height: 46, fontSize: 15, fontWeight: '400' },
  eyeBtn: { padding: 4 },

  // Primary button
  primaryBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 2 },
  btnGradient: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  // Toggle
  toggleBtn: { alignItems: 'center', paddingVertical: 4 },
  toggleText: { fontSize: 13, fontWeight: '400' },

  // Phone OTP
  otpHint: { fontSize: 13, textAlign: 'center', marginBottom: 4 },
  otpInput: { letterSpacing: 6, fontSize: 20, fontWeight: '600', textAlign: 'center' },

  // Notice
  notice: { fontSize: 12, textAlign: 'center', marginTop: 4 },

  // Guest
  guestBtn: { paddingVertical: 12, paddingHorizontal: 24 },
  guestText: { fontSize: 14, fontWeight: '500', textDecorationLine: 'underline' },

  // Privacy
  privacyText: { fontSize: 11, textAlign: 'center', marginTop: 8, lineHeight: 17 },
});
