import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import prettier from 'eslint-config-prettier/flat';
import { createNodeResolver, importX } from 'eslint-plugin-import-x';
import perfectionist from 'eslint-plugin-perfectionist';
import regexp from 'eslint-plugin-regexp';
import unicorn from 'eslint-plugin-unicorn';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

const LAYERS = [
  { except: ['./domain', './shared'], target: './src/domain' },
  { except: ['./application', './domain', './shared'], target: './src/application' },
  {
    except: ['./application', './config', './domain', './infrastructure', './shared'],
    target: './src/infrastructure',
  },
  { except: ['./config', './shared'], target: './src/config' },
  { except: ['./application/ports', './lifecycle', './shared'], target: './src/lifecycle' },
  { except: ['./shared'], target: './src/shared' },
];

export default defineConfig(
  globalIgnores(['dist', 'coverage']),
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  unicorn.configs.recommended,
  perfectionist.configs['recommended-natural'],
  regexp.configs.recommended,
  comments.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@eslint-community/eslint-comments/require-description': 'error',
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        { format: ['camelCase'], selector: 'default' },
        { format: ['camelCase', 'PascalCase'], selector: 'import' },
        { format: ['PascalCase'], selector: 'typeLike' },
        {
          format: ['camelCase'],
          leadingUnderscore: 'allow',
          modifiers: ['unused'],
          selector: 'parameter',
        },
        { format: ['UPPER_CASE'], modifiers: ['const', 'global'], selector: 'variable' },
        {
          format: ['camelCase'],
          modifiers: ['const', 'global'],
          selector: 'variable',
          types: ['function'],
        },
        { format: null, selector: ['objectLiteralProperty', 'typeProperty'] },
      ],
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      eqeqeq: 'error',
      'import-x/consistent-type-specifier-style': ['error', 'prefer-top-level'],
      'import-x/default': 'off',
      'import-x/first': 'error',
      'import-x/namespace': 'off',
      'import-x/newline-after-import': 'error',
      'import-x/no-absolute-path': 'error',
      'import-x/no-commonjs': 'error',
      'import-x/no-cycle': 'error',
      'import-x/no-default-export': 'error',
      'import-x/no-empty-named-blocks': 'error',
      'import-x/no-extraneous-dependencies': [
        'error',
        { devDependencies: ['test/**', '*.config.{js,ts}'] },
      ],
      'import-x/no-mutable-exports': 'error',
      'import-x/no-named-as-default-member': 'off',
      'import-x/no-relative-packages': 'error',
      'import-x/no-restricted-paths': [
        'error',
        {
          zones: [
            ...LAYERS.map(({ except, target }) => ({
              except,
              from: './src',
              message: 'This crosses the layer boundaries in docs/architecture.md.',
              target,
            })),
          ],
        },
      ],
      'import-x/no-self-import': 'error',
      'import-x/no-unresolved': 'off',
      'import-x/no-useless-path-segments': 'error',
      'no-console': 'error',
      'no-restricted-syntax': [
        'error',
        {
          message: 'Use #private members instead of the private and protected keywords.',
          selector: '[accessibility=/^(private|protected)$/]',
        },
      ],
      'perfectionist/sort-classes': ['error', { newlinesBetween: 1, newlinesInside: 'ignore' }],
      'perfectionist/sort-imports': [
        'error',
        { groups: ['builtin', 'external', ['parent', 'sibling', 'index'], 'unknown'] },
      ],
      'perfectionist/sort-union-types': ['error', { groups: ['unknown', 'nullish'] }],
      'unicorn/catch-error-name': ['error', { ignore: ['^caught$'] }],
      'unicorn/consistent-boolean-name': 'off',
      'unicorn/consistent-class-member-order': 'off',
      'unicorn/filename-case': ['error', { cases: { camelCase: true, pascalCase: true } }],
      'unicorn/import-style': ['error', { styles: { path: { named: true } } }],
      'unicorn/max-nested-calls': 'off',
      'unicorn/name-replacements': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/no-asterisk-prefix-in-documentation-comments': 'off',
      'unicorn/no-non-function-verb-prefix': 'off',
      'unicorn/no-null': 'off',
      'unicorn/no-this-outside-of-class': 'off',
      'unicorn/no-useless-undefined': ['error', { checkArrowFunctionBody: false }],
      'unicorn/prefer-await': 'off',
      'unicorn/prefer-event-target': 'off',
      'unicorn/prefer-ternary': 'off',
      'unicorn/prefer-then-catch': 'off',
      'unicorn/single-line-block-comment-style': 'off',
    },
    settings: {
      'import-x/resolver-next': [createNodeResolver()],
      perfectionist: { type: 'natural' },
    },
  },
  {
    files: ['src/domain/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: [{ message: 'The domain has no external dependencies.', regex: '^[^.]' }] },
      ],
    },
  },
  {
    files: ['src/application/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              allowTypeImports: true,
              message: 'The application reaches the outside world only through its ports.',
              regex: '^[^.]',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['test/fixtures/ffmpeg/**'],
    rules: {
      'unicorn/filename-case': ['error', { case: 'kebabCase' }],
    },
  },
  {
    files: ['src/main.ts'],
    rules: {
      'unicorn/no-process-exit': 'off',
    },
  },
  {
    extends: [vitest.configs.recommended],
    files: ['test/**'],
    rules: {
      'vitest/consistent-test-it': ['error', { fn: 'it', withinDescribe: 'it' }],
      'vitest/hoisted-apis-on-top': 'error',
      'vitest/no-alias-methods': 'error',
      'vitest/no-conditional-expect': 'error',
      'vitest/no-conditional-tests': 'error',
      'vitest/no-disabled-tests': 'error',
      'vitest/no-duplicate-hooks': 'error',
      'vitest/no-focused-tests': 'error',
      'vitest/no-standalone-expect': 'error',
      'vitest/no-test-prefixes': 'error',
      'vitest/no-test-return-statement': 'error',
      'vitest/prefer-comparison-matcher': 'error',
      'vitest/prefer-describe-function-title': 'error',
      'vitest/prefer-equality-matcher': 'error',
      'vitest/prefer-hooks-in-order': 'error',
      'vitest/prefer-hooks-on-top': 'error',
      'vitest/prefer-mock-promise-shorthand': 'error',
      'vitest/prefer-spy-on': 'error',
      'vitest/prefer-to-be': 'error',
      'vitest/prefer-to-contain': 'error',
      'vitest/prefer-to-have-length': 'error',
      'vitest/prefer-todo': 'error',
      'vitest/prefer-vi-mocked': 'error',
      'vitest/require-to-throw-message': 'error',
      'vitest/require-top-level-describe': 'error',
      'vitest/valid-expect-in-promise': 'error',
    },
    settings: { vitest: { typecheck: true } },
  },
  {
    files: ['*.config.{js,ts}'],
    rules: {
      'import-x/no-default-export': 'off',
    },
  },
  {
    extends: [tseslint.configs.disableTypeChecked],
    files: ['eslint.config.js'],
    rules: {
      '@typescript-eslint/naming-convention': 'off',
    },
  },
  prettier,
);
