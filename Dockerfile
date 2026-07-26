# 1. ใช้ Node 20 เพื่อรองรับระบบไฟล์รุ่นใหม่
FROM node:20 AS build
WORKDIR /app

# 2. ติดตั้ง Library แบบข้ามความขัดแย้ง
COPY package*.json ./
RUN npm install --legacy-peer-deps

# 3. ก๊อปปี้งานและ Build
COPY . .
RUN npm run build

# 4. ใช้ Nginx Serve ไฟล์
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Config ให้ Nginx รองรับการ Refresh หน้าเว็บ (SPA)
RUN echo 'server { listen 80; location / { root /usr/share/nginx/html; index index.html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
