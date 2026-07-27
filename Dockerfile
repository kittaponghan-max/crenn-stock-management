FROM node:20 AS build
WORKDIR /app

# รับค่า Database
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG GEMINI_API_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_GEMINI_API_KEY=$GEMINI_API_KEY

COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
# ต้อง Build ให้ผ่านจริงๆ ห้ามข้ามแล้วครับ
RUN npm run build

FROM nginx:stable-alpine
# ก๊อปปี้ไฟล์แอปไปที่ Nginx
COPY --from=build /app/dist /usr/share/nginx/html
# เขียนไฟล์ Config แบบปลอดภัย
RUN echo "server { listen 80; location / { root /usr/share/nginx/html; index index.html; try_files \$uri \$uri/ /index.html; } }" > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
