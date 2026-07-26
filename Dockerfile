# 1. เปลี่ยนจาก slim เป็นปรกติเพื่อให้มีเครื่องมือ Build ครบ
FROM node:18 AS build
WORKDIR /app

# 2. ก๊อปปี้ไฟล์ package ก่อน
COPY package*.json ./

# 3. ใช้คำสั่งติดตั้งแบบข้ามความขัดแย้งของเวอร์ชัน
RUN npm install --legacy-peer-deps

# 4. ก๊อปปี้ที่เหลือและ Build
COPY . .
RUN npm run build

# 5. ส่วนของ Nginx เหมือนเดิม
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
RUN echo 'server { listen 80; location / { root /usr/share/nginx/html; index index.html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
