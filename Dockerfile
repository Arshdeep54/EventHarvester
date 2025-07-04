# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx tsc

# Stage 2: Run
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./

COPY --from=build /app/dist ./dist 
COPY src/cron/cronjob.cron /etc/crontabs/root

RUN npm install --only=production

CMD ["crond", "-f", "-l", "2"]