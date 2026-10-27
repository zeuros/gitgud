// @ts-check
import eslint from '@eslint/js';
import {defineConfig} from 'eslint/config';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import sonarjs from 'eslint-plugin-sonarjs';

export default defineConfig(
  {ignores: ['dist/', 'docs/', 'src-tauri/', '.angular/', 'e2e/playwright-report/', 'e2e/test-results/']},
  {
    files: ['**/*.ts'],
    extends: [eslint.configs.recommended, tseslint.configs.recommended, angular.configs.tsRecommended],
    plugins: {sonarjs},
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/component-selector': ['error', {type: 'element', prefix: 'gitgud', style: 'kebab-case'}],
      '@angular-eslint/directive-selector': ['error', {type: 'attribute', prefix: 'gitgud', style: 'camelCase'}],
      // With verbatimModuleSyntax, what's imported only as a type must say so, or the import stays in the output
      '@typescript-eslint/consistent-type-imports': ['error', {fixStyle: 'inline-type-imports'}],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      // Points at functions too intricate to follow at a glance, without blocking the lint
      'sonarjs/cognitive-complexity': 'warn',
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended],
  },
);
