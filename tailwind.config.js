/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./src/webview/**/*.{ts,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          'chart-blue': '#8884d8',
          'chart-green': '#82ca9d',
        },
      },
    },
    plugins: [],
  }
  