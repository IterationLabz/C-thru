# C-thru — Build Plan

> This file explains HOW we are building C-thru: the approach, the tools, the issue breakdown,
> and what "done" looks like at every step.

---

## What we are building

**C-thru** is an open-source, self-hosted PQL (Product Qualified Lead) engine for PLG startup founders.

A founder installs it on their own server, pastes one `<script>` tag into their app, and C-thru
answers: *"Which companies are using my product, who is about to pay, and what do I say to them?"*

Everything runs on the founder's own server. Their data never leaves their machine.

---

## The tech stack

| Layer | Technology |
|---|---|
| Frontend + Dashboard | Next.js 15 (App Router) + TypeScript + Tailwind |
| Backend / API | Next.js API Routes (same app) |
| Database | PostgreSQL (in Docker) |
| Tests | Vitest (integration tests against real DB) |
| Infrastructure | Docker Compose — one command to run everything |

---

## How we run everything locally

```
Docker Compose
├── db       → PostgreSQL 15 on port 5433
├── adminer  → Browser DB viewer at http://localhost:8080
└── web      → Next.js app at http://localhost:3000
```

**Start everything:**
```bash
docker compose up -d
```

**Run tests:**
```bash
npm test
```
Tests run against a separate `cthru_test` database on the same Docker Postgres.

**View the database in the browser:**
Open http://localhost:8080 → login with `db / cthru / cthru / cthru`

---

## How we build — the approach

**TDD, one issue at a time, vertical slices.**

Each issue is a thin end-to-end slice through every layer (database → API → test).
Not horizontal layers ("write all schemas first"). A completed issue is always runnable.

```
For each issue:
  1. Write ONE failing test for the behavior
  2. Write the minimal code to make it pass
  3. Tests green → commit → move to next issue
```

No speculative code. No building ahead. Each commit leaves the system working.

---

## The build order — 14 issues for v0.1

### Already done

| # | Issue | Status |
|---|---|---|
| 1 | Bare ingestion spine — POST /api/ingest → events table → 2 passing tests | DONE ✓ |

---

### What's next — the remaining 13 issues

#### Issue #2 — Auth + per-event response contract
**What:** Validate `writeKey` and `serverKey` on every request. Return 401 for missing/wrong key,
403 when `writeKey` is used to submit a `server` event. Return a per-event status array
`[{ accepted: boolean, reason?: string }]` so the caller knows which events were stored.

**Why first:** Without auth, anyone can write events. The per-event array is needed by the snippet
(so it can retry only rejected events, not the whole batch).

**Tests:** Missing key → 401. Wrong key → 401. writeKey + server event → 403. Valid writeKey +
auto event → 200 + `[{ accepted: true }]`.

---

#### Issue #3 — Timestamp validation + suspect flag
**What:** Browser events more than 5 min in the future → hard reject. Browser events more than
24 h in the past → store with `occurred_at_suspect = true`. Server events: any future → reject,
more than 7 days past → suspect.

**Why:** Protects the dashboard from corrupt time-based charts. The raw `occurred_at` is preserved
exactly — never mutated. The `events_v` view uses `occurred_at_effective` (falls back to
`received_at` for suspect rows).

**Tests:** Future browser event → rejected in status array. Stale browser event → stored with
`occurred_at_suspect = true`. The view returns `received_at` for suspect rows.

---

#### Issue #4 — Domain classifier (blocked domains + company_domain derivation)
**What:** Build `lib/domainClassifier.ts`. Given an email, return `companyDomain: string | null`.
Personal email providers (Gmail, Yahoo, Outlook, Hotmail, iCloud, etc.) → `null`. Company email
→ the domain. Loaded into an in-memory Set at startup from the `blocked_domains` DB table.

**Why:** Company grouping is C-thru's "wow moment." This module is the gatekeeper — everything
downstream depends on it getting `company_domain` right.

**Tests:** `priya@razorpay.com` → `razorpay.com`. `user@gmail.com` → `null`. `user@zoho.com` → `null`.
Case-insensitive. Missing `@` → `null`.

---

#### Issue #5 — server event anonymous_id derivation
**What:** Server events don't have an `anonymous_id` from the browser. Derive it: if `userId` is
present, use `userId` as the `anonymous_id`. If only `email` is present, use a deterministic hash
of the lowercased email. If neither → reject the event (hard).

**Why:** The `events` table has `anonymous_id NOT NULL`. Server events need a stable, deterministic
ID so they can be linked to other events from the same user.

**Tests:** `userId` present → `anonymous_id = userId`. Email only → `anonymous_id = hash(email)`.
Neither → rejected in status array.

