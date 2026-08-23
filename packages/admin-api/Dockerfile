FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production
EXPOSE 3020

CMD ["node", "src/index.js"]
