import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    lib: {
      entry: 'src/index.jsx',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [],
    },
    minify: true,
    outDir: 'dist',
  },
});
