// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "dist/*",
      "sismoconnect/**",
      "src/profiles.ts",
      "src/rewards.ts",
      "src/social.ts",
      "src/sources.ts",
      "src/index.ts",
      "src/config.ts",
      "src/notifications.ts",
      "src/moderation.ts",
      "src/chats.ts",
    ],
  },
  {
    files: ["src/hooks/**/*.ts", "src/app/profile/edit.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  }
]);
