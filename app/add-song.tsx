import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Colors, Spacing, FontSize } from '../src/constants/theme';
import { isValidUGUrl } from '../src/utils/url-validator';
import { scrapeUltimateGuitar } from '../src/services/scraper';
import { addSong, addSongToSetlist } from '../src/db/songs';
import SongPreview from '../src/components/SongPreview';
import type { ScrapedSong } from '../src/models/Song';

type Mode = 'url' | 'manual';

export default function AddSongScreen() {
  const router = useRouter();
  const { setlistId } = useLocalSearchParams<{ setlistId?: string }>();
  const [mode, setMode] = useState<Mode>('url');
  const [url, setUrl] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualArtist, setManualArtist] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ScrapedSong | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePasteFromClipboard() {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setUrl(text);
      }
    } catch {
      // Clipboard access denied (common on web), ignore silently
    }
  }

  async function handleFetch() {
    const trimmed = url.trim();
    setError(null);
    setPreview(null);

    if (!trimmed) {
      setError('Please enter a URL.');
      return;
    }
    if (!isValidUGUrl(trimmed)) {
      setError('Please enter a valid Ultimate Guitar URL (tabs.ultimate-guitar.com).');
      return;
    }

    setLoading(true);
    try {
      const data = await scrapeUltimateGuitar(trimmed);
      setPreview(data);
    } catch (err: any) {
      setError(err.message || 'Could not fetch tab data. Try pasting content manually.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setError(null);
    let newSongId: number | null = null;

    if (mode === 'url' && preview) {
      newSongId = await addSong({
        title: preview.title,
        artist: preview.artist,
        type: preview.type as any,
        sourceUrl: url.trim(),
        rawContent: preview.rawContent,
        capo: preview.capo,
        tuning: preview.tuning,
      });
    } else if (mode === 'manual') {
      if (!manualTitle.trim() || !manualContent.trim()) {
        setError('Please enter a title and content.');
        return;
      }
      newSongId = await addSong({
        title: manualTitle.trim(),
        artist: manualArtist.trim() || 'Unknown',
        type: 'chords',
        sourceUrl: null,
        rawContent: manualContent,
        capo: 0,
        tuning: 'Standard',
      });
    }

    if (newSongId !== null && setlistId) {
      await addSongToSetlist(Number(setlistId), newSongId);
    }

    if (newSongId !== null) {
      router.back();
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Mode Toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'url' && styles.modeButtonActive]}
            onPress={() => { setMode('url'); setError(null); }}
          >
            <Text style={[styles.modeButtonText, mode === 'url' && styles.modeButtonTextActive]}>
              From URL
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'manual' && styles.modeButtonActive]}
            onPress={() => { setMode('manual'); setError(null); }}
          >
            <Text style={[styles.modeButtonText, mode === 'manual' && styles.modeButtonTextActive]}>
              Paste Manually
            </Text>
          </TouchableOpacity>
        </View>

        {/* Error Banner */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {mode === 'url' ? (
          <>
            {/* URL Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ultimate Guitar URL</Text>
              <TextInput
                style={styles.input}
                placeholder="https://tabs.ultimate-guitar.com/..."
                placeholderTextColor={Colors.textMuted}
                value={url}
                onChangeText={(t) => { setUrl(t); setError(null); }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.secondaryButton} onPress={handlePasteFromClipboard}>
                  <Text style={styles.secondaryButtonText}>Paste from Clipboard</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleFetch}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Fetch</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Preview */}
            {preview && (
              <View style={styles.previewContainer}>
                <View style={styles.previewHeader}>
                  <Text style={styles.previewTitle}>{preview.title}</Text>
                  <Text style={styles.previewArtist}>{preview.artist}</Text>
                </View>
                <View style={styles.previewContent}>
                  <SongPreview rawContent={preview.rawContent} />
                </View>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                  <Text style={styles.saveButtonText}>Add Song</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Manual Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Song Title</Text>
              <TextInput
                style={styles.input}
                placeholder="Song title"
                placeholderTextColor={Colors.textMuted}
                value={manualTitle}
                onChangeText={setManualTitle}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Artist</Text>
              <TextInput
                style={styles.input}
                placeholder="Artist name"
                placeholderTextColor={Colors.textMuted}
                value={manualArtist}
                onChangeText={setManualArtist}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Chords / Tabs</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Paste your chords or tabs here..."
                placeholderTextColor={Colors.textMuted}
                value={manualContent}
                onChangeText={setManualContent}
                multiline
                textAlignVertical="top"
              />
            </View>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Add Song</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.border,
    borderRadius: 10,
    padding: 3,
    marginBottom: Spacing.lg,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modeButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modeButtonTextActive: {
    color: Colors.text,
  },
  errorBanner: {
    backgroundColor: '#FDECEA',
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  multilineInput: {
    minHeight: 200,
    fontFamily: 'monospace',
    fontSize: 13,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FontSize.md,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    color: Colors.text,
    fontWeight: '600',
    fontSize: FontSize.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  previewContainer: {
    marginTop: Spacing.md,
  },
  previewHeader: {
    marginBottom: Spacing.sm,
  },
  previewTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  previewArtist: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  previewContent: {
    height: 300,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveButton: {
    backgroundColor: Colors.success,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FontSize.md,
  },
});
