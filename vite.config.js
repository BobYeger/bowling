import { defineConfig } from 'vite';
import { resolve } from 'path';

// ONLY=main / ONLY=pendel builds a single self-contained page (used for artifact publishing)
const only = process.env.ONLY;
const inputs = {
  main: resolve(__dirname, 'index.html'),
  pendel: resolve(__dirname, 'pendel.html'),
};

export default defineConfig({
  build: {
    rollupOptions: {
      input: only ? { [only]: inputs[only] } : inputs,
    },
  },
});
