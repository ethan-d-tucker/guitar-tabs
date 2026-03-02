import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Spacing, FontSize } from '../constants/theme';
import type { SearchResult } from '../models/Song';

interface SearchResultCardProps {
  result: SearchResult;
  onPress: () => void;
}

export default function SearchResultCard({ result, onPress }: SearchResultCardProps) {
  const typeBadge = result.type.toUpperCase();
  const ratingDisplay = result.rating > 0 ? result.rating.toFixed(1) : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{result.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{result.artist}</Text>
      </View>
      <View style={styles.right}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{typeBadge}</Text>
        </View>
        {ratingDisplay && (
          <Text style={styles.rating}>
            ★ {ratingDisplay}{result.votes > 0 ? ` (${result.votes})` : ''}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: Spacing.md,
    marginVertical: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  artist: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
    marginLeft: Spacing.sm,
  },
  badge: {
    backgroundColor: Colors.primary + '15',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  rating: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
