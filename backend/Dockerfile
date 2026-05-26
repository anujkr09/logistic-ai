FROM node:20-alpine
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ ./
COPY frontend/ /app/frontend/
EXPOSE 4000
ENV PORT=4000
CMD ["node", "src/server.js"]
