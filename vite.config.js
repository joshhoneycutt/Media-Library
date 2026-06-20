import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  },
  server: {
    host: true,
    proxy: {
      '/api/sheet/dvd': {
        target: 'https://docs.google.com',
        changeOrigin: true,
        rewrite: () => '/spreadsheets/d/10KfDZ5TpC34NemewyW9x6W9RKgp8L3qKVdnTA6eCbbs/gviz/tq?tqx=out:csv&sheet=DVD'
      },
      '/api/sheet': {
        target: 'https://docs.google.com',
        changeOrigin: true,
        rewrite: () => '/spreadsheets/d/10KfDZ5TpC34NemewyW9x6W9RKgp8L3qKVdnTA6eCbbs/gviz/tq?tqx=out:csv&gid=0'
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true
  }
})
