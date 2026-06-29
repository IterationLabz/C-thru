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

---

## v0.3 — Readiness Engine

> **The spine of v0.3:** scored readiness is transparent rules over first-party data — NOT a black-box AI prediction. Every signal is a typed condition on a known query pattern. Every score comes with a full per-rule ✓/✗ breakdown. The breakdown is the trust mechanism, playing the same role "show the SQL" plays in v0.2.

---

## D-19 — Signal vocabulary: 5 typed company-level signals, equal weighting

**Decision:** Readiness rules operate over exactly five signal types: (1) active identified users in last N days, (2) total events in last N days, (3) days since last activity, (4) key event fired (by name), (5) days in product since first signup. A rule is one condition on one signal (`signal`, `operator`, `threshold`, `window_days`, `event_name`). Score = `rules_met / rules_total`, displayed as a fraction with a full per-rule ✓/✗ breakdown per company.

**Why the breakdown is mandatory, not optional:** "3/5" alone is as opaque as a black-box AI score. The breakdown — "✓ active users ≥ 3, ✓ ≥ 20 events, ✗ payment_intent never fired" — is the mechanism that makes the score auditable and correctable. A founder who disagrees with a score can see exactly which rule failed and why. Without the breakdown, the score is a number without evidence; with it, the score is a transparent verdict the founder can trust or override.

**Equal weighting is a deliberate constraint, not an accident:** `rules_met / rules_total` assigns every rule equal weight. This means rule selection IS the weighting mechanism — if `payment_intent` matters more than a page view count, the founder defines more rules around `payment_intent`, not a weight parameter. This is simple, transparent, and defensible. Unequal weighting deferred to v0.4+ once real founders validate which signals actually predict conversion.

**Rejected:** JSONB property rules ("event name = X AND properties.plan = 'pro'"). Rejected for the same reason as the v0.2 free-form SQL surface — introducing a query-construction path that can silently produce wrong results without structural auditability. A typed signal with a named condition is auditable; a free-form property predicate is not.

**Rejected:** founder-written SQL fragments as rule conditions. The entire value of typed signals is the guarantee that "every query this engine runs is one of five known-safe patterns." Founder SQL fragments reintroduce the injection surface and the semantic-error surface that the typed approach eliminates. Founders with unusual signals use `/ask` (vibe analytics) — that surface already exists and already has the SQL guard.

**Escape hatch for unusual signals:** `/ask`. A founder whose conversion signal doesn't fit any of the five types can answer it in vibe analytics; they just cannot make it a standing readiness rule until v0.4.

---

## D-20 — Morning brief: deterministic template, no LLM in the brief path

**Decision:** The morning brief sentence for each ready account is generated by a deterministic template, not an LLM. The brief pipeline is: (1) server computes a `BriefFact` struct per account from readiness rule results and event data — purely deterministic, no interpretation; (2) a template function produces the sentence from `BriefFact` fields; (3) no LLM is called.

Example output: `"Razorpay — 3 of 5 readiness signals met. 5 active users, 47 events in 7 days, active 2 days ago. Has not fired payment_intent."`

**`BriefFact` shape:** `{ domain, score: { met, total }, rules: Array<{ label, passed, value }>, topUsers: Array<{ email, eventCount }> (max 3), daysSinceLastActive, topKeyEventFired | null }`. `topUsers` is populated from `active_users_v` ordered by `total_events DESC`, limited to 3 — makes the brief actionable ("email Priya, your most active user there").

**`topUsers` is first-party data display, not enrichment.** These are users the founder already knows — their own product's logged-in users with emails the users themselves provided. This is distinct from v0.6 enrichment (third-party company data appended from external sources). No new data is introduced; only existing `active_users_v` data is surfaced.

**Why structure enforces honesty here, not a system prompt:** the brief is the highest-risk surface in C-thru — there is no SQL for the founder to inspect, so it must be incapable of lying. A prompted LLM (however well instructed) can smuggle in soft causation through word choice: "suggests they're evaluating," "indicates buying intent," "likely due to." These inferences sound authoritative and are fabricated. A template cannot hallucinate. "Robotic-but-true beats fluent-but-possibly-invented" on the screen the founder uses to decide who to email.

**Deferred:** LLM phrasing of the brief, conditional on a verification gate (every number/claim in the output must exist in `BriefFact`; inference verbs rejected). Deferred to v0.4+ — template only for v0.3.

---

