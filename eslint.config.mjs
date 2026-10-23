// @ts-check
import eslint from '@eslint/js';
import {defineConfig} from 'eslint/config';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

export default defineConfig(
  {ignores: ['dist/', 'docs/', 'src-tauri/', '.angular/', 'e2e/playwright-report/', 'e2e/test-results/']},
  {
    files: ['**/*.ts'],
    extends: [eslint.configs.recommended, tseslint.configs.recommended, angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/component-selector': ['error', {type: 'element', prefix: 'gitgud', style: 'kebab-case'}],
      '@angular-eslint/directive-selector': ['error', {type: 'attribute', prefix: 'gitgud', style: 'camelCase'}],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended],
  },
);
