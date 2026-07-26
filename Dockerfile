# ใช้ Node.js 18 เป็นพื้นฐานในการ Build
FROM node:18-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ใช้ Nginx สำหรับ Serve ไฟล์ Static (ซึ่งเป็นรูปแบบของ PWA)
FROM nginx:alpine
# ก๊อปปี้ไฟล์ที่ Build เสร็จแล้วจากโฟลเดอร์ dist (หรือ build) ไปยัง nginx
COPY --from=build /app/dist /usr/share/nginx/html
# สร้าง Configuration พื้นฐานสำหรับ Nginx เพื่อรองรับ Single Page App (SPA)
RUN echo 'server { listen 80; location / { root /usr/share/nginx/html; index index.html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
