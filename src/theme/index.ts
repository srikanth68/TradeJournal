import { useColorScheme } from 'react-native';

export const lightColors = {
  background:    '#FFFFFF',
  surface:       '#F5F5F5',
  surfaceHigh:   '#EBEBEB',    // distinct from surface for chips/controls inside cards
  surfaceDark:   '#DCDCDC',
  textPrimary:   '#1A1A1A',
  textSecondary: '#6B6B6B',
  textTertiary:  '#9B9B9B',
  sectionHeader: '#6B6B6B',
  border:        '#E8E8E8',
  separator:     '#E8E8E8',
  overlay:       'rgba(0,0,0,0.35)',
  profit:        '#2E7D32',
  loss:          '#C62828',
  warning:       '#E65100',    // amber/orange — used for grade C, warnings
  open:          '#C9A84C',
  primary:       '#C9A84C',
  primaryLight:  '#E8C96A',
  purple:        '#5856D6',    // indigo — used for selected emotion chips
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
  surfaceHigh:   '#EBEBEB',
  surfaceDark:   '#DCDCDC',
  textPrimary:   '#1A1A1A',
  textSecondary: '#6B6B6B',
  textTertiary:  '#9B9B9B',
  sectionHeader: '#6B6B6B',
  border:        '#E8E8E8',
  separator:     '#E8E8E8',
  overlay:       'rgba(0,0,0,0.35)',
  profit:        '#2E7D32',
  loss:          '#C62828',
  warning:       '#E65100',
  open:          '#C9A84C',
  primary:       '#C9A84C',
  primaryLight:  '#E8C96A',
  purple:        '#5856D6',
  longBadgeBg:   '#FDF8EC',
  shortBadgeBg:  '#FDE8E8',
  openBadgeBg:   '#FDF8EC',
  closedBadgeBg: '#E8F5E9',
  selectedRowBg: '#FDF8EC',
};

export type AppColors = typeof lightColors;

export const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 3,
};

export const cardShadowSubtle = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.04,
  shadowRadius: 4,
  elevation: 1,
};

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { colors: isDark ? darkColors : lightColors, isDark };
}