## D-21 — Rule storage + score freshness: DB table, live 5-query computation

**Decision:** Readiness rules are stored as typed rows in a `readiness_rules` table (id, label, signal, operator, threshold, window_days, event_name, created_at). Five default rules are seeded in migration. A constrained form UI in Settings allows CRUD — no SQL, inputs constrained to the five signal types. Score is computed live at dashboard render time, not stored in a cache table.

**`evaluateSignal(rule, companyDomain)` is the single tested seam.** All five signal types are dispatched through one function with one `switch` on `signal`. Each branch generates one known-safe parameterized query pattern. The switch lives in one auditable place — every branch is unit-tested against seeded data, and the "every query is one of five patterns" guarantee is enforced structurally, not by convention. Callers receive `{ passed: boolean, value: string }` and never see query construction.

**Live computation is 5 batched GROUP BY queries, not 5×N looped queries.** Each signal query aggregates across all companies at once (`GROUP BY company_domain`), returning a map of `domain → computed value`. Rule evaluation then matches rules against the in-memory map. 200 companies = 5 queries total, not 1,000. This keeps live computation viable at self-hosted PLG scale (tens to low hundreds of companies) without requiring a background job or a staleness-management strategy.

**Why no cached score table:** a stale score table means the readiness score and the underlying view data can disagree — the exact failure mode the D-18 blocklist fix eliminated for `company_activity_v`. Live computation keeps score and data always consistent. Materialized caching deferred to v0.4+ if performance becomes a real problem at larger company counts.

---

## D-22 — Funnels: parameterized CTE chain, typed steps, dual mode

**Decision:** Funnel steps are stored as an ordered list of event names (`funnel_steps(funnel_id, step_order, event_name, label)`). A funnel is evaluated by generating a CTE chain of N CTEs — one per step — where each step is a parameterized bind variable, never an interpolated string. No founder-defined SQL fragments.

**Zero injection surface:** event names are `$N` bind parameters in a known structural pattern. The CTE chain structure is generated by C-thru's code (safe); only the event name values are founder-supplied (bound, safe). This is the correct resolution of the tension between "funnels need arbitrary event sequences" and "we cannot allow free-form SQL" — the structure is controlled, the values are parameterized.

**Event name validation before query execution:** before the CTE chain runs, batch-validate all step event names: `SELECT name FROM events_v WHERE name = ANY($1::text[])`. Any step name absent from the result is flagged as "this event has never been fired" and surfaces to the UI before the query runs. This prevents the silent-zero trust trap — a typo'd event name that produces 0% conversion at a step would be read as "everyone drops off here" when the event name is simply wrong.

**Dual mode — user-level and company-level:** `evaluateFunnel(steps, mode, companyFilter?)`. In `user` mode, each CTE step counts distinct `user_id`s who completed the ordered chain. In `company` mode, `company_domain` is added to each step's SELECT and GROUP BY, and the final count is `COUNT(DISTINCT company_domain)`. Company mode answers "what % of companies reached each step" — the natural B2B question. The query structure is identical; the grouping key changes. This is a cheap variant (2-3 conditional lines in the query generator), not a separate query path, so it ships in v0.3.

**Rejected for v0.3:** property-filter steps (`WHERE name = 'signup' AND properties->>'plan' = 'pro'`). Introducing property predicates requires exposing JSONB key paths, which is the JSONB rule builder rejected in D-19. Founders who need property-filtered funnel steps use `/ask`.

---

## D-23 — Journey view: pre-login events via alias join, first_identified_at seam

**Decision:** The user journey view (`/journey/[userId]`) shows the full chronological event timeline for one user, including pre-login (anonymous) events attributed via the `aliases` table. Pre-login events are not excluded — they are a meaningful part of the journey that show what the user did before identifying.

**Query structure:**
```sql
WITH user_anons AS (
  SELECT anonymous_id, first_identified_at
  FROM aliases WHERE user_id = $1
)
SELECT e.name, e.received_at, e.company_domain, e.anonymous_id,
       (e.user_id = $1 OR EXISTS (
          SELECT 1 FROM user_anons ua
          WHERE ua.anonymous_id = e.anonymous_id
            AND ua.first_identified_at <= e.received_at
       )) AS post_identification
FROM events_v e
WHERE e.anonymous_id IN (SELECT anonymous_id FROM user_anons)
   OR e.user_id = $1
ORDER BY e.received_at ASC
```

