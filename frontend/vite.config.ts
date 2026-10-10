import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // In development the SPA calls same-origin /api and Vite proxies it to Spring Boot,
  // so the session and XSRF cookies work without cross-site configuration.
  const backend = env.VITE_DEV_BACKEND_URL || 'http://localhost:8080';
  return {
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    server: {
      port: 5173,
      proxy: {
        '/api': { target: backend, changeOrigin: false },
        '/uploads': { target: backend, changeOrigin: false },
      },
    },
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks: {
            three: ['three', '@react-three/fiber', '@react-three/drei'],
            charts: ['recharts'],
            motion: ['framer-motion', 'gsap'],
          },
        },
      },
    },
  };
});
