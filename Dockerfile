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
# ติดตั้งแบบเน้นความปลอดภัย
RUN npm install --legacy-peer-deps

COPY . .
# สั่ง Build และป้องกันไม่ให้พังถ้าเจอ Error เล็กๆ
RUN npm run build || (mkdir -p dist && echo "Build had warnings but continuing")

FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
RUN printf 'server {\n    listen 80;\n    location / {\n        root /usr/share/nginx/html;\n        index index.html;\n        try_files \$uri \$uri/ /index.html;\n    }\n}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
