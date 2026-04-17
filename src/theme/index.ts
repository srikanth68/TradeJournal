import { useColorScheme } from 'react-native';

export const lightColors = {
  background:    '#F2F2F7',
  surface:       '#FFFFFF',
  surfaceHigh:   '#F2F2F7',
  surfaceMid:    '#F8F8FA',
  textPrimary:   '#1C1C1E',
  textSecondary: '#6E6E73',
  textTertiary:  '#AEAEB2',
  sectionHeader: '#6D6D72',
  border:        '#E5E5EA',
  separator:     '#E5E5EA',
  overlay:       'rgba(0,0,0,0.35)',
  profit:        '#00B057',
  loss:          '#FF3B30',
  open:          '#FF9500',
  primary:       '#007AFF',
  purple:        '#5856D6',
  teal:          '#32ADE6',
  longBadgeBg:   '#EAF4FF',
  shortBadgeBg:  '#FFF0EE',
  openBadgeBg:   '#FFF3E0',
  closedBadgeBg: '#E6FAF0',
  selectedRowBg: '#EBF5FF',
  // Card shadow shorthand (used inline as props)
  cardShadow: '#000',
};

export const darkColors: typeof lightColors = {
  background:    '#0A0A0F',
  surface:       '#1C1C1E',
  surfaceHigh:   '#2C2C2E',
  surfaceMid:    '#242426',
  textPrimary:   '#F5F5F7',
  textSecondary: '#98989F',
  textTertiary:  '#48484A',
  sectionHeader: '#8E8E93',
  border:        '#2C2C2E',
  separator:     '#2C2C2E',
  overlay:       'rgba(0,0,0,0.65)',
  profit:        '#30D158',
  loss:          '#FF453A',
  open:          '#FF9F0A',
  primary:       '#0A84FF',
  purple:        '#5E5CE6',
  teal:          '#64D2FF',
  longBadgeBg:   '#0D2A45',
  shortBadgeBg:  '#3D0F0A',
  openBadgeBg:   '#3A1E00',
  closedBadgeBg: '#0A2A14',
  selectedRowBg: '#0A2840',
  cardShadow: '#000',
};

export type AppColors = typeof lightColors;

// Shared shadow style for all elevated cards
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
