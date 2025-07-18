import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['**/node_modules/**', 'docs/**']
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    // Additional per-file ignores unnecessary; handled globally above
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
      quotes: 'off',
      semi: 'off',
      'no-prototype-builtins': 'off',
      'no-useless-escape': 'off',
      'no-case-declarations': 'off',
      'no-empty': 'off',
      'no-undef': 'off',
      'no-extra-semi': 'off'
    }
  },
  {
    files: ['js/__tests__/**/*.js'],
    languageOptions: {
      globals: globals.jest
    }
  }
];
