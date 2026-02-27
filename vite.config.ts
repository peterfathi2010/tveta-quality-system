
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './')
        },
      },
      plugins: [react()],
      define: {
        // Only define process.env for compatibility. Do NOT redefine import.meta.env here.
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || ''),
        'process.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || ''),
        'process.env.VITE_GOOGLE_API_KEY': JSON.stringify(env.VITE_GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY || ''),
      },
      build: {
        outDir: 'dist',
        sourcemap: false,
        minify: 'esbuild',
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
          output: {
            manualChunks: (id) => {
              if (id.includes('node_modules')) {
                if (id.includes('recharts')) {
                  return 'charts';
                }
                if (id.includes('react')) {
                  return 'react-vendor';
                }
                if (id.includes('lucide')) {
                  return 'icons';
                }
                return 'vendor'; // all other package goes here
              }
            }
          }
        }
      }
    };
});
