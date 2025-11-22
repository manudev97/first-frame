import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Cargar variables de entorno desde el directorio raíz del proyecto
  const rootEnv = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const localEnv = loadEnv(mode, process.cwd(), '');
  
  // Leer el puerto del backend - intenta múltiples fuentes
  // Primero intenta desde el .env del proyecto raíz, luego del webapp
  const BACKEND_PORT = rootEnv.PORT || localEnv.PORT || localEnv.VITE_BACKEND_PORT || '3001';
  const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
  
  console.log(`🔧 Proxy configurado para backend en: ${BACKEND_URL}`);
  console.log(`💡 Si el backend está en otro puerto, configura PORT=3002 en tu .env del proyecto raíz`);
  
  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true, // Permite acceso desde cualquier host
      strictPort: true,
      // Permitir hosts de ngrok y otros servicios de túnel
      allowedHosts: [
        'localhost',
        '.ngrok.io',
        '.ngrok-free.app',
        '.ngrok.app',
        '.cloudflared.net',
        '.loca.lt',
      ],
      // Proxy para redirigir peticiones de API al backend local
      proxy: {
        '/api': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.error('❌ Proxy error:', err.message);
              console.error('💡 Verifica que el backend esté corriendo en', BACKEND_URL);
              console.error('💡 Si el backend está en otro puerto, configura PORT en tu .env del proyecto raíz');
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('🔄 Proxying:', req.method, req.url, '→', BACKEND_URL + req.url);
            });
          },
        },
      },
    },
    build: {
      outDir: 'dist',
    },
  };
});

