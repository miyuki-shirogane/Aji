import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import { fileURLToPath } from 'node:url'
import manifest from './manifest.config'

const emptyStub = new URL('./src/stubs/empty.ts', import.meta.url).pathname
const offscreenHtml = fileURLToPath(new URL('./src/offscreen/offscreen.html', import.meta.url))

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    rollupOptions: {
      input: {
        offscreen: offscreenHtml,
      },
    },
  },
  resolve: {
    alias: {
      // transformers.js guards these behind a node env check; stub so the
      // browser bundle does not try to resolve node-only packages.
      'onnxruntime-node': emptyStub,
      sharp: emptyStub,
    },
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
})
