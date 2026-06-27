# PRD — C-thru v0.1: Core Tracker

> Scope: v0.1 only. Everything v0.2 and later is explicitly out of scope.
> Definition of done: the 6 checks in CLAUDE.md §10 all pass.
> Implementation decisions reference docs/DECISIONS.md entries (D-01 through D-09).

---

## Problem Statement

A PLG founder running a self-serve product has hundreds of people using their product and is flying blind:

- They cannot see **which companies** are using them — only individual user records scattered across their database.
- They cannot tell **who is about to convert** from free to paid.
- They waste time guessing who to reach out to and writing outreach from scratch.
- Every tool that solves this — Correlated, Gainsight, 6sense, Warmly — costs $549–$1,299/month, is closed-source, and requires sending their users' data to a third-party server.

The founder owns the first-party behavioral data already. They just have no open, self-hosted engine to turn it into answers.

---

## Solution

C-thru v0.1 is the Core Tracker: a self-hosted, open-source event capture and company grouping engine that a founder deploys in 5 minutes via `docker compose up`.

It captures everything users do across three channels (auto-captured browser behavior, founder-instrumented custom events, and server-side ground-truth events), ties all activity to logged-in users, groups users into companies by email domain, and presents the results in a basic chart dashboard.

The v0.1 output: a founder pastes one script tag into their app and immediately sees "4 users from razorpay.com are using your product" — using data they already own, on their own server, for free.

---

## User Stories

### Installation & Setup

1. As a founder, I want to run `docker compose up` and reach a working C-thru dashboard within 5 minutes, so that I can start capturing data without a complex setup.
2. As a founder, I want a `.env.example` file that documents every required environment variable, so that I know what to configure before first launch.

3. As a founder, I want the Docker Compose setup to include Postgres and the Next.js app as the only two services, so that I can understand and operate the deployment without additional infrastructure.
4. As a founder, I want a README quickstart that takes me from `git clone` to a live dashboard in 5 minutes, so that I can evaluate C-thru before committing to it.
5. As a founder, I want a public `writeKey` and a secret `serverKey` generated at first setup and stored in `.env`, so that I know which token to use in which context.
6. As a founder, I want database migrations to run automatically on `docker compose up` and the `blocked_domains` seed list to be populated at first launch, so that I never have to run a manual migration or seed step to get a working system.

### Browser Snippet & Auto-Capture

7. As a founder, I want to install C-thru by pasting a single `<script>` tag into my site's `<head>`, so that I get immediate coverage without per-page instrumentation.
8. As a founder, I want the snippet to automatically capture `pageview` events on every page load and SPA route change, so that I have a baseline of user activity without writing any custom tracking code.
9. As a founder, I want the snippet to capture `click` events on any element (recording tag, id, text, and position), so that I can see what users interact with without custom tracking.
10. As a founder, I want the snippet to emit a `session_start` event when a new session begins, so that session starts are captured. Session boundaries and duration are derived at query time from inactivity gaps: a new session begins when more than 30 minutes have elapsed since the prior event for the same `anonymous_id`. No `session_end` event is emitted — browsers cannot reliably fire it on tab close or navigation away.
11. As a founder, I want the snippet to capture `rage_click` events (3+ rapid clicks on the same spot), so that I can identify broken or frustrating UI elements.
12. As a founder, I want the snippet to capture `form_submit` events, so that I can measure form completion rates.
13. As a founder, I want the snippet to be tiny and dependency-free, so that it does not affect my site's load performance.
14. As a founder, I want the snippet to batch events and POST them to the ingestion endpoint with automatic retry on network failure, and on each response the snippet reads the per-event status array and retries only events that were not accepted — never re-sending accepted events — so that events are not lost due to transient errors and duplicate submissions are avoided.
15. As a founder, I want the snippet to assign a persistent `anonymous_id` (stored in `localStorage`) to every visitor before login, so that pre-login activity is captured and can later be linked to an identified user.

### Identity — `cthru.identify()`

16. As a founder, I want to call `cthru.identify(userId, { email, name, ... })` when a user logs in, so that all subsequent events are tied to a known user.
17. As a founder, I want pre-login events (carrying only `anonymous_id`) to be attributed to the identified user at query time via the `aliases` table join, so that the signup funnel is visible without mutating immutable event rows.
18. As a founder, I want `identify()` to accept arbitrary traits beyond email (e.g. `plan`, `role`), so that I can attach context I already know about the user.
19. As a founder, I want `identify()` to be idempotent — calling it multiple times with the same `userId` updates traits rather than creating duplicate records.