---

#### Issue #6a — processEvent() full pipeline (users + companies + aliases upserts)
**What:** After the event insert, `processEvent()` does three best-effort upserts: `users` table
(upsert by `user_id`), `companies` table (upsert by `company_domain`), `aliases` table (maps
`anonymous_id → user_id + email + company_domain`, last-write-wins). A failure in any upsert is
logged but does NOT block the response or fail the event.

**Why:** This is what powers company grouping and pre/post-login identity linking. The `aliases`
table is how pre-login events get attributed to a company — via a join at query time, not by
mutating the immutable `events` rows.

**Tests:** Event with email → `companies` row exists. Event with `userId` → `users` row exists.
`identify()` call → `aliases` row maps `anonymous_id → user_id`. Company upsert failure → event
still accepted.

---

#### Issue #6b — Rate limiting (429 + Retry-After)
**What:** Rate-limit requests to `/api/ingest` by IP and by `writeKey`. Return HTTP 429 with a
`Retry-After` header when the limit is exceeded. Limit is configurable via env var.

**Why:** The `writeKey` is public (shipped in the browser snippet). Without rate limiting, anyone
who finds it can flood the ingestion endpoint.

**Tests:** Exceed limit → 429 with `Retry-After` header. Within limit → 200.

---

#### Issue #7 — Browser snippet (auto-capture + identify + track)
**What:** Build `public/cthru.js` — a tiny, dependency-free script. Auto-captures: `pageview` on
every page load and SPA route change, `click` on any element, `session_start` when a new session
begins (30-min inactivity gap), `rage_click` (3+ rapid clicks on same spot), `form_submit`.
Exposes `cthru.identify(userId, traits)` and `cthru.track(name, properties)`. Batches events and
POSTs to `/api/ingest` with retry — reads the per-event status array and retries only rejected
events. Persists `anonymous_id` in `localStorage`.

**Tests:** Pageview fires on load. Identify sends an identify event. Track sends a custom event.
Rejected events are retried; accepted events are not re-sent.

---

#### Issue #8 — Node server SDK (`@cthru/node`)
**What:** Build `packages/node-sdk`. Exposes `new Cthru({ host })` and
`cthru.trackServer(name, { userId, email, ...properties })`. Validates that `userId` or `email`
is present. Wraps in the unified envelope using `serverKey`. POSTs to `/api/ingest`.
Returns `Promise<void>` that resolves when the event is confirmed stored.

**Blocked by:** Issue #2 (auth), Issue #5 (server anonymous_id derivation).

**Tests:** Valid call with `userId` → event stored with `source: 'server'`. Missing identity →
SDK throws before sending. Network failure → rejects the promise.

---

#### Issue #9 — Migrations + seeds run automatically on startup
**What:** On `docker compose up`, the app runs all pending SQL migrations and seeds the
`blocked_domains` table with the default personal-email provider list (~50 domains). No manual
`psql` or migration command needed.

**Why:** Deploy ease is a core feature. A stranger running `docker compose up` for the first time
should get a working system with no extra steps.

**Tests:** Fresh Docker environment → `blocked_domains` table populated. Re-run → idempotent (no
duplicates).

---

#### Issue #10 — Dashboard: active users, signups, top events, live count
**What:** Build the main dashboard page (`/`). Four metrics:
- **Active users** — identified users (via aliases join) with ≥1 event in last 7/30 days
- **New signups** — identified users whose `first_seen` in `users` is within last 7/30 days
- **Top 10 events** — event names ranked by count
- **Live count** — events received in the last 60 seconds

All queries use `events_v` (the view with `occurred_at_effective`). No mock data — shows real data
from the database.

**Tests:** DB with seeded events → correct counts returned by the query functions.

---

#### Issue #11 — Dashboard: companies list
**What:** Add the companies view to the dashboard — the "wow moment." Shows a ranked list of
companies by event count (most active first). Each row: display name (e.g. "Razorpay"), raw domain
beneath (`razorpay.com`), and unique user count (derived at query time, never stored). Display name
is computed at render: `capitalize(strip_tld(domain))`. Nothing enriched or stored.

**Blocked by:** Issue #6a (companies upserts must be running).

**Tests:** Events from `priya@razorpay.com` and `amit@razorpay.com` → Razorpay appears with
user count = 2. Personal email events → no company row.

---

#### Issue #12 — Settings: key events
**What:** Build the settings screen for managing key events. Founder marks specific event names
(e.g. `signup_completed`, `payment_succeeded`) as "key events." Stored in the `key_events` table.
Add/remove without restarting the server. This table is read by the readiness engine in v0.3 —
v0.1 just needs the CRUD UI and storage.

