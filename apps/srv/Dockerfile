# syntax=docker/dockerfile:1

FROM node:23-alpine

WORKDIR /app

COPY --link .next/standalone ./standalone
COPY --link public ./standalone/public
COPY --link .next/static ./standalone/.next/static

CMD ["./standalone/server.js"]

