import type { Config } from "tailwindcss";

export default {
  content: ["index.html", "./src/renderer/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
