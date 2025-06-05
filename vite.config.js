import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        code: resolve(__dirname, 'code.html'),
        forgotPassword: resolve(__dirname, 'forgot-password.html'),
        extraMealEntry: resolve(__dirname, 'extra-meal-entry-form.html'),
        adaptiveQuizTemplate: resolve(__dirname, 'adaptive_quiz_template.html'),
      },
    },
  },
});