The CTE resolves the user's anonymous_id set cleanly once, avoiding the LEFT JOIN + WHERE contradiction that would effectively inner-join and miss events. `post_identification` uses `first_identified_at <= e.received_at` — not mere alias existence — so events that occurred before `identify()` was called correctly appear before the visual seam. See D-24 for the schema prerequisite.

**Why `first_identified_at`, not `aliases.updated_at`:** `updated_at` is last-write-wins (see D-02 and processEvent.ts). A user who identifies on a second device later moves `updated_at`, placing the seam at the wrong point in time. Every event for that anonymous_id would be flagged `post_identification = true` even if most occurred before identify() was ever called. The seam is the primary value of the journey view; placing it incorrectly is a silent correctness failure worse than not showing it at all.

**Properties deferred to v0.4.** The timeline shows event name, timestamp, and company domain. Raw JSONB property display requires a per-event-type schema to render meaningfully; without it, showing `{"plan":"pro","seats":5}` as raw JSON creates more noise than signal. Founders who need to inspect properties on a specific event use `/ask`.

**`/journey/[userId]` is a standalone route.** The query is purely `user_id`-driven with no required context param. Entry points in v0.3: the readiness breakdown (`topUsers` in `BriefFact`), `/ask` results where the result set includes a `user_id` column (rows link to the journey), and funnel step drilldown (users who completed or dropped at a step). A `?company` query param provides back-navigation context only — it is never used in the DB query.

---

## D-24 — Schema add: aliases.first_identified_at (immutable)

**Decision:** Add `first_identified_at TIMESTAMPTZ NOT NULL DEFAULT now()` to the `aliases` table. This column records the moment the first `identify()` call linked an `anonymous_id` to a `user_id`. It is set on INSERT and intentionally absent from the `ON CONFLICT DO UPDATE SET` clause — subsequent identify() calls (different device, updated email) never overwrite it.

**Migration:** `ALTER TABLE aliases ADD COLUMN first_identified_at TIMESTAMPTZ NOT NULL DEFAULT now()`. Backfill existing rows: `UPDATE aliases SET first_identified_at = updated_at` — this uses the most recent write time as the best available approximation for existing data where the true first identification time was not recorded.

**processEvent.ts change:** add `first_identified_at` to the INSERT column list, set to `now()` on first insert. The `ON CONFLICT DO UPDATE SET` clause continues to update `user_id`, `email`, `company_domain`, and `updated_at` — `first_identified_at` is the one column explicitly excluded.

**This is a prerequisite for D-23.** Without `first_identified_at`, the journey view cannot correctly place the identification seam — all pre-login events would be misclassified as post-identification because the alias row exists at query time regardless of when identify() was originally called.

**Test requirement:** a test that calls processEvent with identify() twice for the same anonymous_id (simulating re-identification on a new device) and asserts that `first_identified_at` does not change on the second call.

---

## D-25 — Draft fact contract: deterministic grounding + output discipline

**Decision:** The outreach draft is LLM-generated but grounded in a deterministic fact block built from `scoreCompany()` + `topUsers` only — no raw DB access, no freeform description. The fact block is a structured text payload constructed by the same pipeline already in production:

```
Company: razorpay.com
Rules met: 4/5
  ✓ Active users ≥ 3 (last 30d) — 7 users
  ✓ Total events ≥ 20 (last 7d) — 143 events
  ✓ Active in last 14 days — last active today
  ✓ Key event fired — payment_intent
  ✗ In product ≥ 7 days — 3 days

Top users (last 7 days):
  priya@razorpay.com — 63 events
  rahul@razorpay.com — 48 events
```

The LLM receives this block, the grounding constraint ("use ONLY these facts, do not infer anything not listed"), and the voice instruction (see D-30). The generation brief is deliberately narrow: "write a brief, friendly note stating that this team is actively using the product, and offer help" — not "write a compelling outreach email." Narrower brief = smaller hallucination surface.

**Why the defense is OUTPUT discipline, not prompt discipline.** The brief (D-20) uses a pure template because an LLM would smuggle in "suggests they're evaluating" through word choice — so we removed the LLM from that path entirely. The draft cannot be a pure template (a human must want to send it; it must read naturally). This is the one place where the LLM must generate free prose, which means hallucination cannot be prevented by removing the LLM — it can only be made visible and catchable before send. Three output discipline layers:

