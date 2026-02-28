import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        yt: {
          red: "#FF0000",
          "red-hover": "#CC0000",
          "red-dark": "#990000",
          black: "#0F0F0F",
          "dark-1": "#181818",
          "dark-2": "#212121",
          "dark-3": "#272727",
          "dark-4": "#3F3F3F",
          white: "#FFFFFF",
          "gray-1": "#AAAAAA",
          "gray-2": "#717171",
          "gray-3": "#606060",
        },
      },
      fontFamily: {
        sans: ["Roboto", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
