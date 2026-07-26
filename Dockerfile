FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM nginx:stable-alpine
# ก๊อปปี้ไฟล์จาก dist ไปที่ Nginx
COPY --from=build /app/dist /usr/share/nginx/html
# แก้ไขการตั้งค่า Nginx ให้ฉลาดขึ้น
RUN printf 'server {\n    listen 80;\n    location / {\n        root /usr/share/nginx/html;\n        index index.html;\n        try_files $uri $uri/ /index.html;\n    }\n    # จัดการไฟล์ใน assets ให้ถูกต้อง\n    location /assets/ {\n        root /usr/share/nginx/html;\n    }\n}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
