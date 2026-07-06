/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f4f6fa",
          100: "#e6eaf2",
          200: "#ccd5e5",
          300: "#a3b2cd",
          400: "#7188b0",
          500: "#4d6690",
          600: "#3b5175",
          700: "#31415e",
          800: "#2a374d",
          900: "#252f41",
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(15 23 42 / 0.04)",
        DEFAULT: "0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.06)",
      },
    },
  },
  plugins: [],
};
