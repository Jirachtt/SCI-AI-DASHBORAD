import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'
import mjuDashboardSyncHandler from './api/mju-dashboard-sync.js'
import geminiChatHandler from './api/gemini-chat.js'

function localApiDev() {
  return {
    name: 'local-vercel-function-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost')
        const path = url.pathname

        if (path === '/api/mju-dashboard-sync') {
          req.query = Object.fromEntries(url.searchParams.entries())
          await mjuDashboardSyncHandler(req, res)
          return
        }

        if (path === '/api/gemini-chat') {
          req.query = Object.fromEntries(url.searchParams.entries())
          await geminiChatHandler(req, res)
          return
        }

        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value
  }

  return {
    plugins: [react(), localApiDev()],
    define: {
      global: 'window', // Polyfill for react-grid-layout
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (id.includes('firebase')) return 'vendor-firebase'
            if (id.includes('xlsx')) return 'vendor-xlsx'
            if (id.includes('chart.js') || id.includes('react-chartjs-2') || id.includes('recharts')) return 'vendor-charts'
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) return 'vendor-react'
            if (id.includes('lucide-react')) return 'vendor-icons'
            return undefined
          },
        },
      },
    },
    server: {
      allowedHosts: true,
      host: true // also good practice to expose to network if needed, though ngrok handles localhost usually
    }
  }
})