**Tests:** Add key event → row in `key_events`. Remove → row deleted. Page loads existing key events.

---

#### Issue #13 — Settings: blocked domains management
**What:** Add blocked domains CRUD to the settings screen. Founder can add and remove domains from
the list. On save, triggers a refresh of the in-memory Set in the domain classifier (no restart
needed).

**Blocked by:** Issue #4 (domain classifier must be built).

**Tests:** Add domain via UI → next event from that domain gets `company_domain = null`. Remove
domain → company_domain is derived again.

---

#### Issue #14 — v0.1 end-to-end smoke test + README polish
**What:** Final integration pass. Run all 6 definition-of-done checks manually:
1. `docker compose up` → dashboard loads
2. Snippet in a test page → pageviews arrive
3. `cthru.track()` → stored
4. `cthru.trackServer()` → stored
5. Users grouped by company
6. Dashboard shows all 4 metrics + companies list

Fix any rough edges. Polish the README quickstart so a complete stranger can follow it in 5 minutes.

---

## The database — what's in it

```
events          — every event ever, append-only, never mutated
users           — one row per identified user (upserted)
companies       — one row per company domain (upserted)
aliases         — maps anonymous_id → user_id + email + company_domain
blocked_domains — personal email domains to exclude from company grouping
key_events      — founder-marked event names (used by v0.3 readiness engine)

events_v (view) — events + occurred_at_effective
                  (uses received_at instead of occurred_at when suspect flag is set)
```

**Key rule:** The `events` table is immutable. Events are never updated or deleted after insert.
Identity resolution and company grouping happen via joins at query time — not by mutating rows.

---

## The two write keys

| Key | Where it lives | What it can do |
|---|---|---|
| `CTHRU_WRITE_KEY` | Public — shipped in the browser snippet | Submit `auto` and `custom` events only |
| `CTHRU_SERVER_KEY` | Secret — env var in your backend only, NEVER in the browser | Submit `server` events |

If a request arrives with `writeKey` and tries to submit a `server` event → 403 rejected.
The server channel is the ground-truth channel — it cannot be forged from the browser.

---

## Version roadmap (big picture)

| Version | What it adds | Ships when |
|---|---|---|
| **v0.1 — Core Tracker** | Event capture + company grouping + basic dashboard | All 14 issues above done |
| v0.2 — Vibe Analytics | Ask questions in English, see the SQL, get the answer | After v0.1 |
| v0.3 — Readiness Engine | Score accounts, rank by readiness, morning brief | After v0.2 |
| v0.4 — Act Loop | Draft outreach, one-click send (never auto-send) | After v0.3 |
| v0.5 — Session Replay | Watch what a user did, sensitive fields masked | After v0.4 |
| v0.6 — Enrichment | Company name/logo from free public sources, opt-in only | After v0.5 |
| v1.0 — Cloud | Hosted version, paid tiers | After v0.6 |

**Rule:** Never build ahead. v0.2 features do not exist while v0.1 is unfinished.

---

## Where to track issues

Issues live at: **https://github.com/bhavishyaone/C-thru/issues**

They haven't been published yet — only Issue #1 is done (in code). The next step is to publish
Issues #2–#14 to GitHub so the full plan is visible and trackable.

---

## Where things live in the codebase

```
/
├── src/
│   ├── app/
│   │   ├── api/ingest/route.ts   ← the ingestion API endpoint
│   │   ├── dashboard/            ← dashboard pages (Issues #10, #11)
│   │   └── settings/             ← settings pages (Issues #12, #13)
│   ├── lib/
│   │   ├── processEvent.ts       ← core deep module — all ingestion logic lives here
│   │   ├── domainClassifier.ts   ← blocked domains + company_domain derivation (Issue #4)
│   │   ├── db.ts                 ← Postgres connection pool
│   │   └── __tests__/            ← all integration tests
│   └── types/
│       └── events.ts             ← shared TypeScript types
├── migrations/
│   └── 001_events.sql            ← database schema
├── public/
│   └── cthru.js                  ← the browser snippet (Issue #7)
├── packages/
│   └── node-sdk/                 ← @cthru/node server SDK (Issue #8)
├── docs/
│   ├── PRD-v0.1.md               ← full product requirements
│   ├── DECISIONS.md              ← architecture decisions (D-01 to D-09)
│   ├── EVENTS.md                 ← event schema reference
│   └── ROADMAP.md                ← full version roadmap
├── docker-compose.yml            ← runs db + adminer + web
└── plan.md                       ← this file
```
