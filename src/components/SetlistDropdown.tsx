import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { Colors, Spacing, FontSize } from '../constants/theme';
import type { Setlist } from '../models/Song';

interface SetlistDropdownProps {
  setlists: Setlist[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onCreateNew: () => void;
  onRename: (id: number, currentName: string) => void;
  onDelete: (id: number, name: string) => void;
}

export default function SetlistDropdown({
  setlists,
  selectedId,
  onSelect,
  onCreateNew,
  onRename,
  onDelete,
}: SetlistDropdownProps) {
  const [open, setOpen] = useState(false);

  const selectedName = selectedId === null
    ? 'All Songs'
    : setlists.find(s => s.id === selectedId)?.name ?? 'All Songs';

  function handleSelect(id: number | null) {
    onSelect(id);
    setOpen(false);
  }

  function handleLongPress(setlist: Setlist) {
    Alert.alert(setlist.name, 'Manage this setlist', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Rename', onPress: () => { setOpen(false); onRename(setlist.id, setlist.name); } },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => { setOpen(false); onDelete(setlist.id, setlist.name); },
      },
    ]);
  }

  return (
    <>
      <TouchableOpacity style={styles.selector} onPress={() => setOpen(true)}>
        <Text style={styles.selectorText} numberOfLines={1}>{selectedName}</Text>
        <Text style={styles.chevron}>▼</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={styles.dropdown}>
            <Text style={styles.dropdownTitle}>Switch View</Text>
            <ScrollView style={styles.list} bounces={false}>
              <TouchableOpacity
                style={[styles.item, selectedId === null && styles.itemActive]}
                onPress={() => handleSelect(null)}
              >
                <Text style={[styles.itemText, selectedId === null && styles.itemTextActive]}>
                  All Songs
                </Text>
              </TouchableOpacity>

              {setlists.map(setlist => (
                <TouchableOpacity
                  key={setlist.id}
                  style={[styles.item, selectedId === setlist.id && styles.itemActive]}
                  onPress={() => handleSelect(setlist.id)}
                  onLongPress={() => handleLongPress(setlist)}
                >
                  <Text
                    style={[styles.itemText, selectedId === setlist.id && styles.itemTextActive]}
                    numberOfLines={1}
                  >
                    {setlist.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.createButton}
              onPress={() => { setOpen(false); onCreateNew(); }}
            >
              <Text style={styles.createButtonText}>+ New Setlist</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  selectorText: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  chevron: {
    fontSize: 12,
    color: Colors.textMuted,
    marginLeft: Spacing.sm,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    paddingTop: 100,
    paddingHorizontal: Spacing.lg,
  },
  dropdown: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    maxHeight: 400,
    overflow: 'hidden',
  },
  dropdownTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  list: {
    maxHeight: 280,
  },
  item: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  itemActive: {
    backgroundColor: Colors.background,
  },
  itemText: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  itemTextActive: {
    fontWeight: '700',
    color: Colors.primary,
  },
  createButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  createButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
});
