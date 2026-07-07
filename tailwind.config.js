/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },
      colors: {
        ink: {
          50: "#f6f7fb",
          100: "#eceef6",
          200: "#d7dbe9",
          300: "#b3bad2",
          400: "#8a93b5",
          500: "#697099",
          600: "#525879",
          700: "#3f4460",
          800: "#2a2e44",
          900: "#191c2e",
          950: "#0d0f1c",
        },
        pg: {
          blue: {
            50: "#eef3ff",
            100: "#dbe6fe",
            200: "#bfd2fe",
            300: "#93b4fd",
            400: "#608cfa",
            500: "#3c66f5",
            600: "#2649ea",
            700: "#1e3a8a",
            800: "#1d3478",
            900: "#172554",
            950: "#0f1a3d",
          },
          cyan: {
            300: "#67e8f9",
            400: "#22d3ee",
            500: "#06b6d4",
            600: "#0891b2",
          },
          lime: {
            400: "#a3e635",
            500: "#84cc16",
          },
        },
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16, 24, 40, 0.03), 0 4px 14px -10px rgba(16, 24, 40, 0.10)",
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 0 rgba(255,255,255,0.6) inset",
        elevated:
          "0 1px 2px rgba(16, 24, 40, 0.05), 0 18px 40px -22px rgba(15, 26, 61, 0.22)",
        glow: "0 0 0 1px rgba(6, 182, 212, 0.22), 0 16px 40px -18px rgba(6, 182, 212, 0.5)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "rise": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "20%": { opacity: "0.5" },
          "100%": { opacity: "0", transform: "translateY(-14px)" },
        },
        "sheen": {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(220%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        "rise": "rise 1.6s ease-out infinite",
        "sheen": "sheen 2.4s ease-in-out infinite",
      },
      backgroundImage: {
        "pg-gradient":
          "linear-gradient(135deg, #0f1a3d 0%, #1e3a8a 55%, #0891b2 130%)",
        "brand-mesh":
          "radial-gradient(1100px 520px at 88% -8%, rgba(6,182,212,0.10), transparent 60%), radial-gradient(820px 480px at -6% 8%, rgba(60,102,245,0.08), transparent 58%)",
      },
    },
  },
  plugins: [],
};
