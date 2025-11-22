import 'dotenv/config';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import tailwindcss from "@tailwindcss/vite";
import { rmSync } from 'fs';
import svgr from 'vite-plugin-svgr';
import loadablePlugin from './library/server/loadablePlugin';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const clientEnvs = {}
for (const key in process.env) {
  if (key.startsWith('REACT_APP_') || key === 'NODE_COMPILE') {
    clientEnvs[key] = process.env[key]
  }
}

// https://vite.dev/config/
//The first one is dev
export default process.env.NODE_COMPILE == 'split' ? defineConfig({
  plugins: [react({
    jsxRuntime: 'automatic',
  }), tailwindcss(),  {
    name: 'remove-dist-folder',
    closeBundle() {
      const folderToRemove = path.resolve(__dirname, 'dist/dist'); // Path to the unwanted folder
      try {
        rmSync(folderToRemove, { recursive: true, force: true });
        console.log(`Post-build cleanup: Removed folder '${folderToRemove}'`);
      } catch (err) {
        console.error(`Error during post-build cleanup: ${err.message}`);
      }
    },
  },
  svgr({
  
    include: ['**/*.svg'],

  })



  ],
  root: path.resolve(__dirname, 'src'),
  publicDir: path.resolve(__dirname, 'public'), 
  build: {
    manifest: true,
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  rollupOptions:{
    output:{
      assetFileNames: '_assets/[name].[hash][extname]',
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000, 
    allowedHosts: true
  },
  define: {
    'process.env': clientEnvs,
  }
}) :

  defineConfig({
    plugins: [
      react({
        jsxRuntime: 'automatic',
      }), tailwindcss(),loadablePlugin(),
      {
        name: 'remove-dist-folder',
        closeBundle() {
          const folderToRemove = path.resolve(__dirname, 'dist/dist'); // Path to the unwanted folder
          try {
            rmSync(folderToRemove, { recursive: true, force: true });
            console.log(`Post-build cleanup: Removed folder '${folderToRemove}'`);
          } catch (err) {
            console.error(`Error during post-build cleanup: ${err.message}`);
          }
        },
      },
      svgr({
        include: ['**/*.svg'],
      })
    ],
    root: __dirname,
    publicDir: path.resolve(__dirname, 'public'),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      manifest: true,
      outDir: path.resolve(__dirname, 'dist'),
      emptyOutDir: true,
      rollupOptions: {
        input: path.resolve(__dirname, 'src', 'index.html'),
        external: ['path', 'url', 'node:util'],
        output:{
          entryFileNames: '_assets/[name].[hash].js',
          chunkFileNames: '_assets/[name].[hash].js',
          assetFileNames: '_assets/[name].[hash][extname]',
          experimentalMinChunkSize: 4_000_000
        }
      }
    },
    define: {
      'process.env': clientEnvs,
    }
  })

