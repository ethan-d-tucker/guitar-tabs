import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { Colors, Spacing, FontSize } from '../../src/constants/theme';
import { getSongById, updateTranspose, updateAnnotations, deleteSong } from '../../src/db/songs';
import TransposeControls from '../../src/components/TransposeControls';
import SongPreview from '../../src/components/SongPreview';
import SetlistManager from '../../src/components/SetlistManager';
import type { Song } from '../../src/models/Song';

export default function SongDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [annotationText, setAnnotationText] = useState('');
  const [setlistManagerVisible, setSetlistManagerVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadSong();
    }, [id])
  );

  async function loadSong() {
    try {
      const data = await getSongById(Number(id));
      if (data) {
        setSong(data);
        setOffset(data.transposeOffset);
      }
    } catch (error) {
      console.error('Failed to load song:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleTranspose(newOffset: number) {
    setOffset(newOffset);
    if (song) {
      await updateTranspose(song.id, newOffset);
    }
  }

  function openAnnotationEditor(sectionName: string) {
    if (!song) return;
    setEditingSection(sectionName);
    setAnnotationText((song.annotations || {})[sectionName] || '');
  }

  async function handleSaveAnnotation() {
    if (!song || editingSection === null) return;
    const updated = { ...(song.annotations || {}) };
    const trimmed = annotationText.trim();
    if (trimmed) {
      updated[editingSection] = trimmed;
    } else {
      delete updated[editingSection];
    }
    await updateAnnotations(song.id, updated);
    setSong({ ...song, annotations: updated });
    setEditingSection(null);
  }

  async function handleDeleteAnnotation() {
    if (!song || editingSection === null) return;
    const updated = { ...(song.annotations || {}) };
    delete updated[editingSection];
    await updateAnnotations(song.id, updated);
    setSong({ ...song, annotations: updated });
    setEditingSection(null);
  }

  function handleExportSingle() {
    if (!song) return;
    const hasAnnotations = Object.keys(song.annotations || {}).length > 0;

    if (hasAnnotations) {
      Alert.alert('Export PDF', 'Include your annotations?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Without Notes',
          onPress: () => exportPDF(false),
        },
        {
          text: 'With Notes',
          onPress: () => exportPDF(true),
        },
      ]);
    } else {
      exportPDF(false);
    }
  }

  async function exportPDF(includeAnnotations: boolean) {
    if (!song) return;
    try {
      const { generateAndSharePDF } = await import('../../src/services/pdf-generator');
      const exportSong = { ...song, transposeOffset: offset };
      await generateAndSharePDF([exportSong], song.title, includeAnnotations);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to generate PDF');
    }
  }

  async function handleDelete() {
    if (!song) return;
    Alert.alert(
      'Delete Song',
      `Delete "${song.title}" permanently?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSong(song.id);
            router.back();
          },
        },
      ]
    );
  }

  if (loading || !song) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Song Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{song.title}</Text>
        <Text style={styles.artist}>{song.artist}</Text>
        {(song.capo > 0 || song.tuning !== 'Standard') && (
          <Text style={styles.meta}>
            {song.capo > 0 ? `Capo ${song.capo}` : ''}
            {song.capo > 0 && song.tuning !== 'Standard' ? ' | ' : ''}
            {song.tuning !== 'Standard' ? song.tuning : ''}
          </Text>
        )}
        <View style={styles.headerLinks}>
          <TouchableOpacity onPress={() => openAnnotationEditor('_song')}>
            <Text style={styles.addNoteLink}>
              {(song.annotations || {})['_song'] ? 'Edit song note' : '+ Add song note'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSetlistManagerVisible(true)}>
            <Text style={styles.addNoteLink}>Manage setlists</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Transpose Controls */}
      <TransposeControls offset={offset} onTranspose={handleTranspose} />

      {/* Song Content */}
      <SongPreview
        rawContent={song.rawContent}
        transposeOffset={offset}
        annotations={song.annotations}
        onAnnotationPress={openAnnotationEditor}
      />

      {/* Bottom Actions */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportButton} onPress={handleExportSingle}>
          <Text style={styles.exportButtonText}>Export PDF</Text>
        </TouchableOpacity>
      </View>

      {/* Annotation Editor Modal */}
      <Modal visible={editingSection !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingSection === '_song' ? 'Song Note' : editingSection}
            </Text>
            <TextInput
              style={styles.annotationInput}
              value={annotationText}
              onChangeText={setAnnotationText}
              placeholder="Add a note..."
              placeholderTextColor={Colors.textMuted}
              multiline
              autoFocus
            />
            <View style={styles.modalButtons}>
              {editingSection !== null && (song.annotations || {})[editingSection] && (
                <TouchableOpacity onPress={handleDeleteAnnotation}>
                  <Text style={styles.modalDeleteText}>Delete</Text>
                </TouchableOpacity>
              )}
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => setEditingSection(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveAnnotation}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Setlist Manager Modal */}
      <SetlistManager
        visible={setlistManagerVisible}
        songId={song.id}
        onClose={() => setSetlistManagerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  artist: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  meta: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  headerLinks: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  addNoteLink: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '500',
  },
  bottomBar: {
    flexDirection: 'row',
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  deleteButton: {
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  deleteButtonText: {
    color: Colors.error,
    fontWeight: '600',
    fontSize: FontSize.md,
  },
  exportButton: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  exportButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FontSize.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  annotationInput: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  modalDeleteText: {
    color: Colors.error,
    fontWeight: '600',
    fontSize: FontSize.md,
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: FontSize.md,
  },
  modalSaveText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: FontSize.md,
  },
});
