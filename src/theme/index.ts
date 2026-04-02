import { useColorScheme } from 'react-native';

export const lightColors = {
  background:    '#F2F2F7',
  surface:       '#FFFFFF',
  surfaceHigh:   '#F2F2F7',
  textPrimary:   '#1C1C1E',
  textSecondary: '#8E8E93',
  textTertiary:  '#C7C7CC',
  sectionHeader: '#6D6D72',
  border:        '#E5E5EA',
  separator:     '#E5E5EA',
  overlay:       'rgba(0,0,0,0.35)',
  profit:        '#34C759',
  loss:          '#FF3B30',
  open:          '#FF9500',
  primary:       '#007AFF',
  purple:        '#5856D6',
  longBadgeBg:   '#E5F1FF',
  shortBadgeBg:  '#FFE5E5',
  openBadgeBg:   '#FFF3E0',
  closedBadgeBg: '#E8F5E9',
  selectedRowBg: '#EBF5FF',
};

export const darkColors: typeof lightColors = {
  background:    '#000000',
  surface:       '#1C1C1E',
  surfaceHigh:   '#2C2C2E',
  textPrimary:   '#FFFFFF',
  textSecondary: '#8E8E93',
  textTertiary:  '#48484A',
  sectionHeader: '#8E8E93',
  border:        '#38383A',
  separator:     '#38383A',
  overlay:       'rgba(0,0,0,0.6)',
  profit:        '#30D158',
  loss:          '#FF453A',
  open:          '#FF9F0A',
  primary:       '#0A84FF',
  purple:        '#5E5CE6',
  longBadgeBg:   '#0A2A50',
  shortBadgeBg:  '#3D0A0A',
  openBadgeBg:   '#3D2000',
  closedBadgeBg: '#0A2A0A',
  selectedRowBg: '#0A2840',
};

export type AppColors = typeof lightColors;

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { colors: isDark ? darkColors : lightColors, isDark };
}
