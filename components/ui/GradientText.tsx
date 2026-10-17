import MaskedView from '@react-native-masked-view/masked-view';
import {
  Platform,
  Text,
  View,
  type AccessibilityRole,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { colors, gradients } from '@/constants/theme';

import { gradientBackground } from './gradient';

type GradientTextProps = {
  style?: StyleProp<TextStyle>;
  children: string;
  accessibilityRole?: AccessibilityRole;
};

/**
 * Text filled with the mauve → light mauve gradient (the board's `.mesh-text`, used for
 * screen titles and secondary-button labels). The text is drawn as a mask over a
 * gradient view; an invisible copy of the same text sizes that view.
 *
 * masked-view's web build ignores the mask (it would show a gradient block), so the web
 * preview gets solid light mauve instead.
 */
export function GradientText({ style, children, accessibilityRole }: GradientTextProps) {
  if (Platform.OS === 'web') {
    return (
      <Text accessibilityRole={accessibilityRole} style={[style, { color: colors.accent }]}>
        {children}
      </Text>
    );
  }

  return (
    <View accessible accessibilityLabel={children} accessibilityRole={accessibilityRole}>
      <MaskedView
        importantForAccessibility="no-hide-descendants"
        maskElement={<Text style={style}>{children}</Text>}
      >
        <View style={gradientBackground(gradients.actionFill)}>
          <Text style={[style, { opacity: 0 }]}>{children}</Text>
        </View>
      </MaskedView>
    </View>
  );
}
