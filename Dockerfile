# ─── Stage 1: base ───────────────────────────────────────────────────────────
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./

# ─── Stage 2: development ────────────────────────────────────────────────────
FROM base AS development
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# ─── Stage 3: builder ────────────────────────────────────────────────────────
FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build

# ─── Stage 4: production ─────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder /app/dist ./dist
EXPOSE 3000
USER node
CMD ["node", "dist/main"]
