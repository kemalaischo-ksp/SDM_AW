# HRIS SDM AL-WILDAN v3.1 — build sekali: API + frontend statik sdm-v31.
# Postgres volume bind ./data/pg. Frontend = index.html + assets (data via API).
FROM node:22-bookworm-slim
WORKDIR /app
COPY api/package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY api/ ./
COPY db/ ./db/
COPY sdm-v31/ ./public-dist/
ENV PUBLIC_DIR=/app/public-dist DB_DIR=/app/db PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "node migrate.js && node seed.js && node server.js"]
