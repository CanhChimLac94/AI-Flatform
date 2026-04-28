import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: "#111827",
        "chat-bg": "#1f2937",
        "input-bg": "#374151",
        accent: "#6366f1",
        "accent-hover": "#4f46e5",
      },
      animation: {
        "pulse-dot": "pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-in": "slideIn 0.2s ease-out",
      },
      keyframes: {
        slideIn: {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
