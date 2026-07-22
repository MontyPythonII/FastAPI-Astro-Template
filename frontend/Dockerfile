# Frontend image: Astro SSR compiled to a standalone Node server.
# Multi-stage so the build toolchain and devDependencies never reach the
# image that actually runs.

# ---- build ----
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Lockfile-driven install first, so dependency layers cache independently
# of source changes. NODE_ENV is deliberately unset here — the build needs
# devDependencies.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- runtime ----
FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=7071

# Production dependencies only. Astro's standalone output still resolves its
# imports from node_modules at runtime, so they must be present.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# node:*-slim ships an unprivileged `node` user (uid 1000).
USER node

EXPOSE 7071

# The @astrojs/node standalone adapter reads HOST and PORT from the
# environment, which is how compose controls the bind address.
CMD ["node", "./dist/server/entry.mjs"]
