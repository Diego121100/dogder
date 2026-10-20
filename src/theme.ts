import { useColorScheme } from 'react-native';

/**
 * Paleta de Dogder, la misma del prototipo: verde pelota de tenis, azul marino de collar,
 * verde pasto y coral de correa. Cada color existe en versión clara y oscura.
 */
const light = {
  bg: '#EEF1E6',
  surface: '#FFFFFF',
  ink: '#18233A',
  muted: '#5D6678',
  line: '#D9DECF',
  ball: '#C9E23F',
  ballInk: '#18233A',
  coral: '#F2634A',
  grass: '#2E9D6A',
  sky: '#3B82C4',
  welcomeBg: '#18233A',
  welcomeMuted: '#C7CEDB',
};

const dark: typeof light = {
  bg: '#10151F',
  surface: '#1A2230',
  ink: '#EEF1E6',
  muted: '#9AA3B5',
  line: '#2B3546',
  ball: '#C9E23F',
  ballInk: '#18233A',
  coral: '#FF7A62',
  grass: '#3FBF85',
  sky: '#6AA8E0',
  welcomeBg: '#0B1120',
  welcomeMuted: '#C7CEDB',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Nombres de las fuentes cargadas en el layout raíz. */
export const fonts = {
  display: 'BricolageGrotesque_800ExtraBold',
  displaySemi: 'BricolageGrotesque_600SemiBold',
  body: 'NunitoSans_400Regular',
  bodySemi: 'NunitoSans_600SemiBold',
  bodyBold: 'NunitoSans_800ExtraBold',
};

export const radius = { sm: 12, md: 14, lg: 20, pill: 999 };
export const space = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24 };
