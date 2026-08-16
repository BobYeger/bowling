import { defineConfig } from 'vite';
import { resolve } from 'path';

// ONLY=main / ONLY=pendel builds a single self-contained page (used for artifact publishing)
const only = process.env.ONLY;
const inputs = {
  main: resolve(__dirname, 'index.html'),
  pendel: resolve(__dirname, 'pendel.html'),
  schnitzel: resolve(__dirname, 'schnitzel.html'),
  dino: resolve(__dirname, 'dino.html'),
  punch: resolve(__dirname, 'punch.html'),
};

export default defineConfig({
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    strictPort: false,
  },
  build: {
    rollupOptions: {
      input: only ? { [only]: inputs[only] } : inputs,
    },
  },
});
