# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .

# Build args injected at build time by CI
ARG VITE_API_ENDPOINT
ARG VITE_APP_ID_TENANT_ID
ARG VITE_APP_ID_CLIENT_ID
ARG VITE_APP_ID_REGION=us-south

ENV VITE_API_ENDPOINT=$VITE_API_ENDPOINT
ENV VITE_APP_ID_TENANT_ID=$VITE_APP_ID_TENANT_ID
ENV VITE_APP_ID_CLIENT_ID=$VITE_APP_ID_CLIENT_ID
ENV VITE_APP_ID_REGION=$VITE_APP_ID_REGION

RUN npm run build

# ── Runtime stage — nginx ──────────────────────────────────────────────────────
FROM nginx:alpine AS runner

# IBM Code Engine listens on 8080 — override nginx default (80)
RUN sed -i 's/listen\s*80;/listen 8080;/' /etc/nginx/conf.d/default.conf 2>/dev/null || true

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
