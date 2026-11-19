# syntax=docker/dockerfile:1

ARG NODE_IMAGE=node:26.13.1-trixie-slim

FROM ${NODE_IMAGE} AS base
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM base AS production-dependencies
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM base AS runtime
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 8080
STOPSIGNAL SIGTERM
CMD ["node", "dist/main.js"]
