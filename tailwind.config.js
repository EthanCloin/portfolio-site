/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/*.html"],
  theme: {
    extend: {
      fontFamily: {
        mulish: ["Mulish", "sans-serif"],
        domine: ["Domine", "serif"],
      },
      colors: {
        fern: {
          50: "#ecf4ea",
          100: "#d1e3cb",
          200: "#b5d1ab",
          300: "#9ac08b",
          400: "#86b374",
          500: "#75a65e",
          600: "#6b9855",
          700: "#5e864b",
          800: "#547543",
          900: "#415635",
        },
        sage: {
          50: "#eeffe7",
          100: "#e9fde2",
          200: "#e5f8de",
          300: "#e0f4d9",
          400: "#bfd2b8",
          500: "#a2b59b",
          600: "#788a72",
          700: "#63755e",
          800: "#44553f",
          900: "#22321e",
        },
        sienna: {
          50: "#fcedee",
          100: "#f9d1d2",
          200: "#e4a29b",
          300: "#d78076",
          400: "#de6954",
          500: "#e05f3d",
          600: "#d2573b",
          700: "#c14e36",
          800: "#b34830",
          900: "#a53f25",
        },
        cocoa: {
          50: "#ffdecc",
          100: "#f1b8ab",
          200: "#cd9083",
          300: "#a9685b",
          400: "#904b3f",
          500: "#762f23",
          600: "#6b271e",
          700: "#5b1b16",
          800: "#4c0e10",
          900: "#3c0000"
        },
        parchment: {
          light: "#EFEFE7",
          DEFAULT: "#DEDDCE",
          dark: "#BFB99C",
        },
      },
    },
  },
  plugins: [],
};
