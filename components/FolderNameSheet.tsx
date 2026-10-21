import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';

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
    <Sheet visible={props.visible} title={props.title} onClose={props.onClose}>
      <FolderNameForm {...props} />
    </Sheet>
  );
}

function FolderNameForm({
  confirmLabel,
  initialName = '',
  onSubmit,
  onClose,
}: FolderNameSheetProps) {
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
    <>
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
    </>
  );
}

const styles = StyleSheet.create({
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
