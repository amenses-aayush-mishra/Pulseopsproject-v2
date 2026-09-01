/** @type {import('tailwindcss').Config} */
module.exports = {
  // Class-based dark mode: toggled by adding/removing `class="dark"` on <html>.
  // next-themes (Phase 2) handles this automatically; no flash on reload.
  darkMode: 'class',
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
