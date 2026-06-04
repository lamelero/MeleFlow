FROM node:20-alpine AS deps
WORKDIR /usr/src/app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --only=production

FROM node:20-alpine AS build
WORKDIR /usr/src/app
COPY backend/package.json backend/package-lock.json backend/tsconfig.json ./
COPY backend/src/ ./src/
RUN npm ci \
  && npx prisma generate \
  && npm run build

FROM node:20-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /usr/src/app/node_modules/prisma ./node_modules/prisma
COPY --from=build /usr/src/app/node_modules/tsx ./node_modules/tsx
COPY --from=build /usr/src/app/node_modules/esbuild ./node_modules/esbuild
COPY --from=build /usr/src/app/dist ./dist
COPY backend/src/prisma ./src/prisma
COPY backend/package.json ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--import", "tsx/esm", "dist/server.js"]
