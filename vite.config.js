import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const sheetId = env.GOOGLE_SHEET_ID
  if (!sheetId) throw new Error('GOOGLE_SHEET_ID is not set in .env.local')

  return {
    plugins: [vue()],
    resolve: {
      alias: { '@': resolve(__dirname, 'src') }
    },
    server: {
      host: true,
      proxy: {
        '/api/review': {
          target: 'http://localhost:3334',
          changeOrigin: true,
        },
        '/api/sheet/dvd': {
          target: 'https://docs.google.com',
          changeOrigin: true,
          rewrite: () => `/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=DVD`
        },
        '/api/sheet': {
          target: 'https://docs.google.com',
          changeOrigin: true,
          rewrite: () => `/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=0`
        }
      }
    },
    test: {
      environment: 'jsdom',
      globals: true
    }
  }
})
