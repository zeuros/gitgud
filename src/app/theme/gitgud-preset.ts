import { definePreset, palette } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

// ── Brand primary palette ──────────────────────────────────────────────────────
// Single definition used by PrimeNG to generate all --p-primary-* CSS vars.
// Removes the need for --plum, --orchid, etc. CSS variables.
// 500 = plum (#8E4E8C) is the light-theme primary; dark overrides .color below.
// ──────────────────────────────────────────────────────────────────────────────
const brandPrimary = {
  50:  '#FF7DF4',
  100: '#E874DF',
  200: '#D26ACA',
  300: '#BB61B5',
  400: '#A457A0',
  500: '#8E4E8C',
  600: '#774477',
  700: '#603A62',
  800: '#49314D',
  900: '#332838',
  950: '#1C1E23',
};

export const GitgudPreset = definePreset(Aura, {
  components: {
    toast: {
      colorScheme: {
        dark: {
          info:    { background: 'color-mix(in srgb, color-mix(in srgb, {blue.500} 20%, {surface.900}) 85%, transparent)' },
          success: { background: 'color-mix(in srgb, color-mix(in srgb, {green.500} 20%, {surface.900}) 85%, transparent)' },
          warn:    { background: 'color-mix(in srgb, color-mix(in srgb, {yellow.500} 20%, {surface.900}) 85%, transparent)' },
          error:   { background: 'color-mix(in srgb, color-mix(in srgb, {red.500} 20%, {surface.900}) 85%, transparent)' },
        },
      },
    },
  },
  semantic: {
    primary: brandPrimary,

    colorScheme: {
      light: {
        primary: {
          color:         '{primary.500}',  // #8E4E8C
          contrastColor: '#ffffff',
          hoverColor:    '{primary.600}',  // #774477
          activeColor:   '{primary.700}',  // #603A62
        },
        // Zinc: neutral grays (50=#fafafa, 300=#d4d4d8, 700=#3f3f46)
        surface: palette('{zinc}'),
      },
      dark: {
        primary: {
          color:         '#ce93d8',  // lighter pastel for readability on dark bg
          contrastColor: '#ffffff',
          hoverColor:    '#ba68c8',
          activeColor:   '#ab47bc',
        },
        // Custom purple-dark surface — replaces the old --p-zinc-* SCSS overrides
        surface: {
          0:   '#ffffff',
          50:  '#d1ddfb',
          100: '#c8d1e6',
          200: '#bbc5e4',
          300: '#b0bee1',
          400: '#9ea9c8',
          500: '#585e6e',
          600: '#4b515e',
          700: '#3a3d47',
          800: '#2c2d37',
          900: '#1c1e23',
          950: 'rgba(31, 32, 37, 0.92)',
        },
      },
    },
  },
});

export const primeNGConfig = {
  theme: {
    preset: GitgudPreset,
    options: {
      cssLayer: {
        name: 'primeng',
        order: 'primeng, my-theme',
      },
      darkModeSelector: '.dark',
    },
  },
};
