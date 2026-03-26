import { useState, useMemo } from 'react';
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
      const id = crypto.randomUUID();
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  closeBtn: {
    padding: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: 12,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1C1C1E',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  noneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 4,
  },
  noneText: {
    fontSize: 16,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  rowSelected: {
    backgroundColor: '#EBF5FF',
  },
  rowContent: {
    flex: 1,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  rowDesc: {
    fontSize: 13,
    color: '#8E8E93',
  },
  customBadge: {
    backgroundColor: '#F2F2F7',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  customBadgeText: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5EA',
    marginLeft: 16,
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 12,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  createBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  createForm: {
    flex: 1,
    padding: 16,
  },
  createFormTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6D6D72',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  field: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 4,
  },
  fieldInput: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  fieldInputMulti: {
    minHeight: 48,
  },
  fieldSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5EA',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#007AFF',
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
