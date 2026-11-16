import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Relative base so the build can be served from a GitHub Pages project
  // subpath (e.g. /playground/) without hard-coding the repository name.
  base: command === 'build' ? './' : '/',
}))
