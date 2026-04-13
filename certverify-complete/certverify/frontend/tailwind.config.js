/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Playfair Display'", "Georgia", "serif"],
        body:    ["'DM Sans'", "sans-serif"],
        mono:    ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        ink: {
          950: "#080c14",
          900: "#0d1424",
          800: "#131d30",
          700: "#1a2640",
          600: "#243350",
        },
        gold: {
          300: "#f0d080",
          400: "#e0b840",
          500: "#c9971a",
        },
        jade: {
          400: "#34c98a",
          500: "#22a870",
        },
        crimson: {
          400: "#f05070",
          500: "#e03050",
        },
        slate: { 350: "#7a8a9a" },
      },
      boxShadow: {
        glow:      "0 0 30px rgba(201,151,26,0.15)",
        "glow-jade":"0 0 20px rgba(34,168,112,0.2)",
        card:      "0 1px 3px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.3)",
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease forwards",
        "fade-in": "fadeIn 0.4s ease forwards",
      },
      keyframes: {
        fadeUp:  { from: { opacity: 0, transform: "translateY(16px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
      },
    },
  },
  plugins: [],
};
