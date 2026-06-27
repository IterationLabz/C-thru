# DECISIONS.md — Resolved Design Decisions for C-thru

> Architecture decision record for decisions that are NOT derivable from the code alone.
> Each entry captures the decision, the rejected alternatives, and the reasoning.
> Add new entries here when a non-obvious design choice is made. Do not record obvious or default choices.

---

## D-01 — Server-event `anonymous_id` derivation

**Decision:** For `source: 'server'` events, set `anonymous_id = userId` when `userId` is present. When only `email` is present, set `anonymous_id = deterministic_hash(email)` (e.g. SHA-256 hex, truncated). Server events without either `userId` or `email` are **rejected at ingestion** — a server event whose purpose is ground-truth (e.g. `payment_succeeded`) is meaningless without knowing who it belongs to.

**Rejected:** generating a random UUID for identity-less server events. This creates a junk identity that links to nothing and pollutes the `users` table.

**Rejected:** exposing an `anonymousId` parameter in `trackServer()`. This would push browser-session complexity onto the founder's backend for a linking benefit that `user_id` already provides.

**Why `anonymous_id NOT NULL`:** keeps every query from null-checking the column. Server events are linked via `user_id`; `anonymous_id` is a secondary join handle for browser-side activity only.

---

## D-02 — Pre-login to post-login linking via aliases table

**Decision:** Add an `aliases` table (`anonymous_id TEXT PRIMARY KEY → user_id, email, company_domain`). On `cthru.identify(userId, { email })`, the ingestion API upserts into `aliases` with last-write-wins conflict resolution. Dashboard queries that need user attribution join `events.anonymous_id → aliases.anonymous_id → user_id`. Events are immutable — no retroactive `UPDATE` on the `events` table.

**Handles:** one user with multiple anonymous_ids (different devices/browsers) — each row in `aliases` independently resolves to the same `user_id`, so queries using `WHERE aliases.user_id = ?` correctly union all devices. Shared-computer edge case: last `identify()` call wins on the `anonymous_id` row.

**Rejected:** retroactive UPDATE of `events` on identify. Mutates event history, becomes slow as the table grows, and is not atomic.

**Rejected:** forward-only linking (pre-login events stay permanently anonymous). Breaks the signup funnel: all pre-login `pageview`/`click` events would never attribute to a company, making company grouping incomplete from day one.

---

## D-03 — Synchronous upserts inside `processEvent()`; derived `user_count`

**Decision:** All writes triggered by a single ingested event happen synchronously within one `processEvent()` call: (1) insert into `events`, (2) upsert `users`, (3) upsert `companies`, (4) upsert `aliases`. The event insert is the **critical write** — if it fails, return an error. The three derived upserts are **best-effort**: if they fail, log and continue; never let a locked `companies` row block the snippet response.

**`processEvent()` is the async seam:** v0.1 calls it synchronously. When scale demands a queue, the same function moves behind a worker with zero schema change. Do not build the queue now.

**`user_count` is NOT a running counter:** it is a `COUNT(DISTINCT user_id)` derived at query time in the dashboard. No per-event increment on the `companies` row — this prevents write amplification on high-traffic company rows.

