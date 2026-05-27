FROM node:22-bookworm-slim AS server-build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY server/package*.json server/
RUN cd server && npm ci --omit=dev
COPY server/src/ server/src/
COPY server/tests/ server/tests/
COPY server/server/ server/server/
COPY src/ src/

FROM node:22-alpine AS client-build
WORKDIR /app
COPY client/package*.json client/
RUN cd client && npm ci
COPY client/ client/
RUN cd client && npm run build

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=server-build /app/server/ ./server/
COPY --from=server-build /app/src/ ./src/
COPY --from=client-build /app/client/dist/ ./client/dist/
RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=4000
ENV DB_PATH=/data/chessorganizers.db

EXPOSE 4000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server/src/index.js"]
