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

---

## v0.2 — Vibe Analytics

> **The spine of v0.2:** the LLM authors SQL only — never numbers, never explanations, never causation. Everything the founder sees as truth is validated (AST + allowlist) and computed deterministically from queries that actually ran. "Show the SQL" covers the entire surface where the LLM had influence.

---

## D-10 — Correctness / Hallucination: three safety nets

**Decision:** Three layered safety nets, in ascending order of importance:

(a) **Event-name validation.** After SQL generation, extract string literals compared against the `name` column and cross-check against actual distinct event names in the DB. If a name doesn't exist, block execution and surface a "did you mean `payment_succeeded`?" suggestion before showing any result.

(b) **Always show scanned row count.** Never present a bare scalar. Every answer includes the number of rows scanned ("247 signups — aggregated from 1,893 events") so the founder has a magnitude check.

(c) **Curated semantic views as the query surface (primary net).** The LLM is constrained to a set of pre-built views (`events_v`, `signups_v`, `active_users_v`, `company_activity_v`, etc.) that already encode correct semantics — correct timestamp column, correct alias resolution, correct join logic. The LLM composes filters and aggregations over these correct primitives; it never re-derives joins against raw tables. This moves semantic correctness out of the LLM (probabilistic) and into the SQL layer (deterministic and tested) — the same principle as `events_v` in v0.1.

Additionally: SQL is validated against a table/column allowlist before execution. Anything referencing raw tables (`events.occurred_at`, columns not on the list) is blocked at the application layer.

**Why (c) is primary:** event-name validation and row counts catch surface mistakes. The curated-view constraint prevents the deepest failure mode — valid SQL that counts the wrong thing — by making it structurally impossible for the LLM to write semantically-incorrect joins.

**Rejected:** free-form LLM SQL against the raw schema with post-hoc validation only. The LLM would re-derive join logic on every query, getting it right probabilistically rather than deterministically.

---

## D-11 — LLM Key Security: env-var-backed, paste-in-UI convenience

**Decision:** Store the founder's LLM API key as `CTHRU_LLM_KEY` in `.env.local` — the same mechanism as `CTHRU_WRITE_KEY` and `CTHRU_SERVER_KEY`. The Settings page offers a paste-in UI for convenience; on save, the server writes to the env/secret store, never to a queryable DB column. The settings API returns only a masked hint (`sk-ant-...••••`), never plaintext. The key is never logged and is explicitly scrubbed from error messages, stack traces, and Next.js error overlays. It is decrypted/used in memory only at the moment of the LLM call.

**Why not DB-encrypted storage for v0.2:** this is single-tenant — the founder owns the DB, the filesystem, and any `ENCRYPTION_KEY` env var that would decrypt it. AES-256-GCM with a key derived from an env var stored on the same server protects against almost nothing that a plaintext env var doesn't, because the same person who can read the DB can also read the env var. The env var approach is genuinely more secure on the dimension that matters: the key never travels over HTTP, never hits a request body, eliminating API-leak failure modes entirely rather than mitigating them.

**v1.0 hosted cloud requirement (record here, do not forget):** when v1.0 holds many founders' keys in a shared multi-tenant DB, DB encryption with a KMS-managed key (not an env var on the same server) becomes mandatory. The threat model is real at that point — a DB breach exposes every customer's key. Revisit this decision at v1.0 scope.

**Non-negotiable regardless of storage:** (a) key never returned by any API in plaintext; (b) key never logged, stripped from all error surfaces; (c) used in memory only at LLM call time.

---

## D-12 — SQL Safety: AST parser as primary guard

**Decision:** Use a proper AST parser (`pg-query-native` or equivalent) as the primary SQL safety guard — not a first-token regex check. Walk the parsed tree and assert: every table/view referenced is in the permitted-views allowlist, every statement node is a SELECT, there are no multiple statements, no DDL/DML nodes anywhere in the tree, no function calls outside a permitted set.

**Single-statement enforcement:** anything parsing to more than one statement is rejected outright. This kills the `;`-stacking class entirely at parse time.

**Defense-in-depth beneath the AST guard:** read-only Postgres role (structural floor), `SET LOCAL statement_timeout = '8000'` (kills runaway queries at the DB level), inject `LIMIT 500` on the outermost query if absent (caps result set size).

