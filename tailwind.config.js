/** @type {import('tailwindcss').Config} */
// Les couleurs viennent de variables CSS (src/index.css), clair et sombre.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        surface2: v('surface2'),
        line: v('line'),
        ink: v('ink'),
        muted: v('muted'),
        accent: v('accent'),
        'on-accent': v('on-accent'),
        'accent-ink': v('accent-ink'),
        ok: v('ok'),
        warn: v('warn'),
        danger: v('danger'),
      },
      borderRadius: { card: 'var(--radius-card)', btn: 'var(--radius-btn)' },
      fontFamily: { display: 'var(--font-display)', body: 'var(--font-body)' },
    },
  },
  plugins: [],
}
