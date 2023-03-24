/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/*.{js,jsx,ts,tsx}", "./public/*.{html,js}","./dist/*.{html,js}"],
  corePlugins: {
    // Remove Tailwind CSS's preflight style so it can use the MUI's preflight instead (CssBaseline).
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
}