### Custom Events — `cthru.track()`

20. As a founder, I want to call `cthru.track("event_name", { ...properties })` from my frontend to mark meaningful moments (e.g. `invited_teammate`, `hit_paywall`), so that I capture intent beyond raw clicks.
21. As a founder, I want custom events to accept any JSON-serializable properties, so that I can attach context specific to each event type without a fixed schema.
22. As a founder, I want custom events to be stored with `source: 'custom'` in the same `events` table as auto-captured events, so that all queries work across both without branching logic.
23. As a founder, I want custom events to carry the same `anonymous_id` and `user_id` as auto-captured events from the same session, so that funnels spanning auto and custom events are seamless.

### Server Events — `cthru.trackServer()`

24. As a founder, I want to install `@cthru/node` in my backend and call `cthru.trackServer("event_name", { userId, email, ...properties })` for ground-truth events (e.g. `payment_succeeded`), so that critical events that must not be faked or blocked by an ad blocker are reliably captured.
25. As a founder, I want `trackServer()` to require at least `userId` or `email` in the properties, so that server events always have an identity and cannot pollute the users table with junk records.
26. As a founder, I want server events to be stored with `source: 'server'` in the same `events` table, so that one query can compare user behavior (auto/custom) against real outcomes (server).
27. As a founder, I want the server SDK to use my secret `serverKey`, so that browser-side code cannot forge `source: 'server'` events and pollute my ground-truth signals.
28. As a founder, I want `trackServer()` to return a `Promise<void>` that resolves when the event is confirmed stored, so that I can handle errors in my backend's error-handling pipeline.
29. As a system, I want the ingestion pipeline to derive `anonymous_id` for `source: 'server'` events from `userId` when present, or from a deterministic hash of the lowercased email when only `email` is provided, so that the `anonymous_id NOT NULL` constraint is satisfied without generating throwaway UUIDs and server events remain linkable to a real identity (D-01).

### Event Ingestion

30. As a system, I want all three event channels to POST to a single `/api/ingest` endpoint with a unified request envelope `{ writeKey | serverKey, events: [...] }`, so that there is one parser, one validation path, and one insert path.
31. As a system, I want the ingestion endpoint to validate the write key before touching any event payload, so that unauthenticated requests are rejected before any processing occurs.
32. As a system, I want the ingestion endpoint to enforce that `source: 'server'` events may only be submitted by requests carrying the secret `serverKey`, so that the server channel remains un-forgeable.
33. As a system, I want `source: 'auto'` and `source: 'custom'` events to be accepted with the public `writeKey` only, so that the write key's public nature does not loosen the server channel's trust boundary.
34. As a system, I want the ingestion endpoint to set `Access-Control-Allow-Origin: *` and handle `OPTIONS` preflight as a fast stateless 204, so that the snippet can POST from any origin without CORS errors.
35. As a system, I want the ingestion endpoint to rate-limit requests by IP and by `writeKey`, returning HTTP 429 with a `Retry-After` header when the limit is exceeded, and for the snippet to respect `Retry-After` (backing off before retrying rather than immediately retrying), so that the public nature of the write key does not enable event spam. The rate limit is configurable via environment variable and applies independently per IP and per `writeKey`.
36. As a system, I want each event's `received_at` to be set to `NOW()` at ingestion, independent of any client-provided timestamp, so that there is always a server-authoritative arrival time.
37. As a system, I want browser events with `occurred_at` more than 5 minutes in the future to be rejected (hard), and events more than 24 hours in the past to have `occurred_at_suspect = true` set, so that clock skew is flagged without silently mutating event data.
38. As a system, I want server events with any future `occurred_at` to be rejected (hard), and events more than 7 days in the past to have `occurred_at_suspect = true` set, so that legitimate delayed webhooks and batch reconciliations are accepted while extreme backdating is blocked.
39. As a system, I want the raw `occurred_at` preserved exactly as received on the row, so that suspect-flagged events can be debugged against the original client timestamp.
40. As a system, I want all four per-event writes (insert `events`, upsert `users`, upsert `companies`, upsert `aliases`) to happen inside a single `processEvent()` function, so that the synchronous-to-async migration path requires no schema change.
41. As a system, I want the event insert to be the critical write for each event — if it fails, that event is marked rejected in the per-event result array — and the derived upserts to be best-effort (failure is logged but does not block the response), so that a locked `companies` row never causes the founder's users' browsers to hang and a single failed event does not abort the rest of the batch.
42. As a system, I want `/api/ingest` to return HTTP 200 with a per-event status array `[{ accepted: boolean, reason?: string }]` when a batch is processed, so that the caller can distinguish which events were stored from which were hard-rejected (e.g. future timestamp, missing identity for a server event), and retry only the rejected ones without re-sending accepted events.

