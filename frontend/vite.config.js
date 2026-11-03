import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['chart.js', 'react-chartjs-2'],
        },
      },
    },
  },
  server: {
    port: Number(process.env.PORT) || 5174,
    proxy: {
      '/api': { target: 'http://localhost:8085', changeOrigin: true },
    },
  },
})
