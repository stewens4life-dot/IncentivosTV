import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// [https://vitejs.dev/config/](https://vitejs.dev/config/)
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Esto permite acceso desde la red (IP)
    port: 5173  // Puerto fijo opcional
  }
})