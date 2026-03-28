import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPositions, type PositionWithEntries } from '../../src/services/positionService';
import { streamCoachReply, type Message } from '../../src/services/coachService';

const API_KEY_STORAGE = '@coach_api_key';

const STARTERS = [
  'What patterns do you see in my losing trades?',
  'How is my emotional discipline?',
  'Which setups are working best for me?',
  'Am I taking profits too early or too late?',
  'What should I focus on improving this week?',
];

// ─── API Key Setup ────────────────────────────────────────────────────────────

function ApiKeySetup({ onSave }: { onSave: (key: string) => void }) {
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = key.trim();
    if (!trimmed.startsWith('sk-ant-')) {
      Alert.alert('Invalid Key', 'Paste your Anthropic API key (starts with sk-ant-)');
      return;
    }
    setSaving(true);
    await AsyncStorage.setItem(API_KEY_STORAGE, trimmed);
    setSaving(false);
    onSave(trimmed);
  };

  return (
    <View style={styles.setupContainer}>
      <View style={styles.setupIcon}>
        <Text style={styles.setupEmoji}>🧠</Text>
      </View>
      <Text style={styles.setupTitle}>Meet Your AI Trade Coach</Text>
      <Text style={styles.setupDesc}>
        The coach analyzes your full trade history — win rates, emotional patterns,
        strategy performance — and gives you brutally honest, data-driven feedback.
        {'\n\n'}
        This feature uses Claude AI. Paste your free Anthropic API key below.
      </Text>
      <TouchableOpacity
        style={styles.setupLink}
        onPress={() => Linking.openURL('https://console.anthropic.com/settings/keys')}
      >
        <Text style={styles.setupLinkText}>Get a free API key →</Text>
      </TouchableOpacity>
      <TextInput
        style={styles.keyInput}
        placeholder="sk-ant-api03-..."
        placeholderTextColor="#C7C7CC"
        value={key}
        onChangeText={setKey}
        autoCorrect={false}
        autoCapitalize="none"
        secureTextEntry
      />
      <TouchableOpacity
        style={[styles.setupBtn, (!key.trim() || saving) && styles.setupBtnDisabled]}
        onPress={handleSave}
        disabled={!key.trim() || saving}
      >
        {saving
          ? <ActivityIndicator color="#FFF" />
          : <Text style={styles.setupBtnText}>Unlock AI Coach</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function Bubble({ message }: { message: Message & { streaming?: boolean } }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={styles.coachAvatar}>
          <Text style={styles.coachAvatarText}>AI</Text>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
          {message.content}
          {message.streaming && <Text style={styles.cursor}>▋</Text>}
        </Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CoachScreen() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyLoaded, setKeyLoaded] = useState(false);
  const [positions, setPositions] = useState<PositionWithEntries[]>([]);
  const [messages, setMessages] = useState<Array<Message & { streaming?: boolean }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [savedKey, pos] = await Promise.all([
          AsyncStorage.getItem(API_KEY_STORAGE),
          getPositions(),
        ]);
        if (!active) return;
        setApiKey(savedKey);
        setKeyLoaded(true);
        setPositions(pos);
      })();
      return () => { active = false; };
    }, [])
  );

  const scrollToBottom = () =>
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

  const send = async (text: string) => {
    if (!text.trim() || loading || !apiKey) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    scrollToBottom();

    // Add empty assistant placeholder
    const assistantId = Date.now();
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

    let accumulated = '';
    await streamCoachReply(
      apiKey,
      [...messages, userMsg],
      positions,
      chunk => {
        accumulated += chunk;
        setMessages(prev => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === 'assistant') {
            copy[copy.length - 1] = { ...last, content: accumulated };
          }
          return copy;
        });
        scrollToBottom();
      },
      () => {
        setMessages(prev => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === 'assistant') {
            copy[copy.length - 1] = { ...last, streaming: false };
          }
          return copy;
        });
        setLoading(false);
        scrollToBottom();
      },
      err => {
        setMessages(prev => prev.slice(0, -1)); // remove empty placeholder
        setLoading(false);
        Alert.alert('Error', err.includes('auth') ? 'Invalid API key. Tap ⚙ to update it.' : err);
      }
    );
  };

  const clearKey = async () => {
    Alert.alert('Remove API Key', 'Clear saved key and reset the coach?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(API_KEY_STORAGE);
          setApiKey(null);
          setMessages([]);
        },
      },
    ]);
  };

  if (!keyLoaded) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!apiKey) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.setupScroll}>
          <ApiKeySetup onSave={k => setApiKey(k)} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const hasMessages = messages.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {/* Toolbar */}
        <View style={styles.toolbar}>
          <View style={styles.toolbarLeft}>
            <View style={styles.onlineDot} />
            <Text style={styles.toolbarTitle}>AI Trade Coach</Text>
          </View>
          <TouchableOpacity onPress={clearKey} style={styles.toolbarBtn}>
            <Ionicons name="settings-outline" size={20} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messageList}
          contentContainerStyle={[styles.messageContent, !hasMessages && styles.messageContentCentered]}
          keyboardDismissMode="interactive"
        >
          {!hasMessages ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {positions.filter(p => p.status === 'closed').length > 0
                  ? `I've analyzed your ${positions.filter(p => p.status === 'closed').length} closed trades.`
                  : 'No closed trades yet.'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {positions.filter(p => p.status === 'closed').length > 0
                  ? 'Ask me anything about your trading.'
                  : 'Add some trades and come back for insights.'}
              </Text>
              {positions.filter(p => p.status === 'closed').length > 0 && (
                <View style={styles.starters}>
                  {STARTERS.map(s => (
                    <TouchableOpacity key={s} style={styles.starterChip} onPress={() => send(s)}>
                      <Text style={styles.starterText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ) : (
            messages.map((m, i) => <Bubble key={i} message={m} />)
          )}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.inputField}
            placeholder="Ask your coach..."
            placeholderTextColor="#C7C7CC"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => send(input)}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => send(input)}
            disabled={!input.trim() || loading}
          >
            {loading
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Ionicons name="arrow-up" size={18} color="#FFF" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Setup
  setupScroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  setupContainer: { alignItems: 'center' },
  setupIcon: {
    width: 80, height: 80, borderRadius: 20,
    backgroundColor: '#E5F1FF',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  setupEmoji: { fontSize: 40 },
  setupTitle: { fontSize: 22, fontWeight: '700', color: '#1C1C1E', marginBottom: 12, textAlign: 'center' },
  setupDesc: { fontSize: 14, color: '#6D6D72', lineHeight: 21, textAlign: 'center', marginBottom: 16 },
  setupLink: { marginBottom: 20 },
  setupLinkText: { fontSize: 15, color: '#007AFF', fontWeight: '600' },
  keyInput: {
    width: '100%', backgroundColor: '#FFFFFF', borderRadius: 12,
    padding: 14, fontSize: 14, color: '#1C1C1E',
    borderWidth: 1, borderColor: '#E5E5EA',
    marginBottom: 14,
  },
  setupBtn: {
    width: '100%', backgroundColor: '#007AFF', borderRadius: 12,
    padding: 16, alignItems: 'center',
  },
  setupBtnDisabled: { opacity: 0.5 },
  setupBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },

  // Toolbar
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5EA',
  },
  toolbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34C759' },
  toolbarTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  toolbarBtn: { padding: 4 },

  // Messages
  messageList: { flex: 1 },
  messageContent: { paddingHorizontal: 12, paddingVertical: 16, gap: 12 },
  messageContentCentered: { flexGrow: 1, justifyContent: 'center' },

  emptyState: { alignItems: 'center', paddingHorizontal: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1C1C1E', textAlign: 'center', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#8E8E93', textAlign: 'center', marginBottom: 24 },
  starters: { gap: 8, width: '100%' },
  starterChip: {
    backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#E5E5EA',
  },
  starterText: { fontSize: 14, color: '#007AFF' },

  // Bubbles
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubbleRowUser: { justifyContent: 'flex-end' },
  coachAvatar: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  coachAvatarText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  bubble: {
    maxWidth: '78%', borderRadius: 16, padding: 12,
  },
  bubbleUser: { backgroundColor: '#007AFF', borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: '#1C1C1E', lineHeight: 21 },
  bubbleTextUser: { color: '#FFFFFF' },
  cursor: { color: '#007AFF' },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5EA',
  },
  inputField: {
    flex: 1, backgroundColor: '#F2F2F7', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 15, color: '#1C1C1E', maxHeight: 100,
  },
  sendBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#007AFF',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#C7C7CC' },
});
