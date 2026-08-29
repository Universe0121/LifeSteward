import { Platform } from 'react-native';

export const colors = {
  ink: '#173126',
  muted: '#6B7D73',
  soft: '#EDF4EF',
  border: '#DCE8DF',
  paper: '#FFFFFF',
  canvas: '#F6F9F7',
  primary: '#28784D',
  primaryDark: '#195B38',
  sky: '#E7F1F7',
  skyInk: '#2B6074',
  peach: '#FFF0E6',
  peachInk: '#9A5B36',
  danger: '#A23C3C',
};

export const spacing = { xs: 6, sm: 10, md: 16, lg: 22, xl: 30 };

export const typography = {
  regular: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  medium: Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'System' }),
};
