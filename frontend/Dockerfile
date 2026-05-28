FROM node:20-alpine AS deps

WORKDIR /usr/src/app

COPY package.json ./
RUN npm ci --only=development

FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=development
ENV PATH=/usr/src/app/node_modules/.bin:$PATH

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY package.json tsconfig.json vite.config.ts index.html ./
COPY src/ ./src/

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
