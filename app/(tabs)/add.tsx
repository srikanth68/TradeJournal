import { useState, useEffect, useRef, useMemo } from 'react';
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
  Modal,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useTheme, type AppColors } from '../../src/theme';
import { db, schema } from '../../src/db';
import { createPosition } from '../../src/services/positionService';
import { lookupTicker } from '../../src/services/tickerService';
import { StrategyPickerModal } from '../../src/components/StrategyPickerModal';
import type { Strategy } from '../../src/db/schema';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const RISK_PRESETS = [0.5, 1, 2, 3];

type TradeType = 'buy' | 'short';
type TradeGrade = 'A' | 'B' | 'C' | 'D';
type EmotionTag = 'confident' | 'fomo' | 'hesitant' | 'revenge' | 'bored' | 'patient';

const EMOTION_LABELS: Record<EmotionTag, string> = {
  confident: 'Confident', fomo: 'FOMO', hesitant: 'Hesitant',
  revenge: 'Revenge', bored: 'Bored', patient: 'Patient',
};

export default function AddTradeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [ticker, setTicker] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [tickerLoading, setTickerLoading] = useState(false);
  const [tradeType, setTradeType] = useState<TradeType>('buy');
  const [entryPrice, setEntryPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [entryDate, setEntryDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | undefined>();
  const [showStrategyPicker, setShowStrategyPicker] = useState(false);
  const [setupNotes, setSetupNotes] = useState('');
  const [tradeGrade, setTradeGrade] = useState<TradeGrade | undefined>();
  const [emotionTag, setEmotionTag] = useState<EmotionTag | undefined>();
  const [stopLoss, setStopLoss] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Risk Calculator ──
  const [showRiskCalc, setShowRiskCalc] = useState(false);
  const [accountEquity, setAccountEquity] = useState('');
  const [riskPct, setRiskPct] = useState(1);

  const riskCalc = useMemo(() => {
    const equity = parseFloat(accountEquity);
    const entry = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);
    if (!equity || equity <= 0 || !entry || entry <= 0) return null;
    const maxRiskDollars = equity * (riskPct / 100);
    const slDistance = sl > 0 ? Math.abs(entry - sl) : null;
    const suggestedShares = slDistance && slDistance > 0 ? maxRiskDollars / slDistance : null;
    const positionSize = suggestedShares ? suggestedShares * entry : null;
    const rr = sl > 0 && parseFloat(targetPrice) > 0
      ? Math.abs(parseFloat(targetPrice) - entry) / Math.abs(entry - sl)
      : null;
    return { maxRiskDollars, suggestedShares, positionSize, rr };
  }, [accountEquity, riskPct, entryPrice, stopLoss, targetPrice]);

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
                  placeholderTextColor={colors.textTertiary}
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
                placeholderTextColor={colors.textTertiary}
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
              <TextInput style={styles.input} placeholder="0.00" placeholderTextColor={colors.textTertiary} value={entryPrice} onChangeText={setEntryPrice} keyboardType="decimal-pad" />
            </View>
            <View style={styles.separator} />
            <View style={styles.fieldRow}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput style={styles.input} placeholder="0" placeholderTextColor={colors.textTertiary} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
            </View>
            <View style={styles.separator} />
            <TouchableOpacity
              style={styles.fieldRow}
              onPress={() => { setTempDate(entryDate); setShowDatePicker(true); }}
            >
              <Text style={styles.label}>Date</Text>
              <View style={styles.dateValueRow}>
                <Text style={styles.dateValue}>
                  {entryDate.toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </Text>
                <Text style={styles.dateValueTime}>
                  {entryDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionHeader}>Risk Management</Text>
          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <Text style={styles.label}>Stop Loss</Text>
              <TextInput style={styles.input} placeholder="Optional" placeholderTextColor={colors.textTertiary} value={stopLoss} onChangeText={setStopLoss} keyboardType="decimal-pad" />
            </View>
            <View style={styles.separator} />
            <View style={styles.fieldRow}>
              <Text style={styles.label}>Target Price</Text>
              <TextInput style={styles.input} placeholder="Optional" placeholderTextColor={colors.textTertiary} value={targetPrice} onChangeText={setTargetPrice} keyboardType="decimal-pad" />
            </View>
          </View>

          {/* ── Risk Calculator ── */}
          <TouchableOpacity
            style={styles.calcToggle}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setShowRiskCalc(v => !v);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.calcToggleIcon, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="calculator-outline" size={17} color={colors.primary} />
            </View>
            <Text style={[styles.calcToggleLabel, { color: colors.textPrimary }]}>Position Size Calculator</Text>
            <Ionicons name={showRiskCalc ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          {showRiskCalc && (
            <View style={[styles.card, styles.calcCard]}>
              {/* Account equity */}
              <View style={styles.fieldRow}>
                <Text style={styles.label}>Account Size</Text>
                <View style={styles.calcInputRow}>
                  <Text style={[styles.calcCurrency, { color: colors.textSecondary }]}>$</Text>
                  <TextInput
                    style={[styles.input, styles.calcInput]}
                    placeholder="50,000"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                    value={accountEquity}
                    onChangeText={setAccountEquity}
                  />
                </View>
              </View>
              <View style={styles.separator} />

              {/* Risk % presets */}
              <View style={[styles.fieldRow, { alignItems: 'flex-start', flexDirection: 'column', gap: 8 }]}>
                <Text style={[styles.sublabel, { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }]}>Max Risk per Trade</Text>
                <View style={styles.riskPresetRow}>
                  {RISK_PRESETS.map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.riskPresetBtn, riskPct === p && { backgroundColor: colors.primary }]}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRiskPct(p); }}
                    >
                      <Text style={[styles.riskPresetText, { color: riskPct === p ? '#fff' : colors.textSecondary }]}>
                        {p}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Results */}
              {riskCalc ? (
                <View style={[styles.calcResults, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
                  <View style={styles.calcRow}>
                    <Text style={[styles.calcKey, { color: colors.textSecondary }]}>Max $ at risk</Text>
                    <Text style={[styles.calcVal, { color: colors.loss }]}>
                      ${riskCalc.maxRiskDollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                  {riskCalc.suggestedShares != null && (
                    <View style={styles.calcRow}>
                      <Text style={[styles.calcKey, { color: colors.textSecondary }]}>Suggested shares</Text>
                      <Text style={[styles.calcVal, { color: colors.textPrimary }]}>
                        {riskCalc.suggestedShares.toFixed(1)}
                        <Text style={{ color: colors.textTertiary, fontSize: 12 }}> shares</Text>
                      </Text>
                    </View>
                  )}
                  {riskCalc.positionSize != null && (
                    <View style={styles.calcRow}>
                      <Text style={[styles.calcKey, { color: colors.textSecondary }]}>Position size</Text>
                      <Text style={[styles.calcVal, { color: colors.textPrimary }]}>
                        ${riskCalc.positionSize.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </Text>
                    </View>
                  )}
                  {riskCalc.rr != null && (
                    <View style={[styles.calcRow, { borderBottomWidth: 0 }]}>
                      <Text style={[styles.calcKey, { color: colors.textSecondary }]}>Risk / Reward</Text>
                      <Text style={[styles.calcVal, { color: riskCalc.rr >= 2 ? colors.profit : riskCalc.rr >= 1 ? colors.open : colors.loss }]}>
                        1 : {riskCalc.rr.toFixed(2)}
                      </Text>
                    </View>
                  )}
                  {riskCalc.suggestedShares != null && (
                    <TouchableOpacity
                      style={[styles.applyBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '40' }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setQuantity(riskCalc.suggestedShares!.toFixed(1));
                      }}
                    >
                      <Ionicons name="arrow-up-circle-outline" size={16} color={colors.primary} />
                      <Text style={[styles.applyBtnText, { color: colors.primary }]}>Apply to Quantity</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <Text style={[styles.calcHint, { color: colors.textTertiary }]}>
                  Enter account size, entry price, and stop loss to calculate position sizing.
                </Text>
              )}
            </View>
          )}

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
              placeholderTextColor={colors.textTertiary}
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

      {/* Date Picker — iOS modal sheet, Android native */}
      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker
          value={entryDate}
          mode="datetime"
          display="default"
          onChange={(_: DateTimePickerEvent, date?: Date) => {
            setShowDatePicker(false);
            if (date) setEntryDate(date);
          }}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.dateModalOverlay}>
            <View style={styles.dateModalSheet}>
              <View style={styles.dateModalHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.dateModalCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.dateModalTitle}>Entry Date & Time</Text>
                <TouchableOpacity onPress={() => { setEntryDate(tempDate); setShowDatePicker(false); }}>
                  <Text style={styles.dateModalDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="datetime"
                display="spinner"
                onChange={(_: DateTimePickerEvent, date?: Date) => {
                  if (date) setTempDate(date);
                }}
                style={styles.datePickerSpinner}
                textColor={colors.textPrimary}
              />
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1, backgroundColor: c.background },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
    sectionHeader: {
      fontSize: 13, fontWeight: '600', color: c.sectionHeader,
      textTransform: 'uppercase', letterSpacing: 0.5,
      marginTop: 20, marginBottom: 8, marginLeft: 4,
    },
    card: { backgroundColor: c.surface, borderRadius: 12, overflow: 'hidden' },
    fieldRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 12, minHeight: 48,
    },
    label: { fontSize: 16, color: c.textPrimary, width: 110, flexShrink: 0 },
    input: { flex: 1, fontSize: 16, color: c.textPrimary, textAlign: 'right' },
    placeholder: { color: c.textTertiary },
    staticValue: { flex: 1, fontSize: 16, color: c.textSecondary, textAlign: 'right' },
    dateValueRow: {
      flex: 1, flexDirection: 'row', alignItems: 'center',
      justifyContent: 'flex-end', gap: 6,
    },
    dateValue: { fontSize: 16, color: c.textPrimary },
    dateValueTime: { fontSize: 16, color: c.textSecondary },
    dateModalOverlay: {
      flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay,
    },
    dateModalSheet: {
      backgroundColor: c.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16,
      paddingBottom: 32,
    },
    dateModalHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.separator,
    },
    dateModalTitle: { fontSize: 16, fontWeight: '600', color: c.textPrimary },
    dateModalCancel: { fontSize: 16, color: c.textSecondary },
    dateModalDone: { fontSize: 16, fontWeight: '600', color: c.primary },
    datePickerSpinner: { height: 220 },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: 16 },
    tickerInputRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
    tickerInput: { flex: 1 },
    tickerSpinner: { marginLeft: 8 },
    tickerPreview: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 16, paddingBottom: 10,
    },
    tickerLogo: { width: 24, height: 24, borderRadius: 4, backgroundColor: c.surfaceHigh },
    tickerPreviewName: { flex: 1, fontSize: 13, color: c.sectionHeader },
    toggleRow: { flexDirection: 'row', padding: 8, gap: 8 },
    toggleBtn: {
      flex: 1, paddingVertical: 10, borderRadius: 8,
      alignItems: 'center', backgroundColor: c.surfaceHigh,
    },
    toggleBtnBuy: { backgroundColor: c.profit },
    toggleBtnShort: { backgroundColor: c.loss },
    toggleText: { fontSize: 15, fontWeight: '600', color: c.textSecondary },
    toggleTextActive: { color: '#FFFFFF' },
    strategyValue: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
    },
    sublabel: {
      fontSize: 13, fontWeight: '500', color: c.sectionHeader,
      paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
    },
    chipRow: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
    gradeBtn: {
      width: 48, height: 48, borderRadius: 8,
      alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceHigh,
    },
    gradeBtnActive: { backgroundColor: c.primary },
    gradeText: { fontSize: 17, fontWeight: '700', color: c.textSecondary },
    gradeTextActive: { color: '#FFFFFF' },
    emotionScroll: { paddingHorizontal: 12, paddingBottom: 12 },
    emotionChip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
      backgroundColor: c.surfaceHigh, marginRight: 8,
    },
    emotionChipActive: { backgroundColor: c.purple },
    emotionText: { fontSize: 14, fontWeight: '500', color: c.textSecondary },
    emotionTextActive: { color: '#FFFFFF' },
    textarea: { padding: 16, fontSize: 15, color: c.textPrimary, minHeight: 100 },
    submitBtn: {
      backgroundColor: c.primary, borderRadius: 12,
      paddingVertical: 16, alignItems: 'center', marginTop: 24,
    },
    submitBtnDisabled: { opacity: 0.6 },
    submitText: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },

    // ── Risk Calculator ──
    calcToggle: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 10, paddingHorizontal: 4, marginTop: 16,
    },
    calcToggleIcon: {
      width: 30, height: 30, borderRadius: 8,
      alignItems: 'center', justifyContent: 'center',
    },
    calcToggleLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
    calcCard: { padding: 0, marginTop: 0 },
    calcInputRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
    calcCurrency: { fontSize: 16, fontWeight: '500' },
    calcInput: { textAlign: 'right' },
    riskPresetRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
    riskPresetBtn: {
      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
      backgroundColor: c.surfaceHigh,
    },
    riskPresetText: { fontSize: 14, fontWeight: '600' },
    calcResults: {
      margin: 12, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
    },
    calcRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 14, paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    calcKey: { fontSize: 13, fontWeight: '500' },
    calcVal: { fontSize: 14, fontWeight: '700' },
    applyBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 10, margin: 10, borderRadius: 8, borderWidth: 1,
    },
    applyBtnText: { fontSize: 14, fontWeight: '600' },
    calcHint: { fontSize: 13, textAlign: 'center', padding: 16, lineHeight: 19 },
  });
}
