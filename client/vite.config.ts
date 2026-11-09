import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  // Le .env unique est à la racine du monorepo ; seules les variables VITE_* sont exposées.
  envDir: '..',
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173 },
});
