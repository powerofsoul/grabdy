import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import prettier from 'eslint-config-prettier';
import enforceDbId from '../../eslint-rules/enforce-dbid.js';
import enforceEntityTypeMap from '../../eslint-rules/enforce-entity-type-map.js';

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'dist/**', '.turbo/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
      local: {
        rules: {
          'enforce-dbid': enforceDbId,
          'enforce-entity-type-map': enforceEntityTypeMap,
        },
      },
    },
    rules: {
      // Branded ID enforcement
      'local/enforce-dbid': 'error',

      // NestJS uses empty constructors for DI
      '@typescript-eslint/no-empty-function': 'off',

      // TypeScript
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',

      // Import sorting: side-effects -> @nestjs -> external -> @fastdex -> relative
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^\\u0000'],
            ['^@nestjs/'],
            ['^@?\\w'],
            ['^@fastdex/'],
            ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
            ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
    },
  },

  // Migration files: enforce ENTITY_TYPE_MAP, disable branded ID checks
  {
    files: ['src/db/migrations/**/*.ts'],
    rules: {
      'local/enforce-entity-type-map': 'error',
      'local/enforce-dbid': 'off',
    },
  },

  prettier
);
