import type { ReactNode } from 'react';
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

import { colors, radii, typography } from '@/constants/theme';

type SheetProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * The board's bottom sheet: a `surface` panel with rounded top corners over a dark scrim.
 * Tapping the scrim or Android's back gesture closes it. The body only mounts while open,
 * so a sheet's own state starts fresh each time.
 */
export function Sheet({ visible, title, onClose, children }: SheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {visible ? (
        <SheetBody title={title} onClose={onClose}>
          {children}
        </SheetBody>
      ) : null}
    </Modal>
  );
}

function SheetBody({
  title,
  onClose,
  children,
}: Pick<SheetProps, 'title' | 'onClose' | 'children'>) {
  const insets = useSafeAreaInsets();
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
        {children}
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
});
