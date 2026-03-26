import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { db, schema } from '../../src/db';
import { createPosition } from '../../src/services/positionService';
import { lookupTicker } from '../../src/services/tickerService';
import { StrategyPickerModal } from '../../src/components/StrategyPickerModal';
import type { Strategy } from '../../src/db/schema';

type TradeType = 'buy' | 'short';
type TradeGrade = 'A' | 'B' | 'C' | 'D';
type EmotionTag = 'confident' | 'fomo' | 'hesitant' | 'revenge' | 'bored' | 'patient';

const EMOTION_LABELS: Record<EmotionTag, string> = {
  confident: 'Confident', fomo: 'FOMO', hesitant: 'Hesitant',
  revenge: 'Revenge', bored: 'Bored', patient: 'Patient',
};

export default function AddTradeScreen() {
  const [ticker, setTicker] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [tickerLoading, setTickerLoading] = useState(false);
  const [tradeType, setTradeType] = useState<TradeType>('buy');
  const [entryPrice, setEntryPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [entryDate] = useState(new Date());
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | undefined>();
  const [showStrategyPicker, setShowStrategyPicker] = useState(false);
  const [setupNotes, setSetupNotes] = useState('');
  const [tradeGrade, setTradeGrade] = useState<TradeGrade | undefined>();
  const [emotionTag, setEmotionTag] = useState<EmotionTag | undefined>();
  const [stopLoss, setStopLoss] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    db.select().from(schema.strategies).then(setStrategies).catch(console.error);
  }, []);

  // Ticker auto-fill with 500ms debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (ticker.length < 1) {
      setCompanyName('');
      setCompanyLogoUrl(null);
      setTickerLoading(false);
      return;
    }

    setTickerLoading(true);
    debounceRef.current = setTimeout(async () => {
      const info = await lookupTicker(ticker);
      if (info) {
        setCompanyName(prev => (prev === '' ? info.companyName : prev));
        setCompanyLogoUrl(info.logoUrl);
      } else {
        setCompanyLogoUrl(null);
      }
      setTickerLoading(false);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [ticker]);

  const selectedStrategy = strategies.find(s => s.id === selectedStrategyId);

  const handleSubmit = async () => {
    if (!ticker.trim()) {
      Alert.alert('Missing Field', 'Please enter a ticker symbol.');
      return;
    }
    if (!entryPrice.trim() || isNaN(parseFloat(entryPrice))) {
      Alert.alert('Missing Field', 'Please enter a valid entry price.');
      return;
    }
    if (!quantity.trim() || isNaN(parseFloat(quantity))) {
      Alert.alert('Missing Field', 'Please enter a valid quantity.');
      return;
    }

    setSubmitting(true);
    try {
      await createPosition({
        ticker: ticker.trim(),
        companyName: companyName.trim() || undefined,
        tradeType,
        entryPrice: parseFloat(entryPrice),
        quantity: parseFloat(quantity),
        entryDate,
        strategyId: selectedStrategyId,
        setupNotes: setupNotes.trim() || undefined,
        tradeGrade,
        emotionTag,
        stopLossPrice: stopLoss.trim() ? parseFloat(stopLoss) : undefined,
        targetPrice: targetPrice.trim() ? parseFloat(targetPrice) : undefined,
      });

      // Reset form
      setTicker('');
      setCompanyName('');
      setCompanyLogoUrl(null);
      setEntryPrice('');
      setQuantity('');
      setSelectedStrategyId(undefined);
      setSetupNotes('');
      setTradeGrade(undefined);
      setEmotionTag(undefined);
      setStopLoss('');
      setTargetPrice('');

      router.replace('/(tabs)/');
    } catch (error) {
      console.error('Failed to create position:', error);
      Alert.alert('Error', 'Failed to save trade. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          <Text style={styles.sectionHeader}>Trade Details</Text>
          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <Text style={styles.label}>Ticker</Text>
              <View style={styles.tickerInputRow}>
                <TextInput
                  style={[styles.input, styles.tickerInput]}
                  placeholder="AAPL"
                  value={ticker}
                  onChangeText={t => setTicker(t.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                {tickerLoading && <ActivityIndicator size="small" color="#8E8E93" style={styles.tickerSpinner} />}
              </View>
            </View>

            {/* Auto-fill preview */}
            {(companyLogoUrl || companyName) && (
              <View style={styles.tickerPreview}>
                {companyLogoUrl && (
                  <Image
                    source={{ uri: companyLogoUrl }}
                    style={styles.tickerLogo}
                    resizeMode="contain"
                  />
                )}
                <Text style={styles.tickerPreviewName} numberOfLines={1}>
                  {companyName}
                </Text>
                <Ionicons name="checkmark-circle" size={16} color="#34C759" />
              </View>
            )}

            <View style={styles.separator} />

            <View style={styles.fieldRow}>
              <Text style={styles.label}>Company</Text>
              <TextInput
                style={styles.input}
                placeholder="Optional"
                value={companyName}
                onChangeText={setCompanyName}
              />
            </View>
          </View>

          <Text style={styles.sectionHeader}>Direction</Text>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, tradeType === 'buy' && styles.toggleBtnBuy]}
                onPress={() => setTradeType('buy')}
              >
                <Text style={[styles.toggleText, tradeType === 'buy' && styles.toggleTextActive]}>
                  Long (Buy)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, tradeType === 'short' && styles.toggleBtnShort]}
                onPress={() => setTradeType('short')}
              >
                <Text style={[styles.toggleText, tradeType === 'short' && styles.toggleTextActive]}>
                  Short
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.sectionHeader}>Entry</Text>
          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <Text style={styles.label}>Entry Price</Text>
              <TextInput style={styles.input} placeholder="0.00" value={entryPrice} onChangeText={setEntryPrice} keyboardType="decimal-pad" />
            </View>
            <View style={styles.separator} />
            <View style={styles.fieldRow}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput style={styles.input} placeholder="0" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
            </View>
            <View style={styles.separator} />
            <View style={styles.fieldRow}>
              <Text style={styles.label}>Date</Text>
              <Text style={styles.staticValue}>
                {entryDate.toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionHeader}>Risk Management</Text>
          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <Text style={styles.label}>Stop Loss</Text>
              <TextInput style={styles.input} placeholder="Optional" value={stopLoss} onChangeText={setStopLoss} keyboardType="decimal-pad" />
            </View>
            <View style={styles.separator} />
            <View style={styles.fieldRow}>
              <Text style={styles.label}>Target Price</Text>
              <TextInput style={styles.input} placeholder="Optional" value={targetPrice} onChangeText={setTargetPrice} keyboardType="decimal-pad" />
            </View>
          </View>

          <Text style={styles.sectionHeader}>Strategy</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.fieldRow} onPress={() => setShowStrategyPicker(true)}>
              <Text style={styles.label}>Strategy</Text>
              <View style={styles.strategyValue}>
                <Text style={[styles.input, !selectedStrategy && styles.placeholder]} numberOfLines={1}>
                  {selectedStrategy?.name ?? 'Select strategy...'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionHeader}>Psychology</Text>
          <View style={styles.card}>
            <Text style={styles.sublabel}>Trade Grade (Optional)</Text>
            <View style={styles.chipRow}>
              {(['A', 'B', 'C', 'D'] as TradeGrade[]).map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.gradeBtn, tradeGrade === g && styles.gradeBtnActive]}
                  onPress={() => setTradeGrade(tradeGrade === g ? undefined : g)}
                >
                  <Text style={[styles.gradeText, tradeGrade === g && styles.gradeTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.separator} />
            <Text style={styles.sublabel}>Emotion (Optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emotionScroll}>
              {(Object.keys(EMOTION_LABELS) as EmotionTag[]).map(e => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emotionChip, emotionTag === e && styles.emotionChipActive]}
                  onPress={() => setEmotionTag(emotionTag === e ? undefined : e)}
                >
                  <Text style={[styles.emotionText, emotionTag === e && styles.emotionTextActive]}>
                    {EMOTION_LABELS[e]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <Text style={styles.sectionHeader}>Notes</Text>
          <View style={styles.card}>
            <TextInput
              style={styles.textarea}
              placeholder="Describe your setup, thesis, or key levels..."
              value={setupNotes}
              onChangeText={setSetupNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Add Trade</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <StrategyPickerModal
        visible={showStrategyPicker}
        strategies={strategies}
        selectedId={selectedStrategyId}
        onSelect={s => setSelectedStrategyId(s?.id)}
        onClose={() => setShowStrategyPicker(false)}
        onStrategiesChange={setStrategies}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
  sectionHeader: {
    fontSize: 13, fontWeight: '600', color: '#6D6D72',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 20, marginBottom: 8, marginLeft: 4,
  },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden' },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, minHeight: 48,
  },
  label: { fontSize: 16, color: '#1C1C1E', width: 110, flexShrink: 0 },
  input: { flex: 1, fontSize: 16, color: '#1C1C1E', textAlign: 'right' },
  placeholder: { color: '#C7C7CC' },
  staticValue: { flex: 1, fontSize: 16, color: '#8E8E93', textAlign: 'right' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E5EA', marginLeft: 16 },
  tickerInputRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  tickerInput: { flex: 1 },
  tickerSpinner: { marginLeft: 8 },
  tickerPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingBottom: 10,
  },
  tickerLogo: { width: 24, height: 24, borderRadius: 4, backgroundColor: '#F2F2F7' },
  tickerPreviewName: { flex: 1, fontSize: 13, color: '#6D6D72' },
  toggleRow: { flexDirection: 'row', padding: 8, gap: 8 },
  toggleBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    alignItems: 'center', backgroundColor: '#F2F2F7',
  },
  toggleBtnBuy: { backgroundColor: '#34C759' },
  toggleBtnShort: { backgroundColor: '#FF3B30' },
  toggleText: { fontSize: 15, fontWeight: '600', color: '#8E8E93' },
  toggleTextActive: { color: '#FFFFFF' },
  strategyValue: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
  },
  sublabel: {
    fontSize: 13, fontWeight: '500', color: '#6D6D72',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
  },
  chipRow: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  gradeBtn: {
    width: 48, height: 48, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F2F7',
  },
  gradeBtnActive: { backgroundColor: '#007AFF' },
  gradeText: { fontSize: 17, fontWeight: '700', color: '#8E8E93' },
  gradeTextActive: { color: '#FFFFFF' },
  emotionScroll: { paddingHorizontal: 12, paddingBottom: 12 },
  emotionChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    backgroundColor: '#F2F2F7', marginRight: 8,
  },
  emotionChipActive: { backgroundColor: '#5856D6' },
  emotionText: { fontSize: 14, fontWeight: '500', color: '#8E8E93' },
  emotionTextActive: { color: '#FFFFFF' },
  textarea: { padding: 16, fontSize: 15, color: '#1C1C1E', minHeight: 100 },
  submitBtn: {
    backgroundColor: '#007AFF', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 24,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
});
