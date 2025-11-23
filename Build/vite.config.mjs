import { defineConfig } from 'vite'
import path from 'path'
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  root: '.', 
  publicDir: 'public',
  base: "./",
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['robots.txt'],
      manifest: {
        name: 'Teleporter Dash',
        short_name: 'TD',
        start_url: './',
        display: 'standalone',
        theme_color: '#0f9d58',
        background_color: '#00bfff',
      },
      pwaAssets: {
        image: 'public/favicon.png',
        preset: 'minimal-2023',
        includeHtmlHeadLinks: true,
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /.*\.(js|css|html)$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'app-shell' },
          },
          {
            urlPattern: /.*\.(png|ico|json)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'assets' },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        TDLoader: path.resolve(__dirname, 'TDLoader.html'),
        TDEditor: path.resolve(__dirname, 'TDEditor.html'),
        TDStore: path.resolve(__dirname, 'TDStore.html'),
      }
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