### Company Grouping & Identity Resolution

43. As a system, I want the ingestion pipeline to derive `company_domain` from the `email` field by extracting the domain portion (e.g. `priya@razorpay.com` → `razorpay.com`), so that company grouping requires no extra instrumentation.
44. As a system, I want domains in the `blocked_domains` table (personal email providers: Gmail, Yahoo, Outlook, iCloud, QQ, 163, Rediffmail, Mail.ru, Yandex, GMX, and others) to resolve to `company_domain = null`, so that individual users on free email providers are not grouped as companies.
45. As a system, I want the `blocked_domains` list to be loaded into an in-memory Set at server startup and refreshed on edit, so that the hot ingestion path does not incur a DB read per event.
46. As a founder, I want to add and remove domains from the blocked list in the settings UI, so that I can tune the personal-domain filter for my user base.
47. As a system, I want `cthru.identify()` to upsert into an `aliases` table (`anonymous_id → user_id, email, company_domain`) with last-write-wins conflict resolution, so that pre-login events are attributed to the correct user and company via a join — without mutating the immutable `events` table.
48. As a system, I want each company encountered to be upserted into the `companies` table (keyed by domain, with `first_seen` and `last_seen`), so that the companies view has a stable record per domain.

### Chart Dashboard

49. As a founder, I want to see a count of active users — identified users with a resolved `user_id` via the `aliases` join who have at least one event in the last 7 and 30 days — on the dashboard, so that I can track engagement. Anonymous-only visitors without an associated `user_id` are not counted as users; an optional separate anonymous visitor count may be shown but must not be conflated with the user count.
50. As a founder, I want to see a count of new signups — identified users with a resolved `user_id` whose `first_seen` in the `users` table falls within the last 7 and 30 days — on the dashboard, so that I can measure acquisition. Only users who have called `identify()` are counted; anonymous visitors who never identify are excluded.
51. As a founder, I want to see a ranked list of the top 10 event names by occurrence count, so that I can see what users do most.
52. As a founder, I want to see a live event count (events received in the last 60 seconds), so that I can confirm the snippet is working after installation.
53. As a founder, I want to see a list of companies ranked by event count (most active first), showing the display name (e.g. "Razorpay"), the raw domain beneath it (e.g. `razorpay.com`), and the number of unique users from that domain, so that I can immediately see which companies are most engaged.
54. As a founder, I want the companies list to show user count as a derived count (not a stored counter), so that the number is always accurate.
55. As a founder, I want all dashboard queries to use `occurred_at_effective` from the `events_v` view (which falls back to `received_at` for suspect timestamps), so that suspect clock events do not corrupt time-based charts.
56. As a founder, I want the dashboard to load with real data from my Postgres instance — no mock or sample data pre-populated, so that I am looking at my actual users from the first session.

### Key-Event Configuration

57. As a founder, I want to open a settings screen and mark specific event names as "key events" (e.g. `signup_completed`, `invited_teammate`, `payment_succeeded`), so that the readiness engine (v0.3) can reference them by role rather than raw name.
58. As a founder, I want key events to be stored in a `key_events` config table, so that they persist across restarts and are available to future versions.
59. As a founder, I want to add and remove key events from the settings screen without restarting the server, so that I can tune them as I learn which events matter.

---

## Implementation Decisions

### Major Modules

**1. Browser Snippet (`public/cthru.js`)**
Tiny, dependency-free JavaScript loaded via one `<script>` tag. Responsibilities: generate and persist `anonymous_id` in `localStorage`; auto-capture pageviews/clicks/session-starts/rage-clicks/form-submits; expose `cthru.identify()` and `cthru.track()`; batch events and POST to `/api/ingest` with smart retry (retry only per-event-rejected events, respect `Retry-After` on 429). Must not block the host page on failure.

**2. Server SDK (`packages/node-sdk`)**
Minimal Node.js package. Exposes `cthru.trackServer(name, properties)`. Validates that `userId` or `email` is present; rejects otherwise. Wraps event in the unified envelope using `serverKey`. Sends to the same `/api/ingest` endpoint.

