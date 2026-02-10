import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactRefresh from 'eslint-plugin-react-refresh';
import sonarjs from 'eslint-plugin-sonarjs';
import unusedImports from 'eslint-plugin-unused-imports';
import tanstackQuery from '@tanstack/eslint-plugin-query';
import tanstackRouter from '@tanstack/eslint-plugin-router';

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'dist/**', '.turbo/**', 'routeTree.gen.ts'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  sonarjs.configs.recommended,

  ...tanstackQuery.configs['flat/recommended'],
  ...tanstackRouter.configs['flat/recommended'],

  jsxA11y.flatConfigs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'simple-import-sort': simpleImportSort,
      'react-refresh': reactRefresh,
      'unused-imports': unusedImports,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,

      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      'react-refresh/only-export-components': 'off',

      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',

      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^react', '^react-dom'],
            ['^@?\\w'],
            ['^@fastdex/'],
            ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
            ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
            ['^\\u0000'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',

      'sonarjs/cognitive-complexity': ['warn', 30],
      'sonarjs/no-duplicate-string': ['warn', { threshold: 6 }],
      'sonarjs/todo-tag': 'off',
      'sonarjs/no-nested-conditional': 'off',
      'sonarjs/pseudo-random': 'off',
      'sonarjs/slow-regex': 'warn',
      'sonarjs/no-nested-template-literals': 'off',
      'sonarjs/no-nested-functions': 'off',
      'sonarjs/single-character-alternation': 'warn',
      'sonarjs/no-small-switch': 'off',

      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/no-autofocus': 'warn',
    },
  },

  prettier
);