**Why synchronous for v0.1:** async infrastructure (queues, workers) contradicts the "5-minute deploy" goal. At v0.1 scale (a self-hosted PLG founder's traffic), the latency cost is negligible.

---

## D-04 — Personal domain blocklist: seeded Postgres table + in-memory Set

**Decision:** Maintain a `blocked_domains` table seeded at migration with ~50 well-known personal email providers, including country-specific ones (qq.com, 163.com, 126.com, rediffmail.com, mail.ru, yandex.ru, gmx.com, and major Yahoo country variants). The founder can add/remove entries via settings. At server startup, load the full list into an in-memory `Set<string>`. The hot ingestion path does an O(1) Set lookup — no DB round-trip per event. Refresh the Set when the founder edits the list (or on a short TTL, e.g. 60 seconds).

**`zoho.com` is in the seed list but flagged:** `zoho.com` as the address domain is typically personal, but many small companies use Zoho-hosted custom domains. Founders may want to remove it. Note this in the settings UI.

**Bias toward false negatives:** a personal-email company record the founder can eyeball and ignore is recoverable. A silently missing company record (over-blocking) is not. When uncertain, don't block.

---

## D-05 — Unified ingestion envelope with two write keys

**Decision:** Single endpoint `POST /api/ingest`. Two authentication tokens:

- **`writeKey`** (public): ships in the browser snippet. May only submit `source: 'auto'` or `source: 'custom'` events. Anyone can read it from the page source — this is intentional and expected.
- **`serverKey`** (secret): lives only in the founder's backend `.env`. The only token permitted to submit `source: 'server'` events. Never shipped to the browser.

Request envelope:
```
{ "writeKey" | "serverKey": "...", "events": [ { "name", "source", ... } ] }
```

`source` is a **required field on every event object**, not on the request wrapper. Server SDK sends a batch-of-one in the same envelope shape.

**Enforcement:** if any event in the batch claims `source: 'server'`, the request must carry the `serverKey`; otherwise reject the entire batch. This is a security boundary, not a data-quality check — trust is determined by which key was presented, not by whether the event carries a `userId`.

**Why two keys, not one:** the browser snippet is public. An attacker who reads `writeKey` from the page source can POST anything. If a single key allowed `source: 'server'` claims, they could forge `payment_succeeded` events and poison the founder's ground-truth signals — the one channel whose entire value is being un-fakeable.

---

## D-06 — Source-split timestamp handling: flag-and-preserve

**Decision:** Never silently mutate or discard a client-provided `occurred_at`. Instead:

- `occurred_at`: the raw timestamp from the client or server SDK. Immutable after insert.
- `received_at`: always `NOW()` at ingestion. Immutable after insert.
- `occurred_at_suspect BOOLEAN NOT NULL DEFAULT false`: set at insert based on validation rules below. Immutable after insert — it is a **fact about the data**, not a policy.

**Validation rules by source:**

| Source | Future threshold | Past threshold |
|--------|-----------------|----------------|
| `auto` / `custom` (browser) | >5 min → reject (hard) | >24h → set suspect flag |
| `server` | any future → reject (hard) | >7 days → set suspect flag |

Server events allow a 7-day past window to accommodate webhook retries, queued jobs, and payment reconciliation batches carrying the true original timestamp. The threat defended against is "backdate 6 months to game scoring" — 7 days still blocks that.

**Rejected:** silently capping `occurred_at` to a valid range. Silent mutation makes the data lie without telling anyone — same anti-pattern as retroactive event updates.

---

## D-07 — `occurred_at_effective` Postgres view

**Decision:** Create a `events_v` view:

```sql
CREATE VIEW events_v AS
  SELECT *,
    CASE WHEN occurred_at_suspect
      THEN received_at
      ELSE occurred_at
    END AS occurred_at_effective
  FROM events;
```

All v0.1 dashboard queries target `events_v`, never the raw `events` table directly.

**Division of responsibility:**
- `occurred_at_suspect` is a fact set once at insert (immutable).
- `occurred_at_effective` is a policy resolved in the view (mutable — update the view definition if the policy changes, without touching the table or the insert path).

**Performance note:** the `CASE WHEN` in the view prevents clean index use on `occurred_at` when the suspect flag flips the column. At v0.1 volume this is a non-issue. If `occurred_at_effective` needs filtered/sorted at scale, the fix is a materialized column — not a v0.1 concern.

---

## D-08 — Display-time domain name formatting; storage stays honest

**Decision:** `companies.name` remains `NULL` (or equals the raw domain) in v0.1. No stored enriched name. Company name enrichment via external lookups is v0.6, off by default.

**Display layer** computes a presentational display name at render time:
```
display_name = capitalize(strip_tld(domain))
// "razorpay.com" → "Razorpay"
// "my-startup.io" → "My-startup"
```

The raw domain is always shown beneath or beside the display name so the founder sees the real source. This is formatting (same category as number formatting), not enrichment — nothing is stored.

**DoD correction:** CLAUDE.md §10 check 5 should read "See users grouped by company domain (e.g. `razorpay.com` with a user count)" — not "company name." The display-time derivation makes the UI look clean without overpromising.

---

## D-09 — Open CORS on ingestion; rate-limiting is the abuse boundary

**Decision:** The ingestion endpoint sets:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

`OPTIONS` preflight is handled as a fast, stateless 204 — no DB touch.

**Why wildcard:** the snippet runs on any site. This is the same posture as PostHog, Segment, and Mixpanel. CORS is not the security boundary for a public ingestion endpoint.

**Why not a founder-configured origin allowlist:** security theater. An attacker doesn't use a browser — they `curl` the endpoint with any `Origin` header they like. An allowlist blocks nothing malicious while actively breaking legitimate setups (staging domains, preview deploys, localhost, iframe embeds). Cost with no benefit.

**The real abuse defenses:** rate-limiting per IP / per `writeKey`, and the two-key system (D-05). CORS is irrelevant to server events, which are backend-to-backend and never go through a browser.
