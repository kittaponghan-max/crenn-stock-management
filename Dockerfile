FROM node:20 AS build
WORKDIR /app

# 1. รับค่าจาก Cloud Run (Build Arguments)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_GEMINI_API_KEY

# 2. ฝังค่าลงในระบบเพื่อให้ Vite มองเห็นตอน Build
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY

COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
# ขั้นตอนนี้ Vite จะหยิบค่า ENV ด้านบนไปใส่ในไฟล์ JavaScript จริงๆ
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
RUN printf 'server {\n    listen 80;\n    location / {\n        root /usr/share/nginx/html;\n        index index.html;\n        try_files $uri $uri/ /index.html;\n        add_header Cache-Control "no-store, no-cache, must-revalidate";\n    }\n}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
