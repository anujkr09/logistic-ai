FROM node:20
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
COPY frontend/ /app/frontend/
EXPOSE 4000
CMD ["npm","start"]

