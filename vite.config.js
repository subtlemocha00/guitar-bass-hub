import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Automatically uses correct base depending on where it's deployed
const base = process.env.VERCEL ? '/' : '/guitar-bass-hub/'

export default defineConfig({
  base,
  plugins: [react()],
})