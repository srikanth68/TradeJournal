import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, type AppColors } from '../../src/theme';
import {
  getJournalEntries,
  getJournalEntry,
  upsertJournalEntry,
  deleteJournalEntry,
  type DailyJournal,
} from '../../src/services/journalService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatShortDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function entrySnippet(entry: DailyJournal): string {
  return entry.marketNotes?.trim() || entry.mindsetNotes?.trim() || entry.lessons?.trim() || 'Tap to view entry';
}

// ─── Entry Editor Modal ───────────────────────────────────────────────────────

type EditorProps = {
  visible: boolean;
  date: string;
  initial: DailyJournal | null;
  onSave: () => void;
  onClose: () => void;
};

function EntryEditorModal({ visible, date, initial, onSave, onClose }: EditorProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [marketNotes, setMarketNotes] = useState(initial?.marketNotes ?? '');
  const [mindsetNotes, setMindsetNotes] = useState(initial?.mindsetNotes ?? '');
  const [lessons, setLessons] = useState(initial?.lessons ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isNew = initial === null;

  const handleSave = async () => {
    if (!marketNotes.trim() && !mindsetNotes.trim() && !lessons.trim()) {
      Alert.alert('Empty Entry', 'Write something before saving.');
      return;
    }
    setSaving(true);
    try {
      await upsertJournalEntry(date, {
        marketNotes: marketNotes.trim() || undefined,
        mindsetNotes: mindsetNotes.trim() || undefined,
        lessons: lessons.trim() || undefined,
      });
      onSave();
    } catch (e) {
      Alert.alert('Error', 'Could not save journal entry.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!initial) return;
    Alert.alert('Delete Entry', 'Remove this journal entry permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          await deleteJournalEntry(initial.id);
          setDeleting(false);
          onSave();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.modalHeaderBtn}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {formatShortDate(date)}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.modalHeaderBtn}>
              {saving
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Text style={styles.modalSaveText}>Save</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.fieldLabel}>Market Conditions</Text>
            <View style={styles.textAreaCard}>
              <TextInput
                style={styles.textArea}
                placeholder="How did the market open? Any major events, news, or conditions worth noting?"
                placeholderTextColor={colors.textTertiary}
                value={marketNotes}
                onChangeText={setMarketNotes}
                multiline
                textAlignVertical="top"
              />
            </View>

            <Text style={styles.fieldLabel}>Mindset & Emotions</Text>
            <View style={styles.textAreaCard}>
              <TextInput
                style={styles.textArea}
                placeholder="How were you feeling today? Focused, distracted, anxious, confident?"
                placeholderTextColor={colors.textTertiary}
                value={mindsetNotes}
                onChangeText={setMindsetNotes}
                multiline
                textAlignVertical="top"
              />
            </View>

            <Text style={styles.fieldLabel}>Lessons Learned</Text>
            <View style={styles.textAreaCard}>
              <TextInput
                style={styles.textArea}
                placeholder="What worked? What didn't? What would you do differently tomorrow?"
                placeholderTextColor={colors.textTertiary}
                value={lessons}
                onChangeText={setLessons}
                multiline
                textAlignVertical="top"
              />
            </View>

            {!isNew && (
              <TouchableOpacity
                style={styles.deleteEntryBtn}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting
                  ? <ActivityIndicator size="small" color={colors.loss} />
                  : <Text style={styles.deleteEntryText}>Delete Entry</Text>}
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Today Card ───────────────────────────────────────────────────────────────

function TodayCard({
  today, entry, onPress,
}: { today: string; entry: DailyJournal | null; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const filled = entry !== null;

  return (
    <TouchableOpacity
      style={styles.todayCard}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      activeOpacity={0.75}
    >
      <View style={[styles.todayAccent, { backgroundColor: filled ? colors.primary : colors.border }]} />
      <View style={styles.todayInner}>
        <View style={styles.todayTop}>
          <View>
            <Text style={[styles.todayLabel, { color: colors.textTertiary }]}>Today</Text>
            <Text style={[styles.todayDate, { color: colors.textPrimary }]}>{formatShortDate(today)}</Text>
          </View>
          <View style={[styles.todayStatusBadge, { backgroundColor: filled ? colors.primary + '18' : colors.surfaceHigh }]}>
            <Ionicons
              name={filled ? 'checkmark-circle' : 'pencil-outline'}
              size={14}
              color={filled ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.todayStatusText, { color: filled ? colors.primary : colors.textSecondary }]}>
              {filled ? 'Logged' : 'Write entry'}
            </Text>
          </View>
        </View>
        {filled && (
          <Text style={[styles.todaySnippet, { color: colors.textSecondary }]} numberOfLines={2}>
            {entrySnippet(entry)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Entry Row ────────────────────────────────────────────────────────────────

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  Market:  { bg: '#EAF4FF', text: '#007AFF' },
  Mindset: { bg: '#F3EEFF', text: '#5856D6' },
  Lessons: { bg: '#E6FAF0', text: '#00B057' },
};

function EntryRow({ entry, onPress }: { entry: DailyJournal; onPress: () => void }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const badges = [
    entry.marketNotes?.trim() ? 'Market' : null,
    entry.mindsetNotes?.trim() ? 'Mindset' : null,
    entry.lessons?.trim() ? 'Lessons' : null,
  ].filter(Boolean) as string[];

  return (
    <TouchableOpacity
      style={styles.entryRow}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      activeOpacity={0.7}
    >
      <View style={styles.entryDateCol}>
        <Text style={[styles.entryDay, { color: colors.textPrimary }]}>
          {new Date(entry.date + 'T00:00:00').getDate()}
        </Text>
        <Text style={[styles.entryMonth, { color: colors.textSecondary }]}>
          {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
        </Text>
      </View>
      <View style={styles.entryContent}>
        <Text style={[styles.entrySnippetText, { color: colors.textPrimary }]} numberOfLines={2}>
          {entrySnippet(entry)}
        </Text>
        <View style={styles.entryBadges}>
          {badges.map(b => {
            const bc = BADGE_COLORS[b];
            return (
              <View key={b} style={[styles.entryBadge, { backgroundColor: isDark ? colors.surfaceHigh : bc.bg }]}>
                <Text style={[styles.entryBadgeText, { color: isDark ? colors.textSecondary : bc.text }]}>{b}</Text>
              </View>
            );
          })}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function JournalScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [entries, setEntries] = useState<DailyJournal[]>([]);
  const [todayEntry, setTodayEntry] = useState<DailyJournal | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorDate, setEditorDate] = useState<string | null>(null);
  const [editorInitial, setEditorInitial] = useState<DailyJournal | null>(null);
  const today = todayISO();

  const load = useCallback(async () => {
    try {
      const [all, te] = await Promise.all([getJournalEntries(), getJournalEntry(today)]);
      setEntries(all);
      setTodayEntry(te);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openEditor = (date: string, initial: DailyJournal | null) => {
    setEditorDate(date);
    setEditorInitial(initial);
  };

  const handleSaved = async () => {
    setEditorDate(null);
    setLoading(true);
    await load();
  };

  const pastEntries = entries.filter(e => e.date !== today);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={pastEntries}
        keyExtractor={e => e.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <Text style={styles.sectionHeader}>Today</Text>
            <TodayCard today={today} entry={todayEntry} onPress={() => openEditor(today, todayEntry)} />
            {pastEntries.length > 0 && <Text style={styles.sectionHeader}>Past Entries</Text>}
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.rowWrapper}>
            <EntryRow entry={item} onPress={() => openEditor(item.date, item)} />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📓</Text>
            <Text style={styles.emptyTitle}>No past entries yet</Text>
            <Text style={styles.emptySubtitle}>
              Keep a daily record of market conditions, your mindset, and lessons learned.
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {editorDate !== null && (
        <EntryEditorModal
          visible
          date={editorDate}
          initial={editorInitial}
          onSave={handleSaved}
          onClose={() => setEditorDate(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1, backgroundColor: c.background },
    loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listContent: { paddingBottom: 32 },

    sectionHeader: {
      fontSize: 12, fontWeight: '700', color: c.sectionHeader,
      textTransform: 'uppercase', letterSpacing: 0.6,
      marginTop: 20, marginBottom: 8, marginLeft: 20,
    },

    todayCard: {
      flexDirection: 'row',
      backgroundColor: c.surface, marginHorizontal: 16, borderRadius: 14,
      overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
    },
    todayAccent: { width: 4, alignSelf: 'stretch' },
    todayInner: { flex: 1, padding: 16 },
    todayTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    todayLabel: { fontSize: 11, fontWeight: '500', marginBottom: 3 },
    todayDate: { fontSize: 16, fontWeight: '700' },
    todayStatusBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    },
    todayStatusText: { fontSize: 12, fontWeight: '600' },
    todaySnippet: { fontSize: 13, lineHeight: 18 },

    rowWrapper: {
      marginHorizontal: 16, backgroundColor: c.surface, borderRadius: 12, overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
    },
    entryRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 14, paddingVertical: 12, gap: 12,
    },
    entryDateCol: { alignItems: 'center', width: 32 },
    entryDay: { fontSize: 18, fontWeight: '700', color: c.textPrimary, lineHeight: 20 },
    entryMonth: { fontSize: 10, color: c.textSecondary, fontWeight: '500', textTransform: 'uppercase' },
    entryContent: { flex: 1, minWidth: 0 },
    entrySnippetText: { fontSize: 14, color: c.textPrimary, lineHeight: 19, marginBottom: 5 },
    entryBadges: { flexDirection: 'row', gap: 5 },
    entryBadge: {
      backgroundColor: c.surfaceHigh, borderRadius: 4,
      paddingHorizontal: 6, paddingVertical: 2,
    },
    entryBadgeText: { fontSize: 10, color: c.textSecondary, fontWeight: '500' },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: 58 },

    emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: c.textPrimary, marginBottom: 6 },
    emptySubtitle: { fontSize: 14, color: c.textSecondary, textAlign: 'center', lineHeight: 20 },

    modalContainer: { flex: 1, backgroundColor: c.background },
    modalHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: c.surface,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    modalHeaderBtn: { minWidth: 60 },
    modalTitle: { fontSize: 16, fontWeight: '600', color: c.textPrimary, flex: 1, textAlign: 'center' },
    modalCancelText: { fontSize: 16, color: c.textSecondary },
    modalSaveText: { fontSize: 16, fontWeight: '600', color: c.primary, textAlign: 'right' },
    modalScroll: { flex: 1 },
    modalScrollContent: { padding: 16, paddingBottom: 32 },

    fieldLabel: {
      fontSize: 13, fontWeight: '600', color: c.sectionHeader,
      textTransform: 'uppercase', letterSpacing: 0.5,
      marginBottom: 8, marginTop: 16, marginLeft: 4,
    },
    textAreaCard: { backgroundColor: c.surface, borderRadius: 12, overflow: 'hidden' },
    textArea: {
      padding: 14, fontSize: 15, color: c.textPrimary, minHeight: 110, lineHeight: 22,
    },
    deleteEntryBtn: {
      marginTop: 32, paddingVertical: 14, borderRadius: 12,
      alignItems: 'center', backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.loss,
    },
    deleteEntryText: { fontSize: 16, fontWeight: '600', color: c.loss },
  });
}
