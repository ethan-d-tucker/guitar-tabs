import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Spacing, FontSize } from '../src/constants/theme';
import {
  getAllSongs,
  deleteSong,
  getAllSetlists,
  createSetlist,
  renameSetlist,
  deleteSetlist,
  getSongsInSetlist,
  removeSongFromSetlist,
} from '../src/db/songs';
import SongCard from '../src/components/SongCard';
import SetlistDropdown from '../src/components/SetlistDropdown';
import SetlistNameModal from '../src/components/SetlistNameModal';
import type { Song, Setlist } from '../src/models/Song';

export default function HomeScreen() {
  const router = useRouter();
  const [songs, setSongs] = useState<Song[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [selectedSetlistId, setSelectedSetlistId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Setlist name modal state
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [nameModalTitle, setNameModalTitle] = useState('New Setlist');
  const [nameModalInitial, setNameModalInitial] = useState('');
  const [renamingSetlistId, setRenamingSetlistId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [selectedSetlistId])
  );

  async function loadData() {
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Database load timed out')), 10000)
      );
      const [songData, setlistData] = await Promise.race([
        Promise.all([
          selectedSetlistId === null ? getAllSongs() : getSongsInSetlist(selectedSetlistId),
          getAllSetlists(),
        ]),
        timeout,
      ]);
      setSongs(songData);
      setSetlists(setlistData);
    } catch (error) {
      console.error('Failed to load data:', error);
      setSongs([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSongAction(song: Song) {
    if (selectedSetlistId !== null) {
      // Viewing a setlist — offer remove from setlist
      Alert.alert(song.title, '', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove from Setlist',
          onPress: async () => {
            await removeSongFromSetlist(selectedSetlistId, song.id);
            loadData();
          },
        },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: () => confirmDelete(song),
        },
      ]);
    } else {
      confirmDelete(song);
    }
  }

  function confirmDelete(song: Song) {
    Alert.alert(
      'Delete Song',
      `Delete "${song.title}" permanently? It will be removed from all setlists.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSong(song.id);
            loadData();
          },
        },
      ]
    );
  }

  const selectedSetlistName = selectedSetlistId === null
    ? 'All Songs'
    : setlists.find(s => s.id === selectedSetlistId)?.name ?? 'All Songs';

  function handleGeneratePDF() {
    if (songs.length === 0) {
      Alert.alert('No Songs', selectedSetlistId ? 'This setlist is empty.' : 'Add some songs first!');
      return;
    }
    const hasAnnotations = songs.some(s => Object.keys(s.annotations || {}).length > 0);
    if (hasAnnotations) {
      Alert.alert('Generate PDF', 'Include your annotations?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Without Notes', onPress: () => doGeneratePDF(false) },
        { text: 'With Notes', onPress: () => doGeneratePDF(true) },
      ]);
    } else {
      doGeneratePDF(false);
    }
  }

  async function doGeneratePDF(includeAnnotations: boolean) {
    setGeneratingPdf(true);
    try {
      const { generateAndSharePDF } = await import('../src/services/pdf-generator');
      await generateAndSharePDF(songs, selectedSetlistName, includeAnnotations);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to generate PDF');
    } finally {
      setGeneratingPdf(false);
    }
  }

  // Setlist management handlers
  function handleCreateNew() {
    setRenamingSetlistId(null);
    setNameModalTitle('New Setlist');
    setNameModalInitial('');
    setNameModalVisible(true);
  }

  function handleRename(id: number, currentName: string) {
    setRenamingSetlistId(id);
    setNameModalTitle('Rename Setlist');
    setNameModalInitial(currentName);
    setNameModalVisible(true);
  }

  function handleDeleteSetlist(id: number, name: string) {
    Alert.alert(
      'Delete Setlist',
      `Delete "${name}"? Songs won't be removed from your library.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSetlist(id);
            if (selectedSetlistId === id) setSelectedSetlistId(null);
            loadData();
          },
        },
      ]
    );
  }

  async function handleNameSubmit(name: string) {
    if (renamingSetlistId !== null) {
      await renameSetlist(renamingSetlistId, name);
    } else {
      await createSetlist(name);
    }
    loadData();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SetlistDropdown
        setlists={setlists}
        selectedId={selectedSetlistId}
        onSelect={setSelectedSetlistId}
        onCreateNew={handleCreateNew}
        onRename={handleRename}
        onDelete={handleDeleteSetlist}
      />

      {songs.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🎸</Text>
          <Text style={styles.emptyTitle}>
            {selectedSetlistId ? 'Setlist is empty' : 'No songs yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {selectedSetlistId
              ? 'Add songs from your library or import new ones'
              : 'Tap the button below to add your first song'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={songs}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <SongCard
              song={item}
              onPress={() => router.push(`/song/${item.id}`)}
              onLongPress={() => handleSongAction(item)}
            />
          )}
          contentContainerStyle={{ paddingVertical: Spacing.sm }}
        />
      )}

      <View style={styles.bottomBar}>
        {songs.length > 0 && (
          <TouchableOpacity
            style={styles.pdfButton}
            onPress={handleGeneratePDF}
            disabled={generatingPdf}
          >
            {generatingPdf ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.pdfButtonText}>Generate PDF</Text>
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            const params = selectedSetlistId ? `?setlistId=${selectedSetlistId}` : '';
            router.push(`/add-song${params}`);
          }}
        >
          <Text style={styles.addButtonText}>+ Add Song</Text>
        </TouchableOpacity>
      </View>

      <SetlistNameModal
        visible={nameModalVisible}
        title={nameModalTitle}
        initialName={nameModalInitial}
        onClose={() => setNameModalVisible(false)}
        onSubmit={handleNameSubmit}
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
    padding: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
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
  addButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  pdfButton: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  pdfButtonText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