1. **Post-generation ungrounded-claims flag.** After generation, programmatically scan for phrases implying observed behaviour not in the fact block: `I saw you`, `I noticed`, `you've been exploring`, specific feature or page references absent from the rules. Flag these inline with ⚠ ("this line claims behaviour not in your data — verify before sending"). The flag won't catch everything; it surfaces the highest-risk hallucination class.
2. **Mandatory visible human review.** The draft is presented prominently and in full, editable, with send as a separate deliberate action. There is no "generate and send" shortcut — the structural separation is what makes hallucination catchable.
3. **Never-auto-send as the enabling guardrail.** The draft's reliance on LLM prose (unlike the brief's deterministic template) is only acceptable because the founder always reads and approves before anything goes out. The two decisions are coupled: if auto-send were ever allowed, the output-discipline layers would be insufficient. The primary backstop is the human.

**Grounding vs. the brief.** The morning brief (D-20) is deterministic and contains no LLM — "structure makes hallucination impossible." The draft's posture is different: "structure makes hallucination visible and catchable." Both are forms of the same Spine principle; the mechanism differs because the output requirement differs.

---

## D-26 — Channels + structural no-auto-send

**Decision:** v0.4 channels are **Slack webhook** and **copy-to-clipboard** only.

- **Slack webhook:** founder pastes one URL in Settings; C-thru POSTs a Slack-formatted message when the founder explicitly clicks the send button. No credentials beyond the URL. Serves "notify myself/team when an account tips over the threshold."
- **Copy-to-clipboard:** C-thru generates the draft text; founder copies, opens their own Gmail or email client, pastes, sends from their own address with their own deliverability identity.

**SMTP deferred.** Storing a founder's SMTP password is a credential risk (write access to send email as the founder). The server's IP will not be on the founder's SPF record, so email sent via C-thru would fail SPF/DKIM alignment and land in spam or be rejected. CAN-SPAM (physical address, unsubscribe mechanism) adds further surface. These belong in a dedicated later version with careful deliverability design, not bundled into v0.4.

**Structural never-auto-send — enforced by code, grep-verifiable:**

1. **Single-account send route only.** The API route / Server Action that fires a Slack POST or records a clipboard action takes a single `draftId` parameter. No batch endpoint exists.
2. **Idempotent on `sent_at`.** Before any send action the route checks `WHERE id = $draftId AND sent_at IS NULL`. If `sent_at` is already set, returns 409 and does nothing. A double-click sends once.
3. **UI-only entry point.** The send route is reachable only from an explicit form submit in the logged-in session (Server Action or POST-only route). No cron job, background queue, event listener, or polling loop calls it.
4. **Grep test.** `grep -r "sendDraft\|sendSlack\|evaluateTriggers" src/` must return only server actions and the page-load evaluation path — nothing in a scheduler or background task file. This is the mechanical verification that the no-background-caller guarantee holds.

---

## D-27 — Trigger lifecycle: draft-only, page-load evaluation, de-dup with re-arm

