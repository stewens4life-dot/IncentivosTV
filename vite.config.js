import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // Acceso desde la red local (IP)
    port: 5173,
    strictPort: false,
  },
  build: {
    rollupOptions: {
      output: {
        // Separar firebase y react en chunks distintos para mejor caché
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          react: ['react', 'react-dom'],
          icons: ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
  // Evitar que Vite haga pre-bundle innecesario en dev
  optimizeDeps: {
    include: ['react', 'react-dom', 'firebase/app', 'firebase/auth', 'firebase/firestore', 'lucide-react'],
  },
});