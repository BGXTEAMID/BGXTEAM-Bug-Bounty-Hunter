FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY server.js telegram-bot.js app.config.ts ./
COPY lib ./lib
COPY public ./public
RUN mkdir -p data && chown -R node:node /app
USER node
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
