import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Image,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getPosition,
  addEntry,
  closePosition,
  updatePosition,
  softDeletePosition,
  type PositionWithEntries,
} from '../../src/services/positionService';
import { db, schema } from '../../src/db';
import { formatPrice, formatPnl, fromStoredPrice } from '../../src/utils/price';
import { useTheme, type AppColors } from '../../src/theme';
import type { Strategy } from '../../src/db/schema';

const GRADE_COLORS: Record<string, string> = {
  A: '#34C759', B: '#007AFF', C: '#FF9500', D: '#FF3B30',
};
const EMOTION_LABELS: Record<string, string> = {
  confident: 'Confident', fomo: 'FOMO', hesitant: 'Hesitant',
  revenge: 'Revenge', bored: 'Bored', patient: 'Patient',
};

// ─── Add Entry Modal ─────────────────────────────────────────────────────────

type AddEntryModalProps = {
  visible: boolean;
  positionId: string;
  onDone: () => void;
  onClose: () => void;
};

function AddEntryModal({ visible, positionId, onDone, onClose }: AddEntryModalProps) {
  const { colors } = useTheme();
  const modalStyles = useMemo(() => makeModalStyles(colors), [colors]);
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');
  const [commission, setCommission] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setPrice(''); setQty(''); setCommission(''); setNotes(''); };

  const handleSave = async () => {
    if (!price || isNaN(parseFloat(price))) {
      Alert.alert('Required', 'Enter a valid entry price.');
      return;
    }
    if (!qty || isNaN(parseFloat(qty))) {
      Alert.alert('Required', 'Enter a valid quantity.');
      return;
    }
    setSaving(true);
    try {
      await addEntry(positionId, {
        entryPrice: parseFloat(price),
        quantity: parseFloat(qty),
        commission: commission ? parseFloat(commission) : undefined,
        notes: notes.trim() || undefined,
        entryDate: new Date(),
      });
      reset();
      onDone();
    } catch (e) {
      Alert.alert('Error', 'Could not add entry.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <SafeAreaView style={modalStyles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={modalStyles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Add Entry</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}>
              <Ionicons name="close-circle" size={28} color="#8E8E93" />
            </TouchableOpacity>
          </View>
          <ScrollView style={modalStyles.scroll} contentContainerStyle={modalStyles.scrollContent}>
            <View style={modalStyles.card}>
              <ModalField label="Entry Price *" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" />
              <ModalSep />
              <ModalField label="Quantity *" value={qty} onChangeText={setQty} keyboardType="decimal-pad" placeholder="0" />
              <ModalSep />
              <ModalField label="Commission" value={commission} onChangeText={setCommission} keyboardType="decimal-pad" placeholder="Optional" />
              <ModalSep />
              <ModalField label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" multiline />
            </View>
          </ScrollView>
          <View style={modalStyles.footer}>
            <TouchableOpacity style={[modalStyles.saveBtn, saving && modalStyles.disabled]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={modalStyles.saveBtnText}>Add Entry</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Close Position Modal ─────────────────────────────────────────────────────

type CloseModalProps = {
  visible: boolean;
  positionId: string;
  onDone: () => void;
  onClose: () => void;
};

function ClosePositionModal({ visible, positionId, onDone, onClose }: CloseModalProps) {
  const { colors } = useTheme();
  const modalStyles = useMemo(() => makeModalStyles(colors), [colors]);
  const [exitPrice, setExitPrice] = useState('');
  const [commission, setCommission] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setExitPrice(''); setCommission(''); };

  const handleClose = async () => {
    if (!exitPrice || isNaN(parseFloat(exitPrice))) {
      Alert.alert('Required', 'Enter a valid exit price.');
      return;
    }
    setSaving(true);
    try {
      await closePosition(
        positionId,
        parseFloat(exitPrice),
        new Date(),
        commission ? parseFloat(commission) : undefined,
      );
      reset();
      onDone();
    } catch (e) {
      Alert.alert('Error', 'Could not close position.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <SafeAreaView style={modalStyles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={modalStyles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Close Position</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}>
              <Ionicons name="close-circle" size={28} color="#8E8E93" />
            </TouchableOpacity>
          </View>
          <ScrollView style={modalStyles.scroll} contentContainerStyle={modalStyles.scrollContent}>
            <View style={modalStyles.card}>
              <ModalField label="Exit Price *" value={exitPrice} onChangeText={setExitPrice} keyboardType="decimal-pad" placeholder="0.00" />
              <ModalSep />
              <ModalField label="Commission" value={commission} onChangeText={setCommission} keyboardType="decimal-pad" placeholder="Optional" />
            </View>
            <Text style={modalStyles.hint}>
              Exit date will be recorded as now. Realized P&L will be calculated automatically.
            </Text>
          </ScrollView>
          <View style={modalStyles.footer}>
            <TouchableOpacity style={[modalStyles.closeBtn, saving && modalStyles.disabled]} onPress={handleClose} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={modalStyles.saveBtnText}>Close Trade</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

type EditModalProps = {
  visible: boolean;
  position: PositionWithEntries;
  onDone: () => void;
  onClose: () => void;
};

type TradeGrade = 'A' | 'B' | 'C' | 'D';
type EmotionTag = 'confident' | 'fomo' | 'hesitant' | 'revenge' | 'bored' | 'patient';

function EditModal({ visible, position, onDone, onClose }: EditModalProps) {
  const { colors } = useTheme();
  const modalStyles = useMemo(() => makeModalStyles(colors), [colors]);
  const [setupNotes, setSetupNotes] = useState(position.setupNotes ?? '');
  const [notes, setNotes] = useState(position.notes ?? '');
  const [grade, setGrade] = useState<TradeGrade | undefined>(position.tradeGrade ?? undefined);
  const [emotion, setEmotion] = useState<EmotionTag | undefined>(position.emotionTag ?? undefined);
  const [stopLoss, setStopLoss] = useState(
    position.stopLossPrice != null ? String(fromStoredPrice(position.stopLossPrice)) : ''
  );
  const [target, setTarget] = useState(
    position.targetPrice != null ? String(fromStoredPrice(position.targetPrice)) : ''
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePosition(position.id, {
        setupNotes: setupNotes.trim() || null,
        notes: notes.trim() || null,
        tradeGrade: grade ?? null,
        emotionTag: emotion ?? null,
        stopLossPrice: stopLoss ? parseFloat(stopLoss) : null,
        targetPrice: target ? parseFloat(target) : null,
      });
      onDone();
    } catch (e) {
      Alert.alert('Error', 'Could not save changes.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={modalStyles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={modalStyles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Edit Trade</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={28} color="#8E8E93" />
            </TouchableOpacity>
          </View>
          <ScrollView style={modalStyles.scroll} contentContainerStyle={modalStyles.scrollContent}>
            <Text style={modalStyles.sectionHeader}>Risk</Text>
            <View style={modalStyles.card}>
              {position.status === 'open' && (
                <>
                  <ModalField label="Stop Loss" value={stopLoss} onChangeText={setStopLoss} keyboardType="decimal-pad" placeholder="Optional" />
                  <ModalSep />
                </>
              )}
              <ModalField label="Target Price" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="Optional" />
            </View>

            <Text style={modalStyles.sectionHeader}>Grade</Text>
            <View style={modalStyles.card}>
              <View style={modalStyles.chipRow}>
                {(['A', 'B', 'C', 'D'] as TradeGrade[]).map(g => (
                  <TouchableOpacity
                    key={g}
                    style={[modalStyles.gradeBtn, grade === g && { backgroundColor: GRADE_COLORS[g] }]}
                    onPress={() => setGrade(grade === g ? undefined : g)}
                  >
                    <Text style={[modalStyles.gradeText, grade === g && modalStyles.gradeTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={modalStyles.sectionHeader}>Emotion</Text>
            <View style={modalStyles.card}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={modalStyles.emotionScroll}>
                {(Object.keys(EMOTION_LABELS) as EmotionTag[]).map(e => (
                  <TouchableOpacity
                    key={e}
                    style={[modalStyles.emotionChip, emotion === e && modalStyles.emotionChipActive]}
                    onPress={() => setEmotion(emotion === e ? undefined : e)}
                  >
                    <Text style={[modalStyles.emotionText, emotion === e && modalStyles.emotionTextActive]}>
                      {EMOTION_LABELS[e]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Text style={modalStyles.sectionHeader}>Setup Notes</Text>
            <View style={modalStyles.card}>
              <TextInput
                style={modalStyles.textarea}
                placeholder="Pre-trade thesis and setup..."
                value={setupNotes}
                onChangeText={setSetupNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <Text style={modalStyles.sectionHeader}>Review Notes</Text>
            <View style={modalStyles.card}>
              <TextInput
                style={modalStyles.textarea}
                placeholder="Post-trade review, lessons learned..."
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
          <View style={modalStyles.footer}>
            <TouchableOpacity style={[modalStyles.saveBtn, saving && modalStyles.disabled]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={modalStyles.saveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Shared Modal Helpers ─────────────────────────────────────────────────────

function ModalField({
  label, value, onChangeText, keyboardType, placeholder, multiline,
}: {
  label: string; value: string; onChangeText: (t: string) => void;
  keyboardType?: 'default' | 'decimal-pad'; placeholder?: string; multiline?: boolean;
}) {
  const { colors } = useTheme();
  const modalStyles = useMemo(() => makeModalStyles(colors), [colors]);
  return (
    <View style={multiline ? modalStyles.fieldMulti : modalStyles.field}>
      <Text style={modalStyles.fieldLabel}>{label}</Text>
      <TextInput
        style={multiline ? [modalStyles.fieldInput, modalStyles.fieldInputMulti] : modalStyles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'auto'}
      />
    </View>
  );
}

function ModalSep() {
  const { colors } = useTheme();
  const modalStyles = useMemo(() => makeModalStyles(colors), [colors]);
  return <View style={modalStyles.sep} />;
}

// ─── Main Detail Screen ───────────────────────────────────────────────────────

export default function PositionDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [position, setPosition] = useState<PositionWithEntries | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const pos = await getPosition(id);
      if (pos) {
        setPosition(pos);
        if (pos.strategyId) {
          const strats = await db.select().from(schema.strategies);
          const found = strats.find(s => s.id === pos.strategyId);
          setStrategy(found ?? null);
        } else {
          setStrategy(null);
        }
      }
    } catch (e) {
      console.error('Failed to load position:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handlePickScreenshot = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library to attach a chart screenshot.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    try {
      await updatePosition(position!.id, { chartScreenshotUrl: uri });
      load();
    } catch (e) {
      Alert.alert('Error', 'Could not save screenshot.');
    }
  };

  const handleRemoveScreenshot = () => {
    Alert.alert('Remove Screenshot', 'Remove the attached chart screenshot?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await updatePosition(position!.id, { chartScreenshotUrl: null });
          load();
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Trade',
      'This will permanently remove this trade. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            await softDeletePosition(id);
            router.back();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingCenter}><ActivityIndicator size="large" color="#007AFF" /></View>
      </SafeAreaView>
    );
  }

  if (!position) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingCenter}><Text style={styles.notFound}>Trade not found.</Text></View>
      </SafeAreaView>
    );
  }

  const isOpen = position.status === 'open';
  const pnl = position.realizedPnl;
  const pnlValue = pnl != null ? fromStoredPrice(pnl) : null;
  const avgEntry = position.avgEntryPrice;
  const exitPrice = position.exitPrice;

  const sortedEntries = [...position.entries].sort(
    (a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.navHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
          <Text style={styles.backText}>Trades</Text>
        </TouchableOpacity>
        <View style={styles.navActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowEdit(true)}>
            <Ionicons name="create-outline" size={22} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={22} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Hero Card */}
        <View style={styles.heroCard}>
          {/* Top accent stripe — green/red/orange based on status */}
          <View style={[
            styles.heroAccent,
            isOpen ? styles.heroAccentOpen
              : pnlValue != null && pnlValue >= 0 ? styles.heroAccentProfit : styles.heroAccentLoss,
          ]} />
          <View style={styles.heroTop}>
            <View style={styles.heroLeft}>
              {position.companyLogoUrl ? (
                <Image
                  source={{ uri: position.companyLogoUrl }}
                  style={styles.logo}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.logoPlaceholder, isOpen ? styles.logoBuy : styles.logoShort]}>
                  <Text style={styles.logoPlaceholderText}>{position.ticker.slice(0, 2)}</Text>
                </View>
              )}
              <View>
                <Text style={styles.heroTicker}>{position.ticker}</Text>
                {position.companyName && (
                  <Text style={styles.heroCompany}>{position.companyName}</Text>
                )}
              </View>
            </View>
            <View style={styles.heroBadges}>
              <View style={[styles.badge, position.tradeType === 'short' && styles.badgeShort]}>
                <Text style={styles.badgeText}>{position.tradeType === 'buy' ? 'LONG' : 'SHORT'}</Text>
              </View>
              <View style={[styles.statusBadge, isOpen ? styles.statusOpen : styles.statusClosed]}>
                <Text style={styles.statusText}>{isOpen ? 'OPEN' : 'CLOSED'}</Text>
              </View>
            </View>
          </View>

          {/* P&L */}
          <View style={styles.pnlRow}>
            {isOpen ? (
              <View style={styles.pnlBlock}>
                <Text style={styles.pnlLabel}>Status</Text>
                <Text style={styles.pnlOpenValue}>Unrealized</Text>
              </View>
            ) : pnl != null ? (
              <View style={styles.pnlBlock}>
                <Text style={styles.pnlLabel}>Realized P&L</Text>
                <Text style={[styles.pnlValue, pnlValue! >= 0 ? styles.pnlPos : styles.pnlNeg]}>
                  {formatPnl(pnl)}
                </Text>
              </View>
            ) : null}
            {avgEntry != null && (
              <View style={styles.pnlBlock}>
                <Text style={styles.pnlLabel}>Avg Entry</Text>
                <Text style={styles.pnlNeutral}>{formatPrice(avgEntry)}</Text>
              </View>
            )}
            {exitPrice != null && (
              <View style={styles.pnlBlock}>
                <Text style={styles.pnlLabel}>Exit Price</Text>
                <Text style={styles.pnlNeutral}>{formatPrice(exitPrice)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Position Details */}
        <Text style={styles.sectionHeader}>Details</Text>
        <View style={styles.card}>
          <DetailRow label="Quantity" value={position.totalQuantity != null ? String(position.totalQuantity) : '—'} />
          <DetailSep />
          <DetailRow label="Strategy" value={strategy?.name ?? '—'} />
          <DetailSep />
          {position.stopLossPrice != null && (
            <>
              <DetailRow label="Stop Loss" value={formatPrice(position.stopLossPrice)} valueColor="#FF3B30" />
              <DetailSep />
            </>
          )}
          {position.targetPrice != null && (
            <>
              <DetailRow label="Target" value={formatPrice(position.targetPrice)} valueColor="#34C759" />
              <DetailSep />
            </>
          )}
          {position.tradeGrade && (
            <>
              <DetailRow
                label="Grade"
                value={position.tradeGrade}
                valueColor={GRADE_COLORS[position.tradeGrade]}
              />
              <DetailSep />
            </>
          )}
          {position.emotionTag && (
            <>
              <DetailRow label="Emotion" value={EMOTION_LABELS[position.emotionTag] ?? position.emotionTag} />
              <DetailSep />
            </>
          )}
          <DetailRow
            label="Opened"
            value={new Date(position.createdAt).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          />
          {position.exitDate && (
            <>
              <DetailSep />
              <DetailRow
                label="Closed"
                value={new Date(position.exitDate).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              />
            </>
          )}
        </View>

        {/* Entries */}
        <Text style={styles.sectionHeader}>
          Entries ({sortedEntries.length})
        </Text>
        <View style={styles.card}>
          {sortedEntries.map((entry, idx) => (
            <View key={entry.id}>
              {idx > 0 && <View style={styles.sep} />}
              <View style={styles.entryRow}>
                <View style={styles.entryIndex}>
                  <Text style={styles.entryIndexText}>{idx + 1}</Text>
                </View>
                <View style={styles.entryInfo}>
                  <Text style={styles.entryPrice}>{formatPrice(entry.entryPrice)}</Text>
                  <Text style={styles.entrySub}>
                    {entry.quantity} shares ·{' '}
                    {new Date(entry.entryDate).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric',
                    })}
                  </Text>
                  {entry.notes ? <Text style={styles.entryNote}>{entry.notes}</Text> : null}
                </View>
                {entry.commission != null && (
                  <Text style={styles.entryCommission}>
                    -{formatPrice(entry.commission)} comm.
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Notes */}
        {(position.setupNotes || position.notes) && (
          <>
            <Text style={styles.sectionHeader}>Notes</Text>
            <View style={styles.card}>
              {position.setupNotes && (
                <>
                  <View style={styles.notesSection}>
                    <Text style={styles.notesLabel}>Setup</Text>
                    <Text style={styles.notesText}>{position.setupNotes}</Text>
                  </View>
                  {position.notes && <View style={styles.sep} />}
                </>
              )}
              {position.notes && (
                <View style={styles.notesSection}>
                  <Text style={styles.notesLabel}>Review</Text>
                  <Text style={styles.notesText}>{position.notes}</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Chart Screenshot */}
        <Text style={styles.sectionHeader}>Chart Screenshot</Text>
        {position.chartScreenshotUrl ? (
          <View style={styles.screenshotCard}>
            <Image
              source={{ uri: position.chartScreenshotUrl }}
              style={styles.screenshotImage}
              resizeMode="contain"
            />
            <View style={styles.screenshotActions}>
              <TouchableOpacity style={styles.screenshotReplaceBtn} onPress={handlePickScreenshot}>
                <Ionicons name="refresh-outline" size={15} color={colors.primary} />
                <Text style={styles.screenshotReplaceText}>Replace</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.screenshotRemoveBtn} onPress={handleRemoveScreenshot}>
                <Ionicons name="trash-outline" size={15} color={colors.loss} />
                <Text style={styles.screenshotRemoveText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.screenshotAddBtn} onPress={handlePickScreenshot}>
            <Ionicons name="image-outline" size={22} color={colors.primary} />
            <Text style={styles.screenshotAddText}>Attach Chart Screenshot</Text>
          </TouchableOpacity>
        )}

        {/* Actions */}
        {isOpen && (
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.addEntryBtn} onPress={() => setShowAddEntry(true)}>
              <Ionicons name="add" size={18} color="#007AFF" />
              <Text style={styles.addEntryText}>Add Entry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closePositionBtn} onPress={() => setShowClose(true)}>
              <Ionicons name="flag" size={18} color="#FFFFFF" />
              <Text style={styles.closePositionText}>Close Position</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Modals */}
      <AddEntryModal
        visible={showAddEntry}
        positionId={position.id}
        onDone={() => { setShowAddEntry(false); load(); }}
        onClose={() => setShowAddEntry(false)}
      />
      <ClosePositionModal
        visible={showClose}
        positionId={position.id}
        onDone={() => { setShowClose(false); load(); }}
        onClose={() => setShowClose(false)}
      />
      {showEdit && (
        <EditModal
          visible={showEdit}
          position={position}
          onDone={() => { setShowEdit(false); load(); }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Shared Row Helpers ───────────────────────────────────────────────────────

function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
    </View>
  );
}

function DetailSep() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={styles.sep} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    notFound: { fontSize: 16, color: c.textSecondary },
    navHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingVertical: 10,
      backgroundColor: c.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      minHeight: 52,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', padding: 8 },
    backText: { fontSize: 17, color: c.primary },
    navActions: { flexDirection: 'row', gap: 4 },
    iconBtn: { padding: 8 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
    heroCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      paddingTop: 0,
      paddingHorizontal: 16,
      paddingBottom: 16,
      marginTop: 16,
      gap: 16,
      overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
    },
    heroAccent: { height: 5, marginHorizontal: -16, marginBottom: 0 },
    heroAccentOpen: { backgroundColor: c.open },
    heroAccentProfit: { backgroundColor: c.profit },
    heroAccentLoss: { backgroundColor: c.loss },
    heroTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    heroLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    logo: { width: 44, height: 44, borderRadius: 10, backgroundColor: c.surfaceHigh },
    logoPlaceholder: {
      width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    },
    logoBuy: { backgroundColor: c.primary },
    logoShort: { backgroundColor: c.loss },
    logoPlaceholderText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
    heroTicker: { fontSize: 22, fontWeight: '800', color: c.textPrimary },
    heroCompany: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
    heroBadges: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' },
    badge: { backgroundColor: c.longBadgeBg, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
    badgeShort: { backgroundColor: c.shortBadgeBg },
    badgeText: { fontSize: 11, fontWeight: '700', color: c.primary },
    statusBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
    statusOpen: { backgroundColor: c.openBadgeBg },
    statusClosed: { backgroundColor: c.closedBadgeBg },
    statusText: { fontSize: 11, fontWeight: '700', color: c.open },
    pnlRow: { flexDirection: 'row', gap: 16 },
    pnlBlock: { flex: 1 },
    pnlLabel: { fontSize: 10, color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0, marginBottom: 4 },
    pnlValue: { fontSize: 17, fontWeight: '800' },
    pnlPos: { color: c.profit },
    pnlNeg: { color: c.loss },
    pnlNeutral: { fontSize: 17, fontWeight: '600', color: c.textPrimary },
    pnlOpenValue: { fontSize: 17, fontWeight: '600', color: c.open },
    sectionHeader: {
      fontSize: 13, fontWeight: '600', color: c.sectionHeader,
      textTransform: 'uppercase', letterSpacing: 0.5,
      marginTop: 20, marginBottom: 8, marginLeft: 4,
    },
    card: { backgroundColor: c.surface, borderRadius: 12, overflow: 'hidden' },
    sep: { height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: 16 },
    detailRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 12,
    },
    detailLabel: { fontSize: 15, color: c.textSecondary },
    detailValue: { fontSize: 15, fontWeight: '500', color: c.textPrimary },
    entryRow: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12,
    },
    entryIndex: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: c.surfaceHigh, alignItems: 'center', justifyContent: 'center',
    },
    entryIndexText: { fontSize: 13, fontWeight: '700', color: c.sectionHeader },
    entryInfo: { flex: 1 },
    entryPrice: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
    entrySub: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    entryNote: { fontSize: 12, color: c.sectionHeader, marginTop: 3, fontStyle: 'italic' },
    entryCommission: { fontSize: 12, color: c.open },
    notesSection: { padding: 16 },
    notesLabel: { fontSize: 12, fontWeight: '600', color: c.textSecondary, textTransform: 'uppercase', marginBottom: 6 },
    notesText: { fontSize: 15, color: c.textPrimary, lineHeight: 22 },
    screenshotCard: {
      backgroundColor: c.surface, borderRadius: 12, overflow: 'hidden', marginBottom: 0,
    },
    screenshotImage: {
      width: '100%', height: 220, backgroundColor: c.surfaceHigh,
    },
    screenshotActions: {
      flexDirection: 'row', gap: 0,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator,
    },
    screenshotReplaceBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 12,
      borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: c.separator,
    },
    screenshotReplaceText: { fontSize: 14, fontWeight: '600', color: c.primary },
    screenshotRemoveBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 12,
    },
    screenshotRemoveText: { fontSize: 14, fontWeight: '600', color: c.loss },
    screenshotAddBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      backgroundColor: c.surface, borderRadius: 12, paddingVertical: 18,
      borderWidth: 1, borderColor: c.primary, borderStyle: 'dashed',
    },
    screenshotAddText: { fontSize: 15, fontWeight: '600', color: c.primary },
    actionsRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
    addEntryBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 14, borderRadius: 12,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.primary,
    },
    addEntryText: { fontSize: 16, fontWeight: '600', color: c.primary },
    closePositionBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 14, borderRadius: 12, backgroundColor: c.loss,
    },
    closePositionText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  });
}

function makeModalStyles(c: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: c.surface,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    title: { fontSize: 17, fontWeight: '600', color: c.textPrimary },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 8 },
    card: { backgroundColor: c.surface, borderRadius: 12, overflow: 'hidden', marginBottom: 8 },
    sep: { height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: 16 },
    field: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    fieldMulti: { paddingHorizontal: 16, paddingVertical: 12 },
    fieldLabel: { width: 120, fontSize: 15, color: c.textPrimary },
    fieldInput: { flex: 1, fontSize: 15, color: c.textPrimary, textAlign: 'right' },
    fieldInputMulti: { textAlign: 'left', minHeight: 60, marginTop: 6 },
    hint: { fontSize: 13, color: c.textSecondary, paddingHorizontal: 4, lineHeight: 18 },
    sectionHeader: {
      fontSize: 13, fontWeight: '600', color: c.sectionHeader,
      textTransform: 'uppercase', letterSpacing: 0.5,
      marginTop: 16, marginBottom: 8, marginLeft: 4,
    },
    chipRow: { flexDirection: 'row', padding: 12, gap: 8 },
    gradeBtn: {
      width: 52, height: 44, borderRadius: 8,
      alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceHigh,
    },
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
    footer: { padding: 16 },
    saveBtn: {
      backgroundColor: c.primary, borderRadius: 12,
      paddingVertical: 16, alignItems: 'center',
    },
    closeBtn: {
      backgroundColor: c.loss, borderRadius: 12,
      paddingVertical: 16, alignItems: 'center',
    },
    saveBtnText: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
    disabled: { opacity: 0.6 },
  });
}
