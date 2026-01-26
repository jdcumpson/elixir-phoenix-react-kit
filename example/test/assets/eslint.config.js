import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactPlugin from "eslint-plugin-react";
import importPlugin from "eslint-plugin-import";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: ["src/**/*.test.ts", "src/frontend/generated/*"],
  },
  {
    settings: {
      react: { version: "detect" },
    },
  },
  ...compat.extends(
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended"
  ),
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.node.json"],
        tsconfigRootDir: __dirname,
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      react: reactPlugin,
      import: importPlugin,
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "@typescript-eslint/strict-boolean-expressions": [
        2,
        {
          allowString: false,
          allowNumber: false,
          allowNullableBoolean: true,
          allowNullableObject: true,
          allowNullableString: true,
        },
      ],
      "react/jsx-curly-brace-presence": [
        1,
        { props: "never", children: "never", propElementValues: "always" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [".*"],
        },
      ],
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling"],
          pathGroups: [
            {
              pattern: "domains/**",
              group: "internal",
            },
            {
              pattern: "lib/**",
              group: "internal",
              position: "after",
            },
            {
              pattern: "components/**",
              group: "internal",
              position: "before",
            },
            {
              pattern: "react",
              group: "builtin",
              position: "before",
            },
          ],
          "newlines-between": "always",
          pathGroupsExcludedImportTypes: ["react", "builtin"],
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      "prefer-const": "off",
    },
  },
];
