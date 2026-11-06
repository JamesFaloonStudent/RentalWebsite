import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'


// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),

  ],
  // The backend's http profile owns port 5000; proxy /api to it like nginx does in Docker
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})
