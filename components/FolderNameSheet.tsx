import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { colors, radii, typography } from '@/constants/theme';

type FolderNameSheetProps = {
  visible: boolean;
  /** "New folder" when creating; "Rename folder" when renaming (R.4b). */
  title: string;
  confirmLabel: string;
  initialName?: string;
  /** Resolves when saved; throws to keep the sheet open and show an error. */
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
};

const ERROR_MESSAGE = 'Something went wrong. Please try again.';

/**
 * A bottom sheet asking for a folder name. Not in the mockups (they only show the
 * dashed "Create a new folder" card), so it follows the app's surface/field style.
 * Mounted fresh each time it opens, so a closed-and-reopened sheet starts clean.
 */
export function FolderNameSheet(props: FolderNameSheetProps) {
  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="fade"
      onRequestClose={props.onClose}
      statusBarTranslucent
    >
      {props.visible ? <SheetBody {...props} /> : null}
    </Modal>
  );
}

function SheetBody({
  title,
  confirmLabel,
  initialName = '',
  onSubmit,
  onClose,
}: FolderNameSheetProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please give the folder a name.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit(trimmed);
    } catch {
      setError(ERROR_MESSAGE);
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Pressable
        style={[StyleSheet.absoluteFill, styles.scrim]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <TextField
          label="Folder name"
          value={name}
          onChangeText={setName}
          error={error}
          autoFocus
          maxLength={60}
          autoCapitalize="sentences"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
        <View style={styles.actions}>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button
            label={confirmLabel}
            onPress={handleSubmit}
            loading={saving}
            style={styles.confirm}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    backgroundColor: 'rgba(29, 22, 34, 0.7)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingTop: 24,
    paddingHorizontal: 24,
    gap: 20,
  },
  title: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  confirm: {
    paddingHorizontal: 32,
  },
});
