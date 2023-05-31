FROM node:16-slim AS builder

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn build

FROM node:16-slim

ARG NODE_ENV=production

ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN apt-get update && apt-get install -y openssl ffmpeg && apt-get clean autoclean

RUN yarn install --frozen-lockfile --production

COPY --from=builder /usr/src/app/dist ./dist

COPY --from=builder /usr/src/app/prisma ./prisma

RUN yarn prisma generate

EXPOSE 8080

CMD ["node", "dist/index.js"]
