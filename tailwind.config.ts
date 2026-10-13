import type { Config } from 'tailwindcss';

const c = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: c('--c-bg'),
        surface: c('--c-surface'),
        'surface-2': c('--c-surface-2'),
        ink: c('--c-text'),
        muted: c('--c-muted'),
        line: c('--c-border'),
        brand: c('--c-brand'),
        'brand-soft': c('--c-brand-soft'),
        ok: c('--c-ok'),
        bad: c('--c-bad'),
        warn: c('--c-warn'),
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'sans-serif'],
        serif: ['ui-serif', 'Georgia', 'Cambria', 'Times New Roman', 'Songti SC', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: { xl2: '1.15rem' },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -12px rgb(0 0 0 / 0.12)',
      },
      maxWidth: { content: '72rem' },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: { rise: 'rise .22s ease-out both' },
    },
  },
  plugins: [],
} satisfies Config;