**Why AST, not regex:** a first-token check is trivially defeated by `WITH x AS (...) SELECT ...` CTEs doing something nasty, or stacked statements where the dangerous part isn't the first token. You cannot reason about SQL safety by looking at the first word. The AST lets you walk the entire tree and enforce the allowlist structurally. This is the highest-risk execution path in the product — machine-generated SQL against the founder's data — and the one place where a real parser unambiguously earns its cost.

**Mental model:** the defense is "validate the structure of generated SQL" (prompt injection → malicious SQL), not "escape user input" (classic SQL injection). These are different problems; the wrong frame leads to the wrong fix.

---

## D-13 — Schema Context: hybrid auto-generated + hand-written

**Decision:** The schema context fed to the LLM on every query has two parts, joined at query time:

**Structure (auto-generated):** column names and types for permitted views, derived from `information_schema` filtered to the curated-view allowlist. Cached at startup. Can never mechanically drift — a column rename or addition is reflected automatically.

**Semantics (hand-written):** annotations keyed by `view.column`, checked into source (e.g., `events_v.occurred_at_effective: "use this, not occurred_at — already corrects for clock drift"`). This is the part that genuinely requires human meaning and cannot be derived from a type signature.

**Dynamic per-deployment:** top-50 event names by count, fetched from the DB at query time (short cache). The long tail of rare events adds tokens without helping SQL generation; top-50 is the right cut. This is also the data source for the D-10 event-name validation.

**CI assertions (both directions):** every permitted view exists in the DB; AND every hand-written semantic annotation maps to a real column in the auto-generated structure. A renamed column fails CI immediately — both the orphaned annotation and any drift in the structure are caught.

**Token budget:** the full schema context (structure + annotations + top-50 event names) must stay under 2,000 tokens — enforced as a CI assertion, not a vibe. This is the variable-cost floor on every `/ask` query.

---

## D-14 — Ambiguous / Unanswerable Questions

**Decision:** Try-first, name-the-interpretation, let them re-ask. No confidence-threshold gate.

**Ambiguous questions:** the LLM picks the most defensible interpretation, generates SQL for it, and the interpretation is displayed above the SQL — derived from the actual views and columns the SQL uses (e.g., "this query uses `active_users_v`" → label reads "Interpreting 'users' as active users"). The label and the SQL structurally cannot disagree because the label is derived from the SQL, not written freely by the LLM. If the founder's intent differs, they re-ask with more precision. One round-trip max.

**Unanswerable from schema:** return a refusal with a concrete, grounded suggestion drawn from real C-thru conventions (fed to the LLM), not LLM-invented event shapes. Example: "I don't have billing data. To answer this, add a `payment_succeeded` server event via `trackServer()` with an `amount` field."

**Unanswerable from data (zero rows):** surface the scanned row count — "scanned 12,400 events, 0 matched your filter" — so the founder can distinguish "I genuinely have no data for this" from "the filter is probably wrong." The D-10 event-name validation catches the wrong-event-name case before execution; the scanned count covers wrong-property filters that pass validation but return nothing.

**Rejected:** confidence-threshold gate. LLM-reported confidence is itself unreliable — models are confidently wrong — so the gate would fire on the wrong questions. The name-the-interpretation pattern gives the founder the same correction power with zero friction on the common case.

---

## D-15 — Trend Explanation: fully deterministic

**Decision:** The trend explanation shown below every answer is computed entirely deterministically. The LLM generates SQL and nothing else. It never produces numbers, trend labels, or explanations.

**Mechanism:** after the main query runs, automatically run a second comparison query covering the previous equivalent period (detected from the D-12 AST: if the main query filters `occurred_at_effective` over a bounded window, run the prior equal window; if not time-bounded, omit the trend entirely). Compute the delta arithmetically. Format as a deterministic string: "↑ 27% vs previous period (37 → 47)."

**Divide-by-zero / tiny-base:** when the previous period is 0 or near-zero, show raw counts without a percentage — "5 this period (0 previous)." A percentage off a near-zero base is statistical noise dressed as a signal.

