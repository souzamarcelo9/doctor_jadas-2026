/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefcfb",
          100: "#d3f6f3",
          200: "#a8ede7",
          300: "#71ddd6",
          400: "#3fc4c0",
          500: "#22a6a6",
          600: "#178a8c",
          700: "#166f72",
          800: "#17595c",
          900: "#164a4d",
          950: "#082c2e",
        },
        ink: {
          900: "#0f2530",
          700: "#28414d",
          500: "#5a7683",
        },
      },
      fontFamily: {
        display: ["'Sora'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,37,48,0.06), 0 4px 16px rgba(15,37,48,0.06)",
        pop: "0 12px 32px rgba(8,44,46,0.18)",
      },
      borderRadius: {
        xl2: "1.1rem",
      },
      keyframes: {
        pulseRing: {
          "0%": { boxShadow: "0 0 0 0 rgba(34,166,166,0.45)" },
          "70%": { boxShadow: "0 0 0 12px rgba(34,166,166,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(34,166,166,0)" },
        },
        wave: {
          "0%, 100%": { transform: "scaleY(0.3)" },
          "50%": { transform: "scaleY(1)" },
        },
        slideIn: {
          "0%": { opacity: 0, transform: "translateY(6px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
      animation: {
        pulseRing: "pulseRing 1.8s infinite",
        wave: "wave 1s ease-in-out infinite",
        slideIn: "slideIn 0.35s ease-out",
      },
    },
  },
  plugins: [],
}
