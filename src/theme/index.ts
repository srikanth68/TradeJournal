import { useColorScheme } from 'react-native';

export const lightColors = {
  background:    '#FFFFFF',
  surface:       '#F5F5F5',
  surfaceHigh:   '#F5F5F5',
  surfaceDark:   '#E8E8E8',
  textPrimary:   '#1A1A1A',
  textSecondary: '#6B6B6B',
  textTertiary:  '#9B9B9B',
  sectionHeader: '#6B6B6B',
  border:        '#E8E8E8',
  separator:     '#E8E8E8',
  overlay:       'rgba(0,0,0,0.35)',
  profit:        '#2E7D32',
  loss:          '#C62828',
  open:          '#C9A84C',
  primary:       '#C9A84C',
  primaryLight:  '#E8C96A',
  purple:        '#6B6B6B',
  longBadgeBg:   '#FDF8EC',
  shortBadgeBg:  '#FDE8E8',
  openBadgeBg:   '#FDF8EC',
  closedBadgeBg: '#E8F5E9',
  selectedRowBg: '#FDF8EC',
};

// Dark mode mirrors light — this app uses a single white/gray/gold theme
export const darkColors: typeof lightColors = {
  background:    '#FFFFFF',
  surface:       '#F5F5F5',
  surfaceHigh:   '#F5F5F5',
  surfaceDark:   '#E8E8E8',
  textPrimary:   '#1A1A1A',
  textSecondary: '#6B6B6B',
  textTertiary:  '#9B9B9B',
  sectionHeader: '#6B6B6B',
  border:        '#E8E8E8',
  separator:     '#E8E8E8',
  overlay:       'rgba(0,0,0,0.35)',
  profit:        '#2E7D32',
  loss:          '#C62828',
  open:          '#C9A84C',
  primary:       '#C9A84C',
  primaryLight:  '#E8C96A',
  purple:        '#6B6B6B',
  longBadgeBg:   '#FDF8EC',
  shortBadgeBg:  '#FDE8E8',
  openBadgeBg:   '#FDF8EC',
  closedBadgeBg: '#E8F5E9',
  selectedRowBg: '#FDF8EC',
};

export type AppColors = typeof lightColors;

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { colors: isDark ? darkColors : lightColors, isDark };
}
