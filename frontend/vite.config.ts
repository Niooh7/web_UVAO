import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['pdfjs-dist'],
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false,
      },
      '/public': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
      // Proxy для PDF worker CDN
      '/pdf-cdn': {
        target: 'https://cdnjs.cloudflare.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/pdf-cdn/, ''),
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-pdf':    ['react-pdf'],
          'vendor-ui':     ['lucide-react'],
        },
      },
    },
    target: ['es2020', 'safari14'],
    chunkSizeWarningLimit: 800,
  },
  worker: {
    format: 'es',
  },
  define: {
    'process.env': {}
  },
});
