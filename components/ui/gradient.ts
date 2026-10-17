import { Platform, type ViewStyle } from 'react-native';

/**
 * A CSS gradient as a View background. Native React Native reads it from
 * `experimental_backgroundImage`; react-native-web silently drops that prop but
 * passes the plain CSS `backgroundImage` through, so the web preview needs this
 * split to show gradients at all.
 */
export function gradientBackground(css: string): ViewStyle {
  if (Platform.OS === 'web') {
    return { backgroundImage: css } as ViewStyle;
  }
  return { experimental_backgroundImage: css };
}
