import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Spacing, FontSize } from '../constants/theme';

interface TransposeControlsProps {
  offset: number;
  onTranspose: (newOffset: number) => void;
}

export default function TransposeControls({ offset, onTranspose }: TransposeControlsProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Transpose</Text>
      <View style={styles.controls}>
        <TouchableOpacity style={styles.button} onPress={() => onTranspose(offset - 1)}>
          <Text style={styles.buttonText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.offset}>
          {offset === 0 ? 'Original' : `${offset > 0 ? '+' : ''}${offset}`}
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => onTranspose(offset + 1)}>
          <Text style={styles.buttonText}>+</Text>
        </TouchableOpacity>
        {offset !== 0 && (
          <TouchableOpacity style={styles.resetButton} onPress={() => onTranspose(0)}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    lineHeight: 22,
  },
  offset: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    minWidth: 60,
    textAlign: 'center',
  },
  resetButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  resetText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '500',
  },
});
