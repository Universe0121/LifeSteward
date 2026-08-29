import { Platform } from 'react-native';

export const light_colors = {
  ink: '#252525', muted: '#979797', canvas: '#F8F8F6', paper: '#FFFFFF', line: '#E9E9E6',
  blue: '#E8EDFB', blue_strong: '#6DA2FF', green: '#2DCC91', danger: '#A23C3C',
};
export const dark_colors = {
  ink: '#F7F7F5', muted: '#B7B7B2', canvas: '#171717', paper: '#242424', line: '#3C3C3A',
  blue: '#2A334A', blue_strong: '#9DBBFF', green: '#55D9A5', danger: '#FF9898',
};
export type ThemeColors = typeof light_colors;
export const spacing = { xs: 6, sm: 10, md: 16, lg: 24, xl: 30 };
export const typography = { regular: Platform.select({ android: 'sans-serif', default: 'System' }), medium: Platform.select({ android: 'sans-serif-medium', default: 'System' }) };
