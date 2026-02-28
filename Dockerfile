# Build stage
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Inject Supabase env vars directly for Vite build (public anon keys)
ENV VITE_SUPABASE_URL=https://tdwfsftgcbktekgknduj.supabase.co
ENV VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkd2ZzZnRnY2JrdGVrZ2tuZHVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNDUwOTgsImV4cCI6MjA4NzgyMTA5OH0.LteWlc_0U9nngHGvUTB8daIAu3sj322Dvtab1ndlA3k

RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
