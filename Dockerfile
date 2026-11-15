FROM ghcr.io/astral-sh/uv:0.11.0 AS uv

FROM python:3.14-slim-bookworm AS api
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /fieldtwin/services/api
COPY services/api/pyproject.toml services/api/uv.lock ./
RUN uv sync --frozen --no-dev

FROM node:22-bookworm-slim AS web
WORKDIR /fieldtwin/apps/web
RUN npm install --global pnpm@10.32.1
COPY apps/web/package.json apps/web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY apps/web/ ./
COPY packages/contracts/ /fieldtwin/packages/contracts/
ARG NEXT_PUBLIC_CESIUM_ION_TOKEN
ENV NEXT_PUBLIC_API_MODE=live NEXT_PUBLIC_API_BASE=/api/v1 \
    FIELDTWIN_API_ORIGIN=http://127.0.0.1:8000 NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM python:3.14-slim-bookworm
COPY --from=web /usr/local/bin/node /usr/local/bin/node
WORKDIR /fieldtwin
COPY --from=api /fieldtwin/services/api/.venv services/api/.venv
COPY services/api/app services/api/app
COPY data/ data/
COPY packages/contracts/ packages/contracts/
COPY apps/web/lib/forecast/*-request.json apps/web/lib/forecast/
COPY --from=web /fieldtwin/apps/web/.next apps/web/.next
COPY --from=web /fieldtwin/apps/web/public apps/web/public
COPY --from=web /fieldtwin/apps/web/node_modules apps/web/node_modules
COPY apps/web/package.json apps/web/next.config.ts apps/web/
COPY scripts/run_hosted.py scripts/run_hosted.py
ENV NEXT_PUBLIC_API_MODE=live NEXT_PUBLIC_API_BASE=/api/v1 \
    FIELDTWIN_API_ORIGIN=http://127.0.0.1:8000 NEXT_TELEMETRY_DISABLED=1
EXPOSE 10000
CMD ["python", "scripts/run_hosted.py"]
