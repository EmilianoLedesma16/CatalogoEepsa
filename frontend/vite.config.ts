import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Servidor de desarrollo local (`npm run dev`). En producción el frontend lo sirve nginx (ver Dockerfile).
// El backend debe estar corriendo; por defecto en 127.0.0.1:3001 (no 'localhost': Node lo resuelve a IPv6 ::1 y ahí responde otro servicio).
// Para apuntar a otro: BACKEND_URL=http://otra-ip:3001 npm run dev
const backend = process.env.BACKEND_URL ?? 'http://127.0.0.1:3001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // También accesible desde otros equipos de la red local
    port: 5180, // 5173 lo usa el frontend del SINV
    strictPort: true,
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/catalogo-media': { target: backend, changeOrigin: true },
    },
  },
})
