import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 3000,
  },
  esbuild: {
    // Avoid leaking internal details via verbose console logging in prod bundles.
    pure: mode === 'production' ? ['console.log', 'console.debug', 'console.info'] : [],
    drop: mode === 'production' ? ['debugger'] : [],
  },
  build: {
    outDir: 'dist',
    // Sourcemaps make reverse-engineering easier; keep for dev only.
    sourcemap: mode !== 'production',
  },
}))

