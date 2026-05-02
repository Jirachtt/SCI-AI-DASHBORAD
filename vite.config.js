import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mjuDashboardSyncHandler from './api/mju-dashboard-sync.js'

function mjuSyncDevApi() {
  return {
    name: 'mju-sync-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/mju-dashboard-sync')) {
          next()
          return
        }

        const url = new URL(req.url, 'http://localhost')
        await mjuDashboardSyncHandler({
          method: req.method,
          query: Object.fromEntries(url.searchParams.entries()),
        }, res)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), mjuSyncDevApi()],
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
})
