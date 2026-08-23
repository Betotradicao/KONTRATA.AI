/** @type {import('tailwindcss').Config} */
// Cores lidas do CSS do site original (packages/site/referencia-base44/original.css).
// ATENCAO: a escala "purple" NAO e a padrao do Tailwind — mistura tons de
// purple e violet. Usar o purple padrao deixa a marca com a cor errada.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        purple: {
          50:  '#faf5ff', // rgb(250 245 255)
          100: '#ede9fe', // rgb(237 233 254)
          300: '#d8b4fe', // rgb(216 180 254)
          400: '#a78bfa', // rgb(167 139 250)
          600: '#7c3aed',
          800: '#5b21b6', // rgb(91 33 182)
        },
        amber: {
          400: '#fbbf24', // rgb(251 191 36)
          500: '#f59e0b',
        },
        'hero-bg': '#2e1065',      // rgb(46 16 101)
        'text-dark': '#1f1b2e',    // rgb(31 27 46)
        'text-gray': '#6b7280',    // rgb(107 114 128)
        'border-light': '#e5e7eb', // rgb(229 231 235)
        success: '#10b981',        // rgb(16 185 129)
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      keyframes: {
        // As 3 animacoes do hero, copiadas do original
        shimmer: {
          '0%':   { backgroundPosition: '0% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        marquee: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        meshMove: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':      { backgroundPosition: '100% 50%' },
        },
        // Sanfona do FAQ
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s linear infinite',
        marquee: 'marquee 28s linear infinite',
        meshMove: 'meshMove 10s ease infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