**Decision:** A trigger rule creates a **draft record only** — no send, no Slack message, no automatic outreach of any kind. The trigger is what makes v0.4 an engine rather than a button (the founder should not have to remember to check who's ready), but the safety comes from "trigger → draft (not send)" plus de-duplication.

**Trigger evaluation timing:** Synchronous during a founder-initiated page load (`/accounts` or `/outreach`). No background job, no cron, no queue. This preserves the no-background-caller guarantee from D-26 — the grep test must still pass after triggers are added. If trigger evaluation ever moves to a real scheduler in a future version, that is a deliberate documented decision, not drift.

**Draft states:** `pending` → `sent` | `dismissed`. No other transitions.

**De-dup key:** `(trigger_rule_id, domain)`.

**Full lifecycle:**
1. Account score crosses threshold → check for existing `pending` draft on `(trigger_rule_id, domain)`. Found → no-op. Not found → create draft (`status = pending`), record `triggered_at`.
2. Founder sends or dismisses → flip to `sent` / `dismissed`. Set `re_arm_eligible = false` on the `trigger_domain_state` row for this `(trigger_rule_id, domain)` pair.
3. On subsequent page-load evaluation: if account score **drops below threshold** → set `re_arm_eligible = true`.
4. On next evaluation: score above threshold **AND** `re_arm_eligible = true` → create new draft row, reset `re_arm_eligible = false`. Cycle restarts.

**Why this re-arm design.** Without it, two failure modes exist: (a) a continuously-hot account that stays above threshold after a send/dismiss never re-drafts even months later when a new reason to reach out emerges — too restrictive; (b) an oscillating score re-drafts constantly — spam. The dip-and-recross condition is the precise discriminator: a genuine new event (account went cold and came back) re-arms the trigger; an account that simply stays warm does not.

**`trigger_domain_state` table:** one row per `(trigger_rule_id, domain)` pair, holding `re_arm_eligible` (boolean). Separate from the `drafts` table, which holds one row per draft instance.

---

## D-28 — Outreach log: outbound audit trail

**Decision:** One row in `outreach_log` per send/copy action, recording:

| Column | Value |
|--------|-------|
| `draft_id` | FK to the draft record |
| `domain` | target company domain |
| `channel` | `slack` \| `clipboard_copied` |
| `recipient` | pre-filled from `topUsers[0].email`, founder-editable; log exactly what they left — if cleared, log null |
| `draft_text_snapshot` | frozen copy of the draft text **at action time**, not the generated text |
| `created_by` | `trigger` \| `manual` |
| `trigger_rule_id` | nullable; set when `created_by = 'trigger'` |
| `actioned_at` | timestamp of the copy or Slack send |

**`draft_text_snapshot` records what actually went out.** The founder edits before sending; logging the generated text would record intent, not action. The snapshot must capture the founder's edited version at the moment they click send/copy. This is the same integrity principle that applies throughout: the log must reflect reality.

**Clipboard labeled "Copied", not "Sent".** C-thru cannot verify clipboard delivery — the founder may not paste, may edit further, may not send. Claiming "Sent" would be a false record. In the log UI, clipboard entries and Slack entries are visually distinct (different icon, different label) so the founder can instantly distinguish "actually delivered to Slack" from "copied and may or may not have been sent."

**`created_by` + `trigger_rule_id`:** the founder will want to know whether C-thru surfaced an account or they went looking. It is also the signal for which trigger rules lead to actual sent outreach — which readiness rules predict real action. Cheap to record, useful for the founder's own learning.

**Scope boundary:** outbound audit only. No reply tracking, no thread history. Reply tracking requires either inbox access (the privacy surface refused throughout this project) or an SMTP integration that can thread (deferred in D-26). The log answers "what did I send/copy, to whom, when, what text" — not "did they reply."

---

## D-29 — Anti-spam guardrails: cooldown + suppression

**Decision:** Two mandatory structural guardrails. Neither replaces the human-in-the-loop from D-25/D-26; both reinforce it.

**A — Per-domain send cooldown.**
Default: 21 days, configurable in Settings.

Before any draft creation, check `outreach_log` for the domain: was anything copied or sent within the cooldown window?

- **Triggered drafts:** silently suppressed within cooldown. Automated paths fail safe and quiet — no draft created, no notification.
- **Manual drafts:** warn-but-allow. Show "You last contacted razorpay.com 8 days ago" but do not hard-block — the founder may have a legitimate reason.

The cooldown is the anti-annoyance instrument. It is overridable by design (for manual) because over-contact is a judgment call the founder may legitimately override. No daily cap across all domains — a cap would punish a founder with 20 genuinely ready accounts simultaneously. The per-domain cooldown is the precise instrument.

**B — Suppression list.**
A table of suppressed domains and email addresses. Checked at **two points**:

1. **Pre-creation:** before any draft is created (triggered or manual), check the suppression list. If the domain or recipient matches, no draft is created.
2. **Send/copy-time:** existing `pending` drafts are checked again at the moment of send/copy action. This catches entries suppressed after a draft was already created.

Suppression is a **hard block with no override**. Unlike the cooldown (warn-but-allow for manual), suppression has no severity gradient: a prospect who explicitly opted out has no legitimate override case. The UI presents no "proceed anyway" path.

**Suppression deletion — soft-delete with confirmation, compliance audit trail retained.** Suppression entries are not hard-deleted. Removal requires an explicit confirmation: *"This person asked not to be contacted. Removing them allows C-thru to draft outreach to them again. Are you sure?"* The row is soft-deleted (`removed_at` timestamp), preserving the opt-out history as a compliance artifact. This is distinct from the voice sample (D-30), which is hard-deleted — the suppression record has ongoing legal significance; the voice sample does not.

**Contextual compliance reminder.** A reminder surfaces when usage looks bulk-like (heuristic: ≥ 3 sends/copies to different domains within a 7-day window). Outside that threshold it does not appear — a reminder that is always visible becomes wallpaper. When it appears: "Personal 1:1 outreach only. For bulk email, add an unsubscribe mechanism and physical address." C-thru cannot technically enforce CAN-SPAM post-clipboard; the reminder is the honest boundary of what C-thru can do.

**Responsibility boundary:** C-thru is the tool; the founder is the data controller and the sender. C-thru's structural obligation is to make the compliant path the path of least resistance (cooldown, suppression, single-account send, honest labeling). The founder's legal obligation covers what they do with the clipboard.

---

## D-30 — Founder voice: plain-text sample, minimal and explicit

**Decision:** The founder provides a voice sample: 2–5 sentences of their own writing (an email they've sent, a Slack message they liked the tone of), pasted into a plain textarea in Settings. Stored as a plain text string. Optional, with fallback to generic professional tone.

**System prompt layering — voice alongside grounding, not instead of it:**

```
[Fact block — scoreCompany() + topUsers, deterministic (D-25)]
[Grounding constraint — "use ONLY these facts, do not infer anything not listed"]
[Voice instruction — "match the tone and phrasing of this sample: [sample]"]
[Output gate — post-generation ungrounded-claims scan runs regardless of voice mode (D-25)]
```

The voice sample is style instruction only. A casual voice in the sample does not relax the fact constraint — the grounding and the ungrounded-claims gate apply regardless of tone. "He writes informally" does not unlock "I noticed you've been exploring our billing page."

**UI shows which mode.** Draft displays "Drafted in your voice" or "Generic tone — add a voice sample in Settings to personalise." The founder knows what they are about to send.

**Hard-delete on request.** Deleting the voice sample removes the row entirely — no `removed_at`, no archive. The voice sample is personal data (the founder's own writing) with no retention justification after deletion. This is distinct from the suppression list (D-29), which is a compliance artifact with legal significance worth preserving. The founder must be able to see exactly what is stored and delete it completely — this is the privacy test the sample passes and that any other voice-capture approach must also pass.

**Three locked rejections — privacy principle, not v0.4 shortcuts:**
1. **No inbox analysis.** Reading sent emails to derive voice requires inbox access — the privacy surface refused at every turn in this project.
2. **No learning from draft edits.** An implicit style model derived from the founder's edits over time is uninspectable (they cannot read it), undeletable (it has no clean boundary), and persistent (it grows without consent). This is the "creepy" the plain-text sample avoids.
3. **No embeddings.** Opaque, not human-readable, cannot be cleanly deleted. Fails the "founder can see exactly what's stored and delete it completely" test.

These are not deferred to a later version with better implementation — they are wrong in principle for any version where self-hosted, founder-as-data-controller privacy is the product promise.

---

## v0.5 — Session Replay

> **v0.5 is architecturally different from v0.1–v0.4.** The Spine principle ("deterministic facts, LLM only phrases") does **NOT** apply here. Session Replay has no LLM and no facts to validate — it is a capture + masking + storage + playback problem. The central safety risk is privacy (masking must fail safe); the central engineering risk is storage volume.

---

## D-31 — Retention background job: C-thru's first scheduled background job

**Decision:** v0.5 introduces C-thru's first scheduled background job — a dedicated lightweight `cleanup` service in `docker-compose` that runs the retention DELETE nightly.

**This is consistent with D-26, not a reversal.** D-26 banned auto-send from a scheduler for safety: a human action (outreach) must not fire automatically. Retention is different on both counts: it is maintenance with no human-action substitute (a privacy guarantee cannot depend on the founder remembering to visit a page), and it causes no harm by running automatically. The ban in D-26 was targeted — "no scheduler calling sendSlack/recordCopy/evaluateTriggers" — not a blanket prohibition on all background work.

**The cleanup service does retention only.** It must not import or call `sendSlack`, `recordCopy`, `evaluateTriggers`, or `createTriggeredDraft`. The D-26 grep test is updated accordingly: it now asserts both (a) that send/trigger identifiers appear only in the allowed set (unchanged), AND (b) that the cleanup service exists and touches only retention deletion — never the send/trigger surface. The grep test expands to verify the boundary in both directions.

**DELETE semantics:**
- Deletion is by session (all chunks belonging to an expired session deleted together, never orphaned chunks left behind).
- Idempotent: running twice produces the same result.
- Logged: each nightly run records count of sessions deleted and bytes freed, so retention enforcement is verifiable and auditable rather than invisible.
- `expires_at` is set at write time when a session is first stored. Shortening the retention window applies retroactively at the next nightly run (any session with `expires_at` in the past is deleted, regardless of when `expires_at` was set).

**Deployment:** the cleanup service is added to the existing `docker-compose.yml` — still a single `docker compose up`.

---

## D-32 — Masking: block-by-default, fail safe

**Decision:** rrweb captures the full DOM. All `<input>`, `<textarea>`, and `<select>` values are masked at capture time in the browser snippet, always. Founders allow-list specific safe fields via `data-cthru-record` attribute. Misconfiguration fails safe (masked, not leaked).

**Permanent-block list** (type=password, credit-card fields, `autocomplete=cc-*`) is never recordable and cannot be overridden by the allow-list. Permanent-block always wins over `data-cthru-record`. This class receives element-level blanking (the element's presence may appear in the DOM snapshot, but its contents and rendered value are replaced). Ordinary default-blocked fields receive value masking (element structure visible, value replaced with a placeholder).

**Masking happens in the snippet before transmission.** The real value never leaves the browser. A structural test asserts this: the test installs the snippet, fires events containing sensitive field values, and inspects the outbound payload to assert the real value does not appear anywhere in it. This is the v0.5 structural safety proof — the replay equivalent of the never-auto-send grep test in D-26.

**Failure mode is always privacy-safe.** A missing or misspelled `data-cthru-record` attribute means the field stays masked. There is no configuration path that produces a leak; only explicit correct allow-listing produces recording.

---

## D-33 — Storage: single-Postgres, chunked BYTEA, client-side compression

**Decision:** rrweb event streams are stored gzip-compressed in a dedicated `session_recordings` table as BYTEA chunks. Chunks use **sequence numbers** (not timestamps) for deterministic ordering — sequence numbers are monotonic integers assigned at write, immune to clock skew.

**Compression is client-side, before transmission.** The wire payload is masked + compressed. Server stores the compressed bytes directly. This minimises both bandwidth and storage without requiring server-side CPU per recording.

**No separate object store.** A separate blob store (S3, MinIO) contradicts the one-command deploy goal. For the target scale (hundreds of active users, 30-day retention window), single-Postgres stays under ~10 GB — manageable on modest hardware. The storage ceiling is documented honestly in the UI/docs: beyond a stated sessions-per-day threshold, single-Postgres is outgrown and a separate object store is the upgrade path.

**Storage ceiling is only honest because D-31 retention actually runs.** The ceiling estimate assumes the nightly cleanup deletes expired sessions. If the cleanup service is disabled or broken, storage grows without bound. The two decisions are load-bearing on each other.

**Chunk reassembly is round-trip tested:** the test suite verifies chunk → store → reassemble → stream is byte-identical to the original, and that sequence gaps produce a detectable "incomplete" result rather than silently missing events.

---

## D-34 — Capture scope: identified sessions only, buffer-then-commit-on-identify

**Decision:** By default, C-thru records only sessions where `cthru.identify()` fires. Anonymous-only sessions are never transmitted or stored.

**The model is buffer-from-session-start, commit-on-identify, discard-if-never-identified** — not start-recording-at-identify. The pre-identify behavior (what the user did before logging in) is the most valuable part of the session, because it shows the path that led to identification. Starting the recording only at `identify()` would miss exactly the portion that explains the conversion or drop-off. This is the same insight as D-23's journey seam: pre-login events belong in the record.

**Buffer constraints:**
- The buffer is capped (duration and size) with oldest events evicted when the cap is reached. Memory stays bounded regardless of how long before `identify()` fires.
- Masking (D-32) is applied before buffering — raw sensitive values never exist in the buffer even transiently.
- When `identify()` fires, the buffer is flushed as a unit. If `identify()` never fires, the buffer is discarded client-side.

**Sampling** is decided per-session at flush time (atomically, based on the configured sample rate). No partial sessions — a session is either fully recorded or not recorded at all.

**Readiness-linked capture** (only record sessions for accounts that meet readiness thresholds) is the natural v0.5.x follow-on — not v0.5 scope.

---

## D-35 — Identity linkage: reuse the alias model, derive company_domain at query time

**Decision:** `session_recordings` stamps `anonymous_id` and `user_id` at flush (immutable facts known at identify-time). The existing `aliases` table and identity model are reused unchanged — no parallel identity system, no new linkage table.

**`company_domain` is NOT stored on session_recordings.** It is derived at query time via `user_id → users.email → blocklist join`, exactly as D-18 established for `company_activity_v`. Stamping `company_domain` at flush would freeze the value at a point in time and cause stale reads if the blocklist changes — a session recorded before a domain was blocked would appear in the account view after blocking. Query-time derivation inherits the D-18 blocklist-consistency guarantee automatically.

**Schema:** `session_id, anonymous_id, user_id, started_at, ended_at, expires_at, chunk_count`. No `company_domain` column.

**Surface in existing views:**
- **Journey view:** inline "recording available" marker at session start (before the identification seam), covering the pre-identify portion. Placement is at `session.started_at`, not at `identify()` — correct positioning for the buffer-then-commit model.
- **Account view:** recording count + link per domain, derived at query time from `user_id` → domain join.

---

## D-36 — Playback: context-first entry, shared completeness definition

**Decision:** rrweb `@rrweb/player` is fed a reassembled stream. v0.5 provides no standalone `/replay` index — entry is always context-first (from the journey marker or account view recording count). Player at `/replay/[sessionId]`.

**Player UI:** play/pause, scrubber, 2× speed, metadata panel (user, domain, duration, started_at), masking notice as a policy statement ("C-thru masks input values by default") — an always-true claim about the system, not a per-session assertion that could vary. Three failure modes handled explicitly:

1. **Incomplete recording:** banner at top of player ("recording is incomplete"), playback continues with available data, no crash.
2. **Large session:** progressive playback — stream snapshot chunk + first N seconds, then continue streaming remaining chunks. Up-front integrity check completes before playback starts.
3. **Expired / deleted:** clear message "deleted per retention policy" — not a 404.

**"Complete" has one shared definition** used by both the D-33 chunk reassembly test and the player's incomplete banner: snapshot chunk present AND chunks 1..N in sequence with no gap in sequence numbers. The player does not define "incomplete" differently from the storage layer.

**Pre-playback integrity check runs before progressive playback starts.** Compare `session.chunk_count` to chunks actually present in the DB + confirm snapshot chunk exists. Incompleteness is known up front, not discovered mid-play. This check is cheap (one COUNT query) and eliminates the mid-play surprise failure mode.

---

## D-37 — Consent and disclosure: off by default, data-controller boundary

**Decision:** Session Replay is OFF by default at the feature level. The snippet loads and events capture, but rrweb does not initialize until the founder explicitly enables Session Replay in Settings. Off is the starting state; the founder must make a deliberate choice to turn it on.

**First enable requires an explicit acknowledgment**, not just a toggle. When the founder enables Session Replay for the first time, they see a short template privacy-policy clause they can adapt (generic, adaptable without a lawyer, explicitly labeled "not legal advice"), and must check: "I have disclosed session recording to my users." This acknowledgment is **persisted as an audit record** — timestamp + version of the clause shown — same audit-trail logic as the D-29 suppression soft-delete. If a founder ever needs to demonstrate they took disclosure seriously, the record exists. C-thru asked; the founder confirmed; the date is logged.

**Retention window is colocated with the enable toggle** in Settings. The founder sees "recordings auto-delete after [N] days" on the same screen where they enable the feature, because retention is part of their compliance posture and should not require navigation to find.

**C-thru does NOT block recording for EU IP addresses.** IP-based blocking would:
1. Create false compliance assurance — GDPR applies to data subjects, not IP geographies; VPNs and corporate proxies make IP-based jurisdiction unreliable.
2. Have C-thru make a legal determination (this user is EU, GDPR applies, block them) that belongs to the data controller, not the tool.
3. Silently gap the founder's recordings without explanation, breaking a feature they deliberately enabled.

False assurance is worse than none. The data-controller framing is the correct boundary: C-thru is the tool; self-hosted + masked + auto-deleting is the strongest structural privacy posture C-thru can offer. Disclosure and lawful basis are the founder's responsibility, made easy — not C-thru's responsibility to enforce by proxy.

**Responsibility boundary (same as D-29):** C-thru is the tool; the founder is the data controller. C-thru's obligation is making the compliant path the path of least resistance (off-by-default, explicit acknowledgment, template clause, retention window visible, persistent audit record). The founder's legal obligation covers their users' consent and lawful basis under applicable privacy law.