**Why no LLM narrative on top of the deterministic delta:** the dangerous LLM addition is not a hallucinated percentage (the deterministic delta prevents that) — it is hallucinated causation. An LLM asked to "add context" will write "↑ 27%, likely driven by your mobile users" with no basis for that claim. A true number wearing a false explanation is more trust-destroying than a wrong number, because it sounds insightful. The LLM's role ends at SQL generation.

---

## D-16 — Cost and Rate: explicit-submit, measured display, CI budget

**Decision:**

**Explicit-submit only:** the `/ask` page submits only on deliberate user action (button click or Enter). No auto-refresh, no query-as-you-type, no re-running on page load. This prevents accidental cost burn without any server-side throttle.

**Founder picks the model in Settings:** cheaper models (GPT-4o-mini, Claude Haiku) are often better for this task — the schema is constrained and the SQL patterns are narrow. Cost-per-query is displayed as measured actual usage from API response token counts ("your last 10 queries averaged ~$0.002 each") once there's query history. Before history exists, show an approximation explicitly labeled "approximate — check your provider's current pricing." Never show a precise-looking hardcoded number that quietly goes stale.

**Schema context token budget as CI assertion:** the full schema context must stay under 2,000 tokens, enforced by a test that builds the actual context and asserts the limit. See D-13.

**No server-side rate limit on `/ask`, no per-session query budget:** single-tenant — the founder is the only user, and their LLM provider already rate-limits them at the API level. Server-side limits are redundant machinery solving a non-problem at v0.2 scale.

---

## D-17 — Provider Abstraction: Vercel AI SDK behind lib/llm.ts

**Decision:** Use the Vercel AI SDK (`ai` package) as the provider abstraction layer, behind a single internal module `lib/llm.ts` that exposes one function: `generateSql(question: string, schemaContext: string): Promise<string>`. The rest of C-thru calls `lib/llm.ts` exclusively — never the SDK directly.

**Why the Vercel AI SDK:** provider APIs (OpenAI, Anthropic, Groq) change constantly and differ in ways that are tedious to hand-maintain (Anthropic's `max_tokens` requirement, Groq's endpoint shape, response format differences). This is a moving external target maintained better by the Vercel team than by C-thru. The SDK is an offline npm package with no phone-home behavior — verify this before shipping, as it is load-bearing for the self-hosted/data-ownership positioning.

**Why a single `lib/llm.ts` module:** (a) the SDK becomes a swappable implementation detail — if it changes API or gets abandoned, one file changes, not every call site; (b) all v0.2 correctness guards (AST validation, curated-view constraint, schema-context injection, model selection) live in one place — one module to enforce, one place to test; (c) testable by mocking `lib/llm.ts` without burning real API calls.

**Dependency decision principle (explicit):** take a dependency when it solves a moving-target problem maintained better externally than internally. Provider APIs are exactly that. This is the same rule applied differently from other v0.2 choices: key storage (thin threat model → simpler), SQL validation (thickest threat model → stronger AST parser), provider abstraction (external moving target → take the SDK).

---

## D-18 — company_activity_v: query-time blocklist check, not ingestion-time

**Decision:** `company_activity_v` applies a `LEFT JOIN blocked_domains` on the COALESCE'd result (`COALESCE(e.company_domain, a.company_domain)`) with `AND bd.domain IS NULL`, making blocked-domain filtering happen at query time — the same moment as `signups_v` and `active_users_v`.

**The problem this solves:** before this fix, `e.company_domain` and `a.company_domain` were frozen at ingestion time by `classifyDomain()`. Adding a domain to the blocklist immediately removed it from `signups_v`/`active_users_v` (which join `blocked_domains` live), but left it visible in `company_activity_v` (which used the ingestion-frozen values). This caused contradictory LLM answers: "how many companies were active?" vs "how many companies signed up?" could disagree on the same domain — a silent trust failure.

**Why the join is on COALESCE, not on the raw columns:** retroactive attribution of pre-login events must still work. A pre-login event has `e.company_domain = NULL`; the company is attributed via `a.company_domain` once the user identifies. The blocked-domain check must apply AFTER this attribution resolves, not before — otherwise the COALESCE logic is undermined for blocked domains that happen to have pre-login events.

**Behaviour after this fix:** adding a domain to `blocked_domains` immediately removes it from all three views on the next query. Removing a domain from the blocklist immediately restores it. Historical events are re-attributed on every query — there is no stale ingestion-frozen state to clean up.