**3. Ingestion API (`app/api/ingest`)**
Single Next.js API route. Responsibilities: validate auth key, enforce source/key pairing (D-05), parse and type-check the envelope, call `processEvent()` for each event, return HTTP 200 with a per-event status array `[{ accepted: boolean, reason?: string }]`. Authentication failures (missing/invalid key) return 401 before any event processing. Rate-limit violations return 429 with `Retry-After`.

**4. Event Processor (`lib/processEvent`)**
The core deep module. Simple interface: `processEvent(rawEvent, keyType) → Promise<void>`. Hides: timestamp validation and suspect-flag logic (D-06), `anonymous_id` derivation for server events (D-01), email-to-company-domain resolution via the domain classifier (D-04), the `events` insert, and best-effort upserts for `users`, `companies`, and `aliases` (D-03). This is the async seam — v0.1 calls it synchronously; a future queue wraps the same function.

**5. Domain Classifier (`lib/domainClassifier`)**
Deep module with a narrow interface: `classifyDomain(email) → { companyDomain: string | null }`. Hides: email parsing, the in-memory `Set<string>` lookup against `blocked_domains`, and the Set refresh mechanism (D-04). Callers never touch the Set directly.

**6. Event Store (`lib/eventStore`)**
Interface: `insertEvent(event: ValidatedEvent) → Promise<void>` and the associated upserts. Hides: the Postgres transaction structure, the `events_v` view, and the `aliases` upsert logic. If the storage backend ever migrates (e.g. to ClickHouse for the events table), only this module changes.

**7. Dashboard (`app/dashboard`)**
Next.js App Router pages. Fixed SQL queries targeting `events_v`. Active-user and signup counts are computed over alias-resolved identity (`events JOIN aliases ON events.anonymous_id = aliases.anonymous_id`), not over raw `events.user_id`. Renders: active users, signups, top events, live count, companies list with display-time name formatting (D-08). No mock data.

**8. Settings (`app/settings`)**
Key-event management (CRUD on `key_events` table) and blocked-domain management (CRUD on `blocked_domains` table, triggers Set refresh in Domain Classifier).

### Schema

Six tables + one view (full DDL in docs/EVENTS.md, extended here with additions):

```
events          — append-only source of truth; includes occurred_at_suspect BOOLEAN
users           — upserted on identify/event with identity
companies       — upserted when a non-personal company_domain is seen
aliases         — anonymous_id (PK) → user_id, email, company_domain; last-write-wins
blocked_domains — seeded personal-email domains; founder-editable; loaded into in-memory Set
key_events      — founder-marked event names for readiness engine (v0.3)

events_v (view) — events + occurred_at_effective (CASE WHEN suspect THEN received_at ELSE occurred_at)
```

`user_count` on `companies` is NOT a stored column — it is `COUNT(DISTINCT user_id)` in dashboard queries (D-03).

### Deep-Module Opportunities

**Event Processor (`lib/processEvent`)** is the primary deep module. It has the most complex internals in the system — timestamp validation with asymmetric rules, anonymous_id derivation logic, domain classification, a multi-table write with best-effort semantics, and the future async seam. Its external interface is a single function. Tests written against this interface validate the entire ingestion contract without caring about the internals.

**Domain Classifier (`lib/domainClassifier`)** is the secondary deep module. The in-memory Set, TTL refresh, Postgres seed, and email-parsing logic are all hidden behind `classifyDomain(email)`. Nothing outside this module should reference `blocked_domains` directly.

### Auth & Security

Two write keys (D-05). Generated at first setup. Stored in `.env`. The ingestion endpoint validates the key before parsing the payload and enforces: `writeKey` → only `source: 'auto'` or `source: 'custom'`; `serverKey` → required for any `source: 'server'` event in the batch. Source is a per-event field, not a per-request field.

### Timestamp Policy

Three immutable fields per event: `occurred_at` (raw, from client), `received_at` (`NOW()` at ingestion), `occurred_at_suspect` (boolean, set once at insert). Policy on what to do with suspect timestamps lives in the `events_v` view, not in the insert path (D-06, D-07). Dashboard queries always use `occurred_at_effective` from `events_v`.

### CORS

`Access-Control-Allow-Origin: *` on `/api/ingest`. `OPTIONS` handled as fast stateless 204. No origin allowlist — security theater (D-09). Real abuse boundary: rate-limiting + write key pair.

### Company Display

`companies.name` is NULL in v0.1. Display layer computes `capitalize(strip_tld(domain))` at render time. Raw domain always shown alongside. Nothing stored (D-08).

---

## Testing Decisions

### What makes a good test here

