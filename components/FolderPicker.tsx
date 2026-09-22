import { ScrollView, Pressable, StyleSheet, Text } from 'react-native';

import { radii, spacing } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { LocalFolder } from '@/lib/folders.local';

type FolderPickerProps = {
  folders: LocalFolder[];
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
};

type ChipProps = { label: string; selected: boolean; onPress: () => void };

function Chip({ label, selected, onPress }: ChipProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primary : 'transparent',
        },
      ]}
    >
      <Text style={{ color: selected ? colors.background : colors.textPrimary }}>{label}</Text>
    </Pressable>
  );
}

export function FolderPicker({ folders, selectedFolderId, onSelect }: FolderPickerProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Chip label="No folder" selected={selectedFolderId === null} onPress={() => onSelect(null)} />
      {folders.map((folder) => (
        <Chip
          key={folder.id}
          label={folder.name}
          selected={selectedFolderId === folder.id}
          onPress={() => onSelect(folder.id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
});
