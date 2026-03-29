import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 5173,
    host: true, // Allows the server to be accessible over the network (Tailscale/Ngrok)
    
    // 1. ALLOWED HOSTS: This fixes the "Host not allowed" error from Ngrok
    allowedHosts: [
      'ellis-bradytelic-factiously.ngrok-free.dev',
      'ems.prasklatechnology.com'
    ],

    // 2. PROXY: This fixes the "Network Error" during Login/Register
    // It maps any request starting with /api to your Node.js backend
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Points to your Firebase backend on port 3000
        changeOrigin: true,
        secure: false,
        // rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})