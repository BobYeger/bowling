import { defineConfig } from 'vite';
import { resolve } from 'path';

// ONLY=bowling / ONLY=pendel builds one game for artifact publishing.
// The default build (and legacy ONLY=main) includes the lobby and both linked games.
const only = process.env.ONLY;
const inputs = {
  main: resolve(__dirname, 'index.html'),
  bowling: resolve(__dirname, 'bowling.html'),
  pendel: resolve(__dirname, 'pendel.html'),
};

if (only && only !== 'main' && !inputs[only]) {
  throw new Error(`Unknown ONLY entry: ${only}`);
}

export default defineConfig({
  build: {
    rollupOptions: {
      input: only && only !== 'main' ? { [only]: inputs[only] } : inputs,
    },
  },
});
