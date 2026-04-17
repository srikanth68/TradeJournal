import { useState, useMemo } from 'react';
import { generateUUID } from '../utils/uuid';
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, type AppColors } from '../theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, schema } from '../db';
import type { Strategy } from '../db/schema';

type Props = {
  visible: boolean;
  strategies: Strategy[];
  selectedId: string | undefined;
  onSelect: (strategy: Strategy | undefined) => void;
  onClose: () => void;
  onStrategiesChange: (updated: Strategy[]) => void;
};

export function StrategyPickerModal({
  visible,
  strategies,
  selectedId,
  onSelect,
  onClose,
  onStrategiesChange,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  const [creatingCustom, setCreatingCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return strategies;
    const lower = query.toLowerCase();
    return strategies.filter(
      s =>
        s.name.toLowerCase().includes(lower) ||
        (s.description ?? '').toLowerCase().includes(lower)
    );
  }, [strategies, query]);

  const handleClose = () => {
    setQuery('');
    setCreatingCustom(false);
    setCustomName('');
    setCustomDesc('');
    onClose();
  };

  const handleSelect = (strategy: Strategy | undefined) => {
    setQuery('');
    onSelect(strategy);
    handleClose();
  };

  const handleCreateCustom = async () => {
    if (!customName.trim()) {
      Alert.alert('Required', 'Please enter a strategy name.');
      return;
    }
    setSaving(true);
    try {
      const id = generateUUID();
      await db.insert(schema.strategies).values({
        id,
        name: customName.trim(),
        description: customDesc.trim() || undefined,
        isPredefined: false,
        createdAt: new Date(),
      });
      const updated = await db.select().from(schema.strategies);
      onStrategiesChange(updated);
      const newStrategy = updated.find(s => s.id === id);
      if (newStrategy) handleSelect(newStrategy);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      if (msg.includes('UNIQUE')) {
        Alert.alert('Duplicate', 'A strategy with that name already exists.');
      } else {
        Alert.alert('Error', 'Could not save strategy.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select Strategy</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Ionicons name="close-circle" size={28} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color="#8E8E93" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search strategies..."
              placeholderTextColor={colors.textTertiary}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>

          {!creatingCustom ? (
            <>
              <FlatList
                data={filtered}
                keyExtractor={s => s.id}
                ListHeaderComponent={
                  <TouchableOpacity
                    style={styles.noneRow}
                    onPress={() => handleSelect(undefined)}
                  >
                    <Text style={styles.noneText}>None</Text>
                    {!selectedId && (
                      <Ionicons name="checkmark" size={20} color="#007AFF" />
                    )}
                  </TouchableOpacity>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.row, selectedId === item.id && styles.rowSelected]}
                    onPress={() => handleSelect(item)}
                  >
                    <View style={styles.rowContent}>
                      <Text style={styles.rowName}>{item.name}</Text>
                      {item.description ? (
                        <Text style={styles.rowDesc} numberOfLines={1}>
                          {item.description}
                        </Text>
                      ) : null}
                    </View>
                    {!item.isPredefined && (
                      <View style={styles.customBadge}>
                        <Text style={styles.customBadgeText}>Custom</Text>
                      </View>
                    )}
                    {selectedId === item.id && (
                      <Ionicons name="checkmark" size={20} color="#007AFF" />
                    )}
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No strategies match "{query}"</Text>
                  </View>
                }
              />

              <TouchableOpacity
                style={styles.createBtn}
                onPress={() => setCreatingCustom(true)}
              >
                <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
                <Text style={styles.createBtnText}>Create Custom Strategy</Text>
              </TouchableOpacity>
            </>
          ) : (
            /* Create Custom Form */
            <View style={styles.createForm}>
              <Text style={styles.createFormTitle}>New Custom Strategy</Text>

              <View style={styles.card}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Name *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="e.g. Opening Drive"
                    placeholderTextColor={colors.textTertiary}
                    value={customName}
                    onChangeText={setCustomName}
                    autoFocus
                  />
                </View>
                <View style={styles.fieldSep} />
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Description</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.fieldInputMulti]}
                    placeholder="Optional"
                    value={customDesc}
                    onChangeText={setCustomDesc}
                    multiline
                    numberOfLines={2}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              <View style={styles.createFormActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setCreatingCustom(false);
                    setCustomName('');
                    setCustomDesc('');
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={handleCreateCustom}
                  disabled={saving}
                >
                  <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: c.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: c.textPrimary,
    },
    closeBtn: {
      padding: 4,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      margin: 12,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    searchIcon: {
      marginRight: 6,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: c.textPrimary,
    },
    listContent: {
      paddingHorizontal: 12,
      paddingBottom: 8,
    },
    noneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: c.surface,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 10,
      marginBottom: 4,
    },
    noneText: {
      fontSize: 16,
      color: c.textSecondary,
      fontStyle: 'italic',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 10,
    },
    rowSelected: {
      backgroundColor: c.selectedRowBg,
    },
    rowContent: {
      flex: 1,
    },
    rowName: {
      fontSize: 16,
      fontWeight: '500',
      color: c.textPrimary,
      marginBottom: 2,
    },
    rowDesc: {
      fontSize: 13,
      color: c.textSecondary,
    },
    customBadge: {
      backgroundColor: c.surfaceHigh,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    customBadgeText: {
      fontSize: 11,
      color: c.textSecondary,
      fontWeight: '500',
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator,
      marginLeft: 16,
    },
    emptyState: {
      paddingVertical: 24,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: c.textSecondary,
    },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      margin: 12,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.primary,
    },
    createBtnText: {
      fontSize: 16,
      fontWeight: '600',
      color: c.primary,
    },
    createForm: {
      flex: 1,
      padding: 16,
    },
    createFormTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: c.sectionHeader,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 12,
      overflow: 'hidden',
    },
    field: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    fieldLabel: {
      fontSize: 12,
      color: c.textSecondary,
      fontWeight: '500',
      marginBottom: 4,
    },
    fieldInput: {
      fontSize: 16,
      color: c.textPrimary,
    },
    fieldInputMulti: {
      minHeight: 48,
    },
    fieldSep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator,
      marginLeft: 16,
    },
    createFormActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    cancelBtnText: {
      fontSize: 16,
      fontWeight: '600',
      color: c.textSecondary,
    },
    saveBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: c.primary,
    },
    saveBtnDisabled: {
      opacity: 0.6,
    },
    saveBtnText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });
}
