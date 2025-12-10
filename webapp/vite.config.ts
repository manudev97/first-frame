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
    // Exponer variables de entorno del .env raíz al frontend
    // Vite solo expone variables con prefijo VITE_ por seguridad
    // Pero podemos mapear variables sin prefijo si es necesario
    define: {
      // Mapear DYNAMIC_ENVIRONMENT_ID a VITE_DYNAMIC_ENVIRONMENT_ID si existe
      'import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID': JSON.stringify(
        rootEnv.DYNAMIC_ENVIRONMENT_ID || rootEnv.VITE_DYNAMIC_ENVIRONMENT_ID || localEnv.VITE_DYNAMIC_ENVIRONMENT_ID || ''
      ),
      // Mapear STORY_RPC_URL a VITE_STORY_RPC_URL
      'import.meta.env.VITE_STORY_RPC_URL': JSON.stringify(
        rootEnv.STORY_RPC_URL || rootEnv.VITE_STORY_RPC_URL || localEnv.VITE_STORY_RPC_URL || 'https://aeneid.storyrpc.io'
      ),
    },
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
      // CRÍTICO: Deshabilitar HMR completamente para evitar problemas con WebSocket
      // El WebSocket de HMR no funciona bien con ngrok y puede bloquear la carga
      // En Telegram Mini App, HMR no es necesario ya que se recarga la app completa
      hmr: false,
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
      // Optimizaciones para mejorar la carga inicial
      rollupOptions: {
        output: {
          // Separar chunks para mejor caching
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'dynamic-vendor': ['@dynamic-labs/sdk-react-core', '@dynamic-labs/ethereum'],
          },
        },
      },
      // Reducir el tamaño del bundle
      // Usar 'esbuild' que viene incluido con Vite (más rápido)
      // O 'terser' si necesitas más opciones (requiere instalar terser)
      minify: 'esbuild', // Cambiado a esbuild que viene con Vite
      // terserOptions solo se usa si minify es 'terser'
      // terserOptions: {
      //   compress: {
      //     drop_console: false, // Mantener console.log para debugging
      //   },
      // },
    },
    // Optimizaciones para desarrollo
    optimizeDeps: {
      // Pre-bundlar dependencias comunes para carga más rápida
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@dynamic-labs/sdk-react-core',
        '@dynamic-labs/ethereum',
      ],
      // Excluir dependencias que causan problemas
      exclude: [],
    },
  };
});

