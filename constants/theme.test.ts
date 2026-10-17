import { colors } from './theme';

// WCAG 2.1 relative luminance and contrast ratio.
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3; // WCAG 1.4.11: UI shapes and large text

describe('theme contrast (docs/DESIGN.md "Contrast checks")', () => {
  it.each([
    ['primary text on background', colors.textPrimary, colors.background],
    ['primary text on surface', colors.textPrimary, colors.surface],
    ['primary text on elevated', colors.textPrimary, colors.elevated],
    ['secondary text on background', colors.textSecondary, colors.background],
    ['secondary text on surface', colors.textSecondary, colors.surface],
    ['muted text on background', colors.textMuted, colors.background],
    ['accent text on background', colors.accent, colors.background],
    ['accent text on surface', colors.accent, colors.surface],
    ['dark text on an action fill', colors.background, colors.action],
    ['dark text on the light end of an action fill', colors.background, colors.accent],
    ['dark text on a selected fill', colors.background, colors.selected],
    ['selected text on surface', colors.selected, colors.surface],
    ['error text on background', colors.error, colors.background],
    ['error text on surface', colors.error, colors.surface],
    ['success text on background', colors.success, colors.background],
    ['info text on background', colors.info, colors.background],
  ])('%s meets AA for normal text', (_label, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each([
    ['action control on background', colors.action, colors.background],
    ['selected state on background', colors.selected, colors.background],
  ])('%s meets 3:1 for UI shapes', (_label, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it('cream text on mauve fails, which is why filled controls use dark text', () => {
    expect(contrast(colors.textPrimary, colors.action)).toBeLessThan(AA_TEXT);
  });
});
