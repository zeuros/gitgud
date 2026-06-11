import {computeGraphColors} from '../utils/color-utils';

export type ThemeMode = 'dark' | 'light' | 'system';
export type MonacoTheme = 'gitgud-dark' | 'gitgud-light';

export interface CanvasColors {
  primary: string;  // node/edge base color (hue-rotated per branch)
  graphColors: string[];  // 7 pre-computed hue-rotated colors, indexed by indent
  background: string;  // index node fill = app background
  avatarRing: string;  // ring drawn before avatar image
  nodeShadowColor: string;  // shadowColor for node glow + initials text shadow
  nodeShadowBlur: number;  // shadowColor for node glow + initials text shadow
}

export interface ThemeTokens {
  canvas: CanvasColors;
  monacoTheme: MonacoTheme;
}

export const DARK_TOKENS: ThemeTokens = {
  canvas: {
    primary: 'rgba(206, 147, 216, 0.9)',
    graphColors: computeGraphColors('rgb(188,135,198)'),
    background: '#1c1e23',
    avatarRing: '#29262c',
    nodeShadowColor: 'rgba(0, 0, 0, 0.8)',
    nodeShadowBlur: 10,
  },
  monacoTheme: 'gitgud-dark',
};

export const LIGHT_TOKENS: ThemeTokens = {
  canvas: {
    primary: 'rgb(142 78 140 / 0.6)',
    graphColors: computeGraphColors('rgb(183,144,183)'),
    background: '#f5f4f8',
    avatarRing: '#ede9f4',
    nodeShadowColor: 'rgba(0, 0, 0, 0.1)',
    nodeShadowBlur: 2,
  },
  monacoTheme: 'gitgud-light',
};

export const themeOptions = Object.entries({
  system: {label: 'System'},
  dark: {label: 'Dark'},
  light: {label: 'Light'},
} satisfies Record<ThemeMode, { label: string }>).map(
  ([value, {label}]) => ({label, value: value as ThemeMode}),
);
