/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Manrope", "Inter", "system-ui", "sans-serif"]
      },
      colors: {
        brand: {
          purple: "#351080",
          royal: "#5720B8",
          green: "#078D67",
          orange: "#F28A19",
          navy: "#17223B",
          surface: "#F5F6FA"
        }
      }
    }
  },
  plugins: []
};
