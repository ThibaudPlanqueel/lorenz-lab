# ---- Stage 1 : build TypeScript ----
FROM node:20-alpine AS builder
WORKDIR /build
COPY package.json tsconfig.json ./
RUN npm install --no-audit --no-fund --silent
COPY src ./src
RUN npx tsc -p tsconfig.json

# ---- Stage 2 : nginx ----
FROM nginx:1.27-alpine
COPY --from=builder /build/dist /usr/share/nginx/html
COPY src/index.html /usr/share/nginx/html/index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
