import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  root: '.', 
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        gameloader: path.resolve(__dirname, 'gameloader.html'),
        leveleditor: path.resolve(__dirname, 'leveleditor.html'),
        levelstore: path.resolve(__dirname, 'levelstore.html'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return `${chunkInfo.name}.js`;
        },
        chunkFileNames: (chunkInfo) => {
          return `shared.js`;
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'styles.css'
          }
          return assetInfo.name || 'asset'
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    open: true,
    allowedHosts: true,
  },
})
