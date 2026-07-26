import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './', // เพิ่มบรรทัดนี้เพื่อให้แอปหาไฟล์ CSS/JS เจอไม่ว่าจะอยู่ที่ URL ไหน
  build: {
    outDir: 'dist',
  }
})
