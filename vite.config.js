import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // <--- 关键！这一行让打包后的路径变成相对路径
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
})