Test external behavior, not implementation. A test should break if the contract changes, not if the internals are refactored. For C-thru v0.1, the contracts are: the ingestion endpoint's HTTP behavior, `processEvent()`'s write outcomes, and the domain classifier's classification outputs.

### Modules to test

**`lib/processEvent` (integration tests against a real test DB)**
This is the highest-value seam — it covers the ingestion contract end-to-end. Test cases should cover: valid browser event inserts (auto, custom); valid server event inserts with userId; server event rejection when identity is absent; `anonymous_id` derivation for server events (userId present; email-only; neither → rejected) (D-01); timestamp suspect-flag logic for both browser and server sources; future-timestamp rejection; `company_domain` derivation (personal domain → null, company domain → domain); aliases upsert on identify; best-effort behavior when derived upserts fail; partial-success within a batch (one future-dated event + one valid event → one rejected, one accepted).

**`lib/domainClassifier` (unit tests)**
Pure function with no external dependencies (after the Set is loaded). Test: known personal domains return null; unknown domains return the domain; edge cases (subdomains, missing `@`, capital letters, TLD-only inputs); `zoho.com` is in the default blocked list.

**`POST /api/ingest` (HTTP integration tests)**
Test the auth boundary: `writeKey` accepts auto/custom, rejects server events; `serverKey` accepts server events; missing key returns 401; wrong key type for source returns 403. Test CORS: `OPTIONS` returns 204 with correct headers; cross-origin `POST` is not blocked. Test rate-limiting: exceeding the limit returns 429 with `Retry-After`. Test per-event response: mixed batch returns 200 with correct per-event `accepted` flags.

**`events_v` view (SQL unit tests)**
Verify `occurred_at_effective` logic: non-suspect event returns `occurred_at`; suspect event returns `received_at`.

### What not to test

Do not test the dashboard SQL queries for exact numbers — they are fixed queries against real data; seed data in tests is fragile. Do not test internal implementation details of `processEvent()` such as which helper function was called. Test what comes out of the DB, not how it got there.

---

## Out of Scope

Everything v0.2 and later is explicitly excluded from v0.1:

- **Vibe analytics** (English → SQL → answer): v0.2
- **LLM integration of any kind** (no LLM key, no LLM call from C-thru's server): v0.2+
- **Readiness engine, rule builder, company scoring, morning brief**: v0.3
- **Funnels, retention charts, user journey view**: v0.3
- **Outreach drafting and one-click send**: v0.4
- **Session replay**: v0.5
- **Company name/logo/industry enrichment via external sources**: v0.6
- **Multi-tenancy / hosted cloud / billing**: v1.0
- **"Pin to Dashboard" from vibe answers**: v0.2
- **Third-party data scraping or LinkedIn enrichment**: never (guardrail)
- **Auto-sending outreach of any kind**: never (guardrail)
- **Predictive AI scoring**: never before v0.3+ and only with data

---

## Further Notes

**The "instant wow" moment is the companies list.** The v0.1 dashboard should load the companies view prominently — not buried. A founder seeing "4 users from razorpay.com" for the first time, using data they already had, is the core product experience. Design and UX priority should reflect this.

**Deploy ease is a feature.** The `docker compose up` path must work for a stranger with no prior C-thru knowledge. The README quickstart, `.env.example`, and automatic first-run migration (story 6) should be polished as part of the v0.1 definition of done, not treated as post-ship cleanup.

**`processEvent()` is the engine.** All future versions (readiness rules in v0.3, outreach triggers in v0.4) will read from the `events` table that `processEvent()` populates. Getting the schema and ingestion contract right in v0.1 is load-bearing. Do not rush it.

**Postgres is the only service dependency for v0.1.** Do not add Redis, a queue, a background worker, or ClickHouse. If Postgres is the bottleneck at some future event volume, the `processEvent()` seam (D-03) makes the async migration tractable. Resist premature infrastructure.

**The v0.1 companies view shows domains, not enriched names.** This is intentional and documented (D-08). The display-time name formatting ("Razorpay" from "razorpay.com") makes it feel clean, but no enrichment is stored or fetched. Do not add even a "free" external company lookup in v0.1.

**v0.1 uses at-least-once delivery; de-duplication is deferred.** The ingestion pipeline has no idempotency key or client event ID in v0.1. A server event like `payment_succeeded` can be stored twice if the founder's backend retries the `trackServer()` call after a network timeout. This is a known, conscious trade-off — not an oversight. Founders who need de-duplication in v0.1 should handle it at the application layer (idempotent event emission on their side). A client-supplied event ID for idempotent ingestion is a future concern.
