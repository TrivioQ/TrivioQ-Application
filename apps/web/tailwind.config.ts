import type { Config } from 'tailwindcss';

/**
 * Compose a Tailwind color entry that reads from a CSS variable.
 * The variable value is an RGB triplet; Tailwind's `<alpha-value>`
 * placeholder is replaced with the opacity at usage sites
 * (e.g. `bg-brand-500/40` → `rgb(var(--brand-500) / 0.4)`).
 */
const varColor = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: varColor('bg-primary'),
          secondary: varColor('bg-secondary'),
        },
        surface: {
          DEFAULT: varColor('surface-elevated'),
        },
        text: {
          DEFAULT: varColor('text-primary'),
          muted: varColor('text-secondary'),
        },
        border: {
          DEFAULT: varColor('border-color'),
        },
        brand: {
          50: varColor('brand-50'),
          100: varColor('brand-100'),
          300: varColor('brand-300'),
          400: varColor('brand-400'),
          500: varColor('brand-500'),
          600: varColor('brand-600'),
          700: varColor('brand-700'),
          800: varColor('brand-800'),
          900: varColor('brand-900'),
          accent: {
            500: varColor('brand-accent-500'),
            600: varColor('brand-accent-600'),
            700: varColor('brand-accent-700'),
          },
        },
        success: varColor('success'),
        warning: varColor('warning'),
        error: varColor('error'),
        info: varColor('info'),
        overlay: varColor('overlay-scrim'),
        glass: {
          bg: varColor('glass-bg'),
          border: varColor('glass-border'),
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
export default config;
