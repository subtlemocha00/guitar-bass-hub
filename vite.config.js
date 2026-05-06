import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/guitar-bass-hub/',
  plugins: [react()],
})