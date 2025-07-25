import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
  server: {
    proxy: {
      '/api': {
        target: 'https://openapichatbot.radilov-k.workers.dev',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        code: resolve(__dirname, 'code.html'),
        forgotPassword: resolve(__dirname, 'forgot-password.html'),
        resetPassword: resolve(__dirname, 'reset-password.html'),
        extraMealEntry: resolve(__dirname, 'extra-meal-entry-form.html'),
        adaptiveQuizTemplate: resolve(__dirname, 'adaptive_quiz_template.html'),
        profileEdit: resolve(__dirname, 'profile-edit.html'),
        assistant: resolve(__dirname, 'assistant.html'),
      },
    },
  },
});
