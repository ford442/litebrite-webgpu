import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Set the base to a relative path to support deploying
  // to a subdirectory.
  base: './',
  plugins: [react()],
})
