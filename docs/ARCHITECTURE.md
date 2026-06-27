# ARCHITECTURE.md — C-thru System Architecture

> Read before building anything structural (ingestion, storage, the dashboard data layer).

## High-level data flow

```
Founder's website / app
  │  (1) C-thru snippet  → auto-captured events + cthru.track() custom events
  │  (2) Founder backend → cthru.trackServer() real events
  ▼
INGESTION API  (single endpoint, /api/ingest)
  │  validate → attach user identity + session + company (from email domain)
  ▼
POSTGRES  (single unified `events` table + derived tables)
  │
  ├─► CHART DASHBOARD   (pre-built saved queries → visual)
  ├─► VIBE ANALYTICS    (English → LLM → SQL → shown → run → answer + trend)
  ├─► READINESS ENGINE  (rules over events → company scores → morning brief)  [v0.3+]
  └─► ACT LOOP          (draft outreach → founder clicks send)               [v0.4+]
```

## Components (v0.1)

### 1. The snippet (browser client)
- Tiny, dependency-free JS loaded via `<script>`.
- Auto-captures: pageview, click, session start/end, rage-click, basic device/referrer.
- Exposes `cthru.identify(userId, { email })` and `cthru.track(name, properties)`.
- Batches events and POSTs to `/api/ingest`. Must be resilient (retry, don't block the host page).

### 2. The server SDK (Node package)
- Exposes `cthru.trackServer(name, properties)` for backend "real" events.
- Sends to the SAME `/api/ingest` endpoint with `source: "server"`.

### 3. Ingestion API
- One endpoint. Accepts a batch of events from snippet OR server SDK.
- For each event: validate shape, attach/resolve `user_id`, derive `company` from email domain
  (skip personal domains: gmail, yahoo, outlook, etc.), stamp `received_at`.
- Insert into `events`. Keep this path fast and simple.

### 4. Postgres storage
- See docs/EVENTS.md for the exact schema.
- One `events` table is the source of truth. `users` and `companies` are derived/maintained tables.

### 5. Dashboard (Next.js)
- Chart dashboard = a set of fixed SQL queries rendered as charts.
- Vibe box = sends the founder's English question + the table schema to the founder's LLM,
  gets SQL back, shows it, runs it read-only, renders the result + a trend explanation.

## Security / safety in the data layer
- The vibe analytics SQL must run with a READ-ONLY database role. Never let generated SQL write/delete.
- Validate/limit generated SQL (no DROP, DELETE, UPDATE, etc.) before execution.
- The ingestion endpoint should rate-limit and reject malformed payloads.
- Never log full event properties that might contain PII in plaintext logs.

## Scaling note (later, not v0.1)
- Start with Postgres. If event volume outgrows it, migrate the `events` table to ClickHouse.
- Design queries so this migration is possible (keep the schema clean, avoid Postgres-only tricks
  in the hot path). Do NOT prematurely add ClickHouse/Kafka in v0.1.

## Deploy
- Docker Compose with two services to start: the Next.js app and Postgres.
- Goal: a stranger runs `docker compose up` and has a working C-thru in 5 minutes.
- Ship a `.env.example` and a clear README quickstart.
