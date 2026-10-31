// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    files: ["src/hooks/**/*.ts", "src/app/profile/edit.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  }
]);
