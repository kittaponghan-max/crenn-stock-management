FROM node:20-slim AS build

# รับค่าเพื่อเชื่อมต่อ Database (ใส่เพื่อให้ขึ้น SUPABASE CONNECTED)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG GEMINI_API_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_GEMINI_API_KEY=$GEMINI_API_KEY

WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html

# ตั้งค่า Nginx เพื่อจัดการ Cache: 
# 1. ห้าม Cache ไฟล์ index.html (เพื่อให้แอปอัปเดตเสมอ)
# 2. ยอมให้ Cache ไฟล์ใน assets (รูป/JS/CSS) เพื่อความเร็ว
RUN printf 'server {\n\
    listen 80;\n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        index index.html;\n\
        try_files $uri $uri/ /index.html;\n\
        add_header Cache-Control "no-store, no-cache, must-revalidate";\n\
    }\n\
    location /assets/ {\n\
        root /usr/share/nginx/html;\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
