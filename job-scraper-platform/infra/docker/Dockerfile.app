FROM node:22-bookworm

ARG APP_NAME
WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm install
RUN npx playwright install --with-deps chromium
RUN npm run build

WORKDIR /app/$APP_NAME
CMD ["npm", "run", "start"]
