import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// เราจะใช้แค่ React Plugin เพื่อให้ Build ผ่านง่ายที่สุดครับ
export default defineConfig({
  plugins: [react()],
  base: '/', 
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true
  }
})
