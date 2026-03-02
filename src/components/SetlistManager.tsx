import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Colors, Spacing, FontSize } from '../constants/theme';
import { getAllSetlists, getSetlistsForSong, setSongSetlists, createSetlist } from '../db/songs';
import type { Setlist } from '../models/Song';
import SetlistNameModal from './SetlistNameModal';

interface SetlistManagerProps {
  visible: boolean;
  songId: number;
  onClose: () => void;
}

export default function SetlistManager({ visible, songId, onClose }: SetlistManagerProps) {
  const [allSetlists, setAllSetlists] = useState<Setlist[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  useEffect(() => {
    if (visible) loadData();
  }, [visible, songId]);

  async function loadData() {
    setLoading(true);
    try {
      const [setlists, songSetlists] = await Promise.all([
        getAllSetlists(),
        getSetlistsForSong(songId),
      ]);
      setAllSetlists(setlists);
      setSelectedIds(new Set(songSetlists.map(s => s.id)));
    } catch (error) {
      console.error('Failed to load setlists:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleSetlist(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleDone() {
    await setSongSetlists(songId, Array.from(selectedIds));
    onClose();
  }

  async function handleCreateSetlist(name: string) {
    const newId = await createSetlist(name);
    setAllSetlists(prev => [...prev, { id: newId, name, createdAt: new Date().toISOString() }]);
    setSelectedIds(prev => new Set([...prev, newId]));
  }

  return (
    <>
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.content}>
            <Text style={styles.title}>Manage Setlists</Text>

            {loading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.lg }} />
            ) : allSetlists.length === 0 ? (
              <Text style={styles.emptyText}>No setlists yet. Create one below.</Text>
            ) : (
              <ScrollView style={styles.list} bounces={false}>
                {allSetlists.map(setlist => (
                  <TouchableOpacity
                    key={setlist.id}
                    style={styles.item}
                    onPress={() => toggleSetlist(setlist.id)}
                  >
                    <View style={[styles.checkbox, selectedIds.has(setlist.id) && styles.checkboxActive]}>
                      {selectedIds.has(setlist.id) && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.itemText} numberOfLines={1}>{setlist.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.createRow}
              onPress={() => setCreateModalVisible(true)}
            >
              <Text style={styles.createText}>+ New Setlist</Text>
            </TouchableOpacity>

            <View style={styles.buttons}>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDone}>
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SetlistNameModal
        visible={createModalVisible}
        title="New Setlist"
        onClose={() => setCreateModalVisible(false)}
        onSubmit={handleCreateSetlist}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  content: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    maxHeight: 450,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginVertical: Spacing.lg,
  },
  list: {
    maxHeight: 250,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  itemText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  createRow: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Spacing.xs,
  },
  createText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  cancelText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: FontSize.md,
  },
  doneText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: FontSize.md,
  },
});
