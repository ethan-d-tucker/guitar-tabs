import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { parseContent, buildChordLine, type SongLine } from '../utils/chord-parser';
import { transposeSong } from '../services/transpose';
import { Colors, Spacing, FontSize } from '../constants/theme';
import type { SongAnnotations } from '../models/Song';

interface SongPreviewProps {
  rawContent: string;
  transposeOffset?: number;
  annotations?: SongAnnotations;
  onAnnotationPress?: (sectionName: string) => void;
}

export default function SongPreview({
  rawContent,
  transposeOffset = 0,
  annotations,
  onAnnotationPress,
}: SongPreviewProps) {
  const content = transposeOffset !== 0
    ? transposeSong(rawContent, transposeOffset)
    : rawContent;

  const lines = parseContent(content);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {annotations?.['_song'] && (
        <TouchableOpacity
          onPress={() => onAnnotationPress?.('_song')}
          disabled={!onAnnotationPress}
          activeOpacity={onAnnotationPress ? 0.6 : 1}
        >
          <View style={styles.annotationBlock}>
            <Text style={styles.annotationText}>{annotations['_song']}</Text>
          </View>
        </TouchableOpacity>
      )}
      {lines.map((line, i) => renderLine(line, i, annotations, onAnnotationPress))}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function renderLine(
  line: SongLine,
  key: number,
  annotations?: SongAnnotations,
  onAnnotationPress?: (sectionName: string) => void,
) {
  switch (line.type) {
    case 'section': {
      const annotation = annotations?.[line.name];
      const sectionHeader = (
        <Text style={styles.section}>{line.name}</Text>
      );
      return (
        <View key={key}>
          {onAnnotationPress ? (
            <TouchableOpacity onPress={() => onAnnotationPress(line.name)} activeOpacity={0.6}>
              {sectionHeader}
            </TouchableOpacity>
          ) : (
            sectionHeader
          )}
          {annotation && (
            <TouchableOpacity
              onPress={() => onAnnotationPress?.(line.name)}
              disabled={!onAnnotationPress}
              activeOpacity={onAnnotationPress ? 0.6 : 1}
            >
              <View style={styles.annotationBlock}>
                <Text style={styles.annotationText}>{annotation}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      );
    }
    case 'chord-lyric':
      return (
        <View key={key}>
          {line.chords.length > 0 && (
            <Text style={styles.chordLine}>{buildChordLine(line.chords)}</Text>
          )}
          {line.lyrics ? (
            <Text style={styles.lyricLine}>{line.lyrics}</Text>
          ) : null}
        </View>
      );
    case 'tab':
      return (
        <View key={key} style={styles.tabBlock}>
          {line.lines.map((tabLine, j) => (
            <Text key={j} style={styles.tabText}>{tabLine}</Text>
          ))}
        </View>
      );
    case 'empty':
      return <View key={key} style={styles.emptyLine} />;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.md,
    backgroundColor: Colors.background,
  },
  section: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chordLine: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.chordColor,
  },
  lyricLine: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: Colors.text,
    marginBottom: 2,
  },
  tabBlock: {
    backgroundColor: Colors.tabBackground,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    padding: Spacing.sm,
    marginVertical: Spacing.sm,
    borderRadius: 4,
  },
  tabText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: Colors.text,
  },
  emptyLine: {
    height: 10,
  },
  annotationBlock: {
    backgroundColor: Colors.annotationBg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.annotationBorder,
    borderRadius: 4,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  annotationText: {
    fontSize: FontSize.xs,
    fontStyle: 'italic',
    color: Colors.textSecondary,
    lineHeight: 16,
  },
});
