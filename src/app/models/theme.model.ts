import {computeGraphColors} from '../utils/color-utils';

export type ThemeMode = 'dark' | 'light' | 'forest' | 'submarine' | 'darcula' | 'one-rainbow';

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

export interface ThemeDefinition {
  id: ThemeMode;
  label: string;
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

export const FOREST_TOKENS: ThemeTokens = {
  canvas: {
    primary: 'rgba(120, 201, 126, 0.9)',
    graphColors: computeGraphColors('rgb(100,190,100)'),
    background: '#1b2520',
    avatarRing: '#243028',
    nodeShadowColor: 'rgba(0, 0, 0, 0.8)',
    nodeShadowBlur: 10,
  },
  monacoTheme: 'gitgud-dark',
};

export const SUBMARINE_TOKENS: ThemeTokens = {
  canvas: {
    primary: 'rgba(41, 182, 216, 0.9)',
    graphColors: computeGraphColors('rgb(41,182,216)'),
    background: '#0e1c2a',
    avatarRing: '#132438',
    nodeShadowColor: 'rgba(0, 0, 0, 0.8)',
    nodeShadowBlur: 10,
  },
  monacoTheme: 'gitgud-dark',
};

export const DARCULA_TOKENS: ThemeTokens = {
  canvas: {
    primary: 'rgba(204, 120, 50, 0.9)',
    graphColors: computeGraphColors('rgb(204,120,50)'),
    background: '#2b2b2b',
    avatarRing: '#3a3535',
    nodeShadowColor: 'rgba(0, 0, 0, 0.8)',
    nodeShadowBlur: 10,
  },
  monacoTheme: 'gitgud-dark',
};

export const ONE_RAINBOW_TOKENS: ThemeTokens = {
  canvas: {
    primary: 'rgba(255, 0, 204, 0.95)',
    graphColors: computeGraphColors('rgb(255,0,0)'),  // pure red → full saturated rainbow
    background: '#07001a',
    avatarRing: '#1a0038',
    nodeShadowColor: 'rgba(255, 0, 200, 0.55)',
    nodeShadowBlur: 14,
  },
  monacoTheme: 'gitgud-dark',
};

export const THEME_TOKENS: Partial<Record<ThemeMode, ThemeTokens>> = {
  dark: DARK_TOKENS,
  light: LIGHT_TOKENS,
  forest: FOREST_TOKENS,
  submarine: SUBMARINE_TOKENS,
  darcula: DARCULA_TOKENS,
  'one-rainbow': ONE_RAINBOW_TOKENS,
};

export const THEMES: ThemeDefinition[] = [
  {id: 'dark',        label: 'Dark'},
  {id: 'light',       label: 'Light'},
  {id: 'forest',      label: 'Forest'},
  {id: 'submarine',   label: 'Submarine'},
  {id: 'darcula',     label: 'Darcula'},
  {id: 'one-rainbow', label: 'One Rainbow'},
];
