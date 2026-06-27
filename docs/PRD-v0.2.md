# PRD — C-thru v0.2: Vibe Analytics

> Scope: v0.2 only. Everything v0.3 and later is explicitly out of scope.
> Definition of done: a founder asks "how many signups last week?", sees the SQL,
> gets the correct number + a deterministic trend line, and can pin the answer to their dashboard.
> Implementation decisions reference docs/DECISIONS.md entries (D-10 through D-17).

---

## The Spine

> **The LLM authors SQL only — never numbers, never explanations, never causation.**
> Everything the founder sees as truth is validated by an AST parser and computed
> deterministically from queries that actually ran against their real data.
> "Show the SQL" covers the entire surface where the LLM had any influence.

This is the non-negotiable correctness principle of v0.2. Every implementation decision
flows from it. Deviate from it and the product dies — a wrong number destroys trust forever
(CLAUDE.md §8).

---

## Problem Statement

A PLG founder using C-thru v0.1 now has a stream of real behavioral data — events, users,
companies, aliases — all on their own Postgres. But extracting answers from that data still
requires either: (a) building a new chart and waiting for it to render, or (b) writing SQL
directly. Neither is viable for the operational questions that come up daily:

- "Which companies spiked in activity this week?"
- "How many users hit the paywall but didn't convert?"
- "What's the 30-day retention for users who completed onboarding?"
- "Are signups trending up or down compared to last week?"

The founder knows the question. They do not know the SQL. The dashboard only shows what was
built in advance. There is no path from "I have a question" to "I have an answer" that doesn't
require a developer or a waiting period.

The consequence: the data the founder spent effort collecting sits underused. The promise
of "your data answers your questions" is not yet redeemed.

---

## Solution

C-thru v0.2 adds a Vibe Analytics layer directly on top of the v0.1 tracker.

The founder types a question in plain English on a new `/ask` page. C-thru sends the
question plus a curated description of the schema to the founder's own LLM API key.
The LLM generates SQL. C-thru **shows that SQL** to the founder before and alongside
the result (the primary trust mechanism). The SQL is validated by an AST parser against
an allowlist of safe, semantically-correct views. It runs against a read-only Postgres
role with a hard timeout. The answer is displayed with the count of rows scanned
(magnitude check). A deterministic comparison query computes the trend for the prior
equivalent period — no LLM involved in the numbers. Any answer can be pinned to the
main dashboard as a permanent chart.

The founder never writes SQL. They never see a hallucinated causation explanation. They
always see the SQL that produced their number. Their LLM key stays on their server.
Their data never leaves.

---

## User Stories

### LLM Key Setup & Model Selection

1. As a founder, I want to set my LLM API key by adding `CTHRU_LLM_KEY` to `.env.local`, so that my key never passes through a web form and is handled exactly like my other secrets (`CTHRU_WRITE_KEY`, `CTHRU_SERVER_KEY`).
2. As a founder, I want the Settings page to offer a paste-in field for convenience, so that I can set the key without editing a file directly — but I want the server to write it to the env/secret store, never to a queryable database column.
3. As a founder, I want the Settings page to display only a masked hint of my key (`sk-ant-...••••`, first 4 + last 4 chars), so that I can confirm the key is set without it being exposed via the settings API response.
4. As a founder, I want the Settings page to tell me clearly if no LLM key is set (with a prompt to add one), so that I understand why the `/ask` page is unavailable.
5. As a founder, I want to select my LLM provider and model (OpenAI GPT-4o-mini, GPT-4o, Anthropic Claude Haiku, Claude Sonnet, Groq Llama) in Settings, so that I can choose the cost/quality trade-off that fits my usage.
6. As a founder, I want to see the measured average cost-per-query ("your last 10 queries averaged ~$0.002 each") once I have query history, so that I know what the feature is actually costing me from my key.
7. As a founder, I want the cost display to use my real token usage from LLM API responses, so that I never see a stale hardcoded estimate that quietly becomes wrong when providers change pricing.
8. As a founder, I want any hardcoded cost-per-model estimates (shown before I have query history) to be explicitly labeled "approximate — check your provider's current pricing," so that I'm not misled by a confident figure that may be outdated.
9. As a founder, I want a "Verify key" button in Settings that sends a minimal test request to my LLM provider, so that I can confirm the key works before I try to use `/ask`. The test request must be near-zero-cost (a single short completion, e.g. "Reply OK") — not a full schema-context prompt — so that verification doesn't burn meaningful tokens from my key.
10. As a founder, I want a link from the Settings page to the `/ask` page (and vice versa) once a key is configured, so that the flow from setup to first query is obvious.

### The /ask Page — Input & Submission

11. As a founder, I want a `/ask` page with a single text input where I can type any question about my product data in plain English, so that I can get answers without knowing SQL.
12. As a founder, I want the question to submit only when I explicitly press a button or hit Enter, so that no query fires automatically and I'm never charged for an accidental submission.
13. As a founder, I want the `/ask` page to be unavailable (with a clear explanation and a link to Settings) if no LLM key is configured, so that I'm not shown a broken experience.
14. As a founder, I want example questions pre-populated on the `/ask` page ("How many signups last week?", "Which companies are most active?", "What events did users from acme.com trigger?"), so that I know what kinds of questions are answerable.
15. As a founder, I want the input to stay editable after a result is shown, so that I can refine my question without clearing the page.
16. As a founder, I want a loading state with a short message ("Generating SQL…", "Running query…") while the system is working, so that I know my query is in progress and not stuck.
17. As a founder, I want previous queries in the session shown as a history list, so that I can revisit or re-run earlier questions without retyping them. This history is in-memory client state only — it is not persisted to a DB table, does not survive a page refresh, and requires no server round-trip to render.

### SQL Generation & Display

18. As a founder, I want my question and a curated schema description to be sent to my LLM, which returns a SQL query targeting only the safe, semantically-correct views, so that the generated SQL is correct by construction rather than by luck.
19. As a founder, I want the generated SQL to be shown to me **before the result** (or prominently alongside it, above the answer), so that I can inspect the query that produced the number I'm about to trust.
20. As a founder, I want the SQL displayed in a syntax-highlighted, read-only code block, so that it's easy to read and clearly marked as the source of the answer.
21. As a founder, I want a "Copy SQL" button next to the displayed query, so that I can run it myself in a DB client for deeper inspection or adaptation.
22. As a founder, I want the displayed SQL to be exactly the SQL that ran — the `normalizedSql` returned by `sqlGuard`, which is the post-validation, post-LIMIT-injection version — so that what I read matches what executed. The raw LLM output is never shown to the founder directly.
23. As a founder, I want to see a named interpretation above the SQL ("Interpreting 'users' as active users — this query uses `active_users_v`"), so that if the LLM's interpretation of my question differs from my intent, I can spot it immediately and re-ask.
24. As a founder, I want the interpretation label to be derived from the actual views the SQL references (not free prose generated by the LLM), so that the label and the SQL structurally cannot disagree.

### SQL Validation & Safe Execution

25. As a system, I want every LLM-generated SQL query to be parsed by a proper AST parser before execution, so that the structure of the query is validated — not just its first word.
26. As a system, I want the AST validation to reject any query that references a table or view not in the permitted-views allowlist, so that the LLM cannot reach raw tables (e.g. `events.occurred_at` directly) or any column outside the approved set.
27. As a system, I want the AST validation to reject any query that is not a pure SELECT statement — no DDL, no DML, no multi-statement batches — so that even a prompt-injected malicious query cannot mutate data.
28. As a system, I want single-statement enforcement at the AST level — anything parsing to more than one statement is rejected outright — so that `;`-stacking attacks are killed at parse time, not by relying on the read-only role alone.
29. As a system, I want all validated SQL to run against a read-only Postgres role that has SELECT-only permissions on the permitted views, so that a flaw in the AST validation cannot cause writes even if something slips through.
30. As a system, I want every LLM-generated query to run with `SET LOCAL statement_timeout = '8000'`, so that runaway queries (large cartesian joins, missing WHERE clauses) are killed by Postgres after 8 seconds rather than locking up the server.
31. As a system, I want a `LIMIT 500` injected on the outermost query if the generated SQL does not already include one, so that result set size is capped regardless of what the LLM generates.
32. As a system, I want string literals compared against the `name` column to be cross-checked against the actual distinct event names in the founder's database before the query runs, so that a misspelled event name is caught with a "did you mean `payment_succeeded`?" suggestion rather than silently returning zero rows.
33. As a founder, I want to see a clear, actionable error message if my query fails validation (e.g. "This query references a table C-thru doesn't permit. Please rephrase your question."), so that I know why it was blocked and what to do next.

### Answer Display & Correctness Signals

34. As a founder, I want the answer to my question displayed clearly below the SQL — the actual query result, formatted for readability (table for multi-row results, single large number for scalar aggregates), so that I can read the answer immediately.
35. As a founder, I want every answer to include the count of rows scanned ("aggregated from 1,893 events" or "12,400 rows scanned, 0 matched your filter"), so that I can perform a magnitude check and catch answers that look plausible but are drawn from suspiciously little data.
36. As a founder, I want zero-row results to display the scanned count alongside the zero ("scanned 12,400 events, 0 matched your filter"), so that I can tell "I genuinely have no data for this" from "the filter is probably wrong."
37. As a founder, I want multi-row results to be shown as a sortable table with column headers, so that I can quickly read ranked or grouped results (e.g. "top companies by event count").
38. As a founder, I want scalar results (a single number) to be shown large and clearly, so that a one-number answer to a one-number question is immediately visible.

### Interpretation, Ambiguity & Unanswerable Questions

39. As a founder, I want ambiguous questions to be answered with the most defensible interpretation rather than blocked by a clarification gate, so that I get a fast answer on the common case and only need to re-ask when the interpretation was wrong.
40. As a founder, I want the named interpretation (story 23–24) to make the LLM's assumption explicit so that re-asking with a corrected phrasing is easy when the interpretation differs from my intent.
41. As a founder, I want questions that are unanswerable from the available schema (e.g. "what's our MRR?") to return a clear, grounded refusal with a concrete suggestion ("I don't have billing data. To answer this, add a `payment_succeeded` server event via `trackServer()` with an `amount` field."), so that I know both why the question can't be answered and how to fix that.
42. As a founder, I want the refusal suggestion to reference real C-thru conventions and event shapes — not LLM-invented patterns — so that the product-education suggestion is actionable rather than plausible-sounding fiction.
43. As a founder, I want a question about data that exists in the schema but returns zero results to be handled gracefully with the scanned-row display (story 36), so that I can distinguish "I haven't tracked this" from "the query is wrong."

### Deterministic Trend

44. As a founder, I want a trend shown below every time-bounded answer ("↑ 27% vs previous period — 37 → 47"), so that I can see direction immediately without asking a follow-up question.
45. As a founder, I want the trend to be computed by running a second comparison query covering the prior equivalent period, so that the trend is a real number derived from real data — not an LLM-generated estimate.
46. As a founder, I want the trend's time window to be detected from the AST of the main query (the same parse from validation), so that the comparison period exactly mirrors the main query's filter rather than being guessed.
47. As a founder, I want no trend shown when my question is not time-bounded (e.g. "total users ever"), so that I never see a bogus trend on a non-temporal question.
48. As a founder, I want the trend to show raw counts when the previous period is zero or near-zero ("5 this period (0 previous)"), so that I'm never shown a meaningless or misleading percentage derived from a near-zero base.
49. As a founder, I want trend arrows (↑ / ↓ / →) and color coding (green/red/neutral) on the trend display, so that the direction is readable at a glance.
50. As a founder, I want to be confident that no LLM-generated text appears anywhere in the trend display — no causation, no explanation, no "likely driven by" — so that the number I see is always arithmetically derived from two query results.

### Pin to Dashboard

51. As a founder, I want a "Pin to Dashboard" button on every `/ask` result, so that I can promote any answer I find valuable into a permanent chart on the main dashboard.
52. As a founder, I want pinned answers to be stored as saved queries (the `normalizedSql` — post-validation SQL — plus display settings) in a `pinned_queries` table, so that the chart re-runs against live data on every dashboard load rather than showing a frozen snapshot. The stored SQL is always the validated form, never the raw LLM output.
53. As a founder, I want pinned charts on the main dashboard to show the same answer, scanned row count, and trend as they did on the `/ask` page, so that the pinned experience is consistent with the query experience.
54. As a founder, I want to be able to give a pinned chart a custom name ("Signups last 7 days") so that the dashboard shows a meaningful label rather than the raw question I typed.
55. As a founder, I want to unpin a chart from the dashboard, so that I can remove answers that are no longer relevant without having to restore to a default.
56. As a founder, I want pinned charts to appear in a dedicated section on the dashboard below the fixed metric cards, so that the dashboard retains its pre-built overview and my custom charts are clearly additive.
57. As a founder, I want a link from each pinned chart back to the `/ask` page with that question pre-filled, so that I can iterate on a pinned answer (refine the question, adjust the window) without retyping it.

### Cost & Usage Transparency

58. As a founder, I want to see a running token count and cost estimate for each query result ("this query used ~1,840 tokens, est. $0.002"), derived from the actual token usage returned by my LLM API response, so that I can track what the feature costs me per query.
59. As a founder, I want a usage summary in Settings showing total queries run and estimated total cost since the key was configured, so that I can decide if I want to switch to a cheaper model.
60. As a founder, I want the cost display to handle missing token data gracefully (some providers do not return usage in all modes), so that the feature doesn't break if the API response omits token counts.

---

## Implementation Decisions

### The Spine (repeat it here for emphasis)

The LLM's role is narrow and fixed: receive a question and a schema context, return SQL. It never produces numbers, trend labels, interpretations, explanations, or causation claims. Every output the founder sees as factual is produced by a deterministic code path that ran an actual query against actual data.

### Major Modules

**`lib/llm.ts` — LLM provider abstraction (deep module, primary seam)**

Single exported function: `generateSql(question: string, schemaContext: string): Promise<string>`.

Implemented using the Vercel AI SDK (`ai` package), which abstracts OpenAI, Anthropic, and Groq behind a unified interface. The rest of C-thru never imports the AI SDK directly — all LLM interaction goes through this one module. This makes the SDK a swappable implementation detail: if it changes API or is abandoned, one file changes. It also means all correctness guards that wrap the LLM call are co-located here.

The Vercel AI SDK is an offline npm package — verify it makes no phone-home requests before shipping (load-bearing for the self-hosted/data-ownership positioning).

Model and provider are resolved from `CTHRU_LLM_PROVIDER` and `CTHRU_LLM_MODEL` environment variables, set by the founder in `.env.local` or via the Settings paste-in UI (which writes to the env store, never a DB column).

**`lib/sqlGuard.ts` — AST validation and safe execution pipeline (deep module)**

This module wraps `generateSql`, validates the output, and executes it safely. It is the second deep module of v0.2. Proposed interface:

```
validateAndRun(sql: string): Promise<{
  rows: Record<string, unknown>[];
  rowsScanned: number;
  normalizedSql: string;  // post-validation, post-LIMIT SQL that actually ran
}>
```

Internally it:
1. Parses the SQL with `pg-query-native` (AST parser)
2. Walks the tree: asserts SELECT-only, single statement, no DDL/DML, all table references in the permitted-views allowlist, all column references in the permitted-columns allowlist
3. Detects and extracts event name literals; cross-checks against actual event names in the DB
4. Injects `LIMIT 500` on the outermost query if absent
5. Runs the validated SQL against the read-only Postgres role with `SET LOCAL statement_timeout = '8000'`
6. Returns rows, a row count, and the normalized SQL

**`lib/schemaContext.ts` — schema context builder**

Builds the string fed to the LLM on every `/ask` query. Two parts:

- *Structure*: auto-generated from `information_schema` at startup, filtered to the permitted-views allowlist. Column names and types only — refreshed when the server starts, cached in memory.
- *Semantics*: hand-written annotations keyed by `view.column`, checked into source. Example: `events_v.occurred_at_effective: "use this, not occurred_at — already corrects for clock drift"`.
- *Dynamic*: top-50 event names by count, fetched from the DB at query time with a short TTL cache.

The full assembled context must stay under 2,000 tokens — enforced by a CI assertion that builds the context and measures it. This is the per-query cost floor; if it balloons silently, the founder's bill does too.

CI also asserts: every permitted view exists in the DB, and every hand-written semantic annotation maps to a real column in the auto-generated structure (catches rename drift in both directions).

**`lib/trendComputer.ts` — deterministic trend**

Given the main query result and the main query's parsed AST, this module:
1. Inspects the AST for a time-bounded `occurred_at_effective` filter; if none found, returns `null` (no trend)
2. Derives the prior equivalent window from the detected window
3. Runs the same query with the window shifted to the prior period
4. Computes delta: `{ current, previous, percentChange, direction }`
5. Handles divide-by-zero / tiny-base by returning raw counts without a percentage when `previous < 5`

No LLM involved. This module is pure arithmetic on two query results.

**`lib/interpretationLabel.ts` — interpretation label derivation**

Given the parsed AST, extracts the views referenced by the query and maps them to human-readable interpretations via a checked-in lookup table (e.g. `active_users_v` → "active users"). Returns a label string. The label is derived structurally from the SQL, not generated by the LLM, so it cannot disagree with what the SQL does.

**`/api/ask` — API route**

Server-side only (never exposes LLM key to the browser). Accepts `{ question: string }`, returns `{ sql, normalizedSql, interpretationLabel, rows, rowsScanned, trend, tokenUsage }`. Calls `schemaContext → generateSql → validateAndRun → trendComputer → interpretationLabel` in sequence.

**`/app/ask/page.tsx` — `/ask` UI**

Client component (needs interactivity — form submit, loading states, history). Calls `/api/ask`. Renders: question input, interpretation label, SQL display, answer table/scalar, scanned row count, trend, Pin to Dashboard button, cost per query.

**`/app/page.tsx` (dashboard) — pinned charts section**

Extended to load `pinned_queries` from the DB and render each as a chart card below the fixed metrics. Each card executes its stored SQL via a dedicated `/api/pinned-query/[id]` route (not `/api/ask`) and shows the same result + trend + row count as the `/ask` page.

**Pinned queries always run through the full `sqlGuard` pipeline** — AST validation, read-only role, statement timeout, LIMIT enforcement — even though the SQL was already validated at pin time. The stored SQL is never executed raw from the database. This closes the bypass: a row edited directly in the `pinned_queries` table (e.g. by a malicious DB migration) would still be blocked by the AST guard before execution.

**No LLM call on pinned chart loads.** The stored `normalizedSql` is re-executed directly. There is no regeneration call to the LLM on dashboard load — this is both a cost decision (the LLM is not involved on every page view) and a correctness decision (the same SQL runs each time, producing comparable numbers across visits).

**Identical-question caching is out of scope for v0.2.** If the founder asks the same question twice on the `/ask` page, two LLM calls are made. Response caching (by question hash) is a v0.3+ optimization if token cost becomes a concern.

**Schema additions**

One new table:

```sql
CREATE TABLE IF NOT EXISTS pinned_queries (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question    TEXT        NOT NULL,
  sql         TEXT        NOT NULL,
  label       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

No schema changes to `events`, `events_v`, `users`, `companies`, or `aliases` — v0.2 is read-only against the v0.1 schema.

New Postgres role (added in a migration):

```sql
CREATE ROLE cthru_readonly;
GRANT SELECT ON events_v, signups_v, active_users_v, company_activity_v, users, companies, aliases TO cthru_readonly;
-- Raw events table: NOT granted. Only the curated views.
```

New curated semantic views (added in a migration):

> ⚠️ **SEMANTIC DECISIONS FLAGGED FOR GRILLING BEFORE FINALIZING**
> The DDL below encodes what "signup," "active user," and "company activity" mean.
> These are product definitions, not technical ones — they must be validated before
> the views are built, because they determine what the LLM can express and what
> the trend computations compare. The DDL below is a working draft; treat it as
> a proposal until the definitions are confirmed.

```sql
-- signups_v: one row per identified user, with the timestamp of their first event.
-- "Signup" is defined as the first time a user_id appears in the aliases table.
-- Window filtering (e.g. "last 7 days") happens in the LLM-generated query on top of this view;
-- the view itself is parameterless and exposes all users.
CREATE VIEW signups_v AS
  SELECT
    a.user_id,
    a.email,
    a.company_domain,
    u.first_seen                          AS signed_up_at,
    u.last_seen
  FROM aliases a
  JOIN users u ON a.user_id = u.user_id
  WHERE a.user_id IS NOT NULL;
```

```sql
-- active_users_v: one row per identified user with their most recent event timestamp.
-- "Active" is NOT encoded in this view — the view cannot take a window parameter.
-- The LLM generates queries like:
--   SELECT COUNT(DISTINCT user_id) FROM active_users_v WHERE last_event_at >= NOW() - INTERVAL '7 days'
-- The schema-context semantic annotation tells the LLM exactly how to filter.
CREATE VIEW active_users_v AS
  SELECT
    a.user_id,
    a.email,
    a.company_domain,
    MAX(e.occurred_at_effective)          AS last_event_at,
    COUNT(*)                              AS total_events
  FROM aliases a
  JOIN events_v e ON a.anonymous_id = e.anonymous_id
  WHERE a.user_id IS NOT NULL
  GROUP BY a.user_id, a.email, a.company_domain;
```

```sql
-- company_activity_v: one row per company domain, personal domains already excluded.
-- Event count and last activity are pre-aggregated; window filtering happens in generated queries.
CREATE VIEW company_activity_v AS
  SELECT
    e.company_domain                      AS domain,
    COUNT(*)                              AS total_events,
    MAX(e.occurred_at_effective)          AS last_event_at,
    COUNT(DISTINCT e.anonymous_id)        AS unique_visitors
  FROM events_v e
  WHERE e.company_domain IS NOT NULL
  GROUP BY e.company_domain;
```

Each of these views must have its own integration tests asserting it computes the right thing:
- `signups_v`: a user with a `user_id` in `aliases` appears; a user with only an `anonymous_id` does not
- `active_users_v`: `last_event_at` reflects the most recent event; anonymous-only visitors are excluded
- `company_activity_v`: personal email domains are excluded; event counts are correct; multiple anonymous_ids for the same domain are counted correctly

**LLM key storage (D-11)**

`CTHRU_LLM_KEY`, `CTHRU_LLM_PROVIDER`, `CTHRU_LLM_MODEL` in `.env.local`. The Settings paste-in UI writes to the env store, never to a DB column. The settings API returns only a masked hint. The key is never logged and is explicitly scrubbed from error messages, stack traces, and Next.js error overlays. Used in memory at the LLM call only. See D-11 for the v1.0 multi-tenant escalation path (KMS-backed DB encryption).

---

## Testing Decisions

### What makes a good test here

Test behavior through public interfaces — the same principle as v0.1. For v0.2, the primary seams are `lib/sqlGuard.ts` (AST validation + execution) and the `/api/ask` route (end-to-end question → answer). Tests should not assert on internal implementation steps (how the AST is traversed) — they should assert on observable outputs (query rejected with reason X, query runs and returns Y rows).

The key unlock: **mock `lib/llm.ts`** in all tests. `generateSql` is the seam between the non-deterministic LLM call and the deterministic validation/execution pipeline. Mocking it means every test of the validation, execution, trend, and labeling logic runs without a real API call, is fast, is deterministic, and costs nothing. This is the same principle as using `vi.fn()` to mock `processEvent` in the route tests.

### What to test

**`lib/sqlGuard.ts` — AST validation (no DB needed)**
- Accepts a valid SELECT against a permitted view
- Rejects a non-SELECT statement (`INSERT`, `UPDATE`, `DELETE`, `DROP`)
- Rejects a query referencing a non-allowlisted table (`events` raw table, `pg_catalog.*`)
- Rejects a query referencing a non-allowlisted column
- Rejects a multi-statement batch (`SELECT 1; DELETE FROM events`)
- Rejects a CTE that contains a DML node
- Injects `LIMIT 500` when absent; preserves a smaller existing `LIMIT`
- Returns the normalized SQL that will actually run

**`lib/sqlGuard.ts` — execution (requires test DB, same pattern as `processEvent` tests)**
- A validated query runs and returns rows + rowsScanned
- Statement timeout kills a query that exceeds 8 seconds
- Read-only role blocks a write even if the AST check somehow passed (belt-and-suspenders assertion)

**`lib/trendComputer.ts` — deterministic trend math**
- Time-bounded query: detects window, runs comparison, returns correct delta
- Non-time-bounded query: returns `null` (no trend)
- `current=47, previous=37` → `+27%, direction=up`
- `current=5, previous=0` → raw counts, no percentage (tiny-base case)
- `current=0, previous=0` → `null` trend (nothing to compare)
- Prior window is exactly the same duration as the main window

**`lib/schemaContext.ts` — schema context**
- Token budget assertion: built context is under 2,000 tokens (this is the CI check)
- Every permitted view listed in the context exists in the DB
- Every hand-written semantic annotation maps to a real column in the auto-generated structure

**`lib/interpretationLabel.ts`**
- `active_users_v` in the parsed AST → label contains "active users"
- Multiple views referenced → label lists both
- No recognized view → label is omitted (no fabricated label)

**`/api/ask` — end-to-end (mock `lib/llm.ts`)**
- Happy path: mock LLM returns valid SQL → validation passes → rows returned → trend computed → response includes sql, rows, rowsScanned, trend, interpretationLabel
- LLM returns SQL with unknown table → 400 with validation error
- LLM returns non-SELECT → 400
- No LLM key configured → 401
- Question about non-existent event name → event-name suggestion returned in response
- Zero rows → response includes rowsScanned > 0 alongside the zero

**Prior art in the codebase**
- `src/lib/__tests__/pipeline.test.ts` — real-DB integration tests with setup/teardown; pattern for `sqlGuard` execution tests
- `src/app/api/ingest/__tests__/route.test.ts` — route tests with mocked internals; pattern for `/api/ask` tests
- `src/lib/__tests__/smoke.test.ts` — end-to-end happy path; pattern for an `/ask` smoke test
- `src/lib/__tests__/setup.ts` — shared test DB setup; extend to create the `cthru_readonly` role and the new curated views

---

## Out of Scope

The following are explicitly NOT part of v0.2:

- **v0.3 Readiness Engine:** company-level rule scoring, "ready to pay" ranking, accounts-by-readiness view
- **v0.3 Morning Brief:** plain-English summary of top ready accounts
- **v0.3 Funnels and user journey view**
- **v0.4 Act Loop:** drafted outreach, one-click send, set-once rules, outreach log
- **v0.5 Session Replay:** DOM/event recording, replay player, field masking
- **v0.6 Legal Enrichment:** company name/logo/size from external sources
- **v1.0 Hosted Cloud:** multi-tenant, shared infrastructure, billing
- **LLM-generated trend explanations or causation claims** — these are permanently out of scope, not deferred; see D-15
- **Conversational / multi-turn `/ask`:** each question is stateless; no chat history that carries context between turns
- **Streaming SQL generation:** v0.2 waits for the full SQL before validating and running; streaming is a v0.3+ quality-of-life improvement
- **Natural language result formatting by the LLM:** the answer is rendered directly from query rows; the LLM does not reformat or summarize results
- **Saved query editing:** pinned queries can be deleted but not edited in-place; re-ask and re-pin to update

---

## Further Notes

**Why curated views are the primary correctness net (D-10)**

The most dangerous failure in a text-to-SQL system is valid SQL that returns a number confidently but answers the wrong question. Showing the SQL helps, but founders won't read every query carefully. The curated-view approach eliminates the most common class of this error by construction: `signups_v` already does the correct alias-resolved join; `active_users_v` already uses `occurred_at_effective`. The LLM cannot write a query that counts raw `events` rows for "signups" because `events` is not in its query surface. The semantic correctness lives in tested SQL, not in probabilistic LLM output.

**Why the AST parser and not a regex (D-12)**

The `/ask` flow is the highest-risk execution path in the product — machine-generated SQL against the founder's data. A first-token check is trivially defeated by CTEs, stacked statements, or function calls. The AST parser earns its cost here. Everywhere else in the codebase we chose simplicity; this is the one place where the stronger tool is unambiguously warranted.

**v1.0 reminder: LLM key encryption (D-11)**

When v1.0 builds the hosted cloud with a shared multi-tenant database, env-var key storage becomes inadequate. At that point, LLM keys must be stored with KMS-backed encryption (not env-var-derived encryption, which offers no real protection when the key and the ciphertext are on the same server). This is tracked here so it is not forgotten during v1.0 scoping.

**Schema context token budget is a CI gate, not a vibe (D-13, D-16)**

The 2,000-token schema context budget is a hard CI assertion. If views are added, annotations grow, or the event-name list balloons, the test will fail and someone will have to make a deliberate trade-off rather than discovering the cost increase on a founder's monthly bill. The top-50 event names cut-off (by count, not alphabetically) keeps the dynamic part bounded without losing the names the LLM most needs for SQL generation.

**The dependency decision principle (D-17)**

The Vercel AI SDK is taken as a dependency because provider APIs are a genuinely moving external target maintained better by the Vercel team than by C-thru. This is a deliberate exception to the general preference for simplicity in this codebase. The exception is justified by isolating the dependency behind `lib/llm.ts` — if the SDK ever needs replacing, one file changes.

**pg-query-native is a native module — plan for build environments**

`pg-query-native` compiles the libpg_query C library via node-gyp at install time. This works fine for local development and Docker Compose, but can break in:

- **Multi-stage Docker builds** where the final image lacks build tools (gcc, python, make). Solution: either build in the `node:XX` base image (not `node:XX-slim`) or add a separate compile stage and copy the compiled `.node` file.
- **Serverless / edge deploy targets** (Vercel Functions, Cloudflare Workers, AWS Lambda) that don't support native addons. The `/ask` route is not an edge function, but if the project ever moves in that direction, this must be verified.
- **CI environments** (GitHub Actions, etc.) that use `--ignore-scripts` for security. Ensure `postinstall` / `node_gyp_rebuild` is not blocked.

Pure-JS fallback option: if native compilation proves untenable in a deployment environment, the SQL safety guard can fall back to a stricter regex-based approach (reject anything that doesn't start with SELECT, reject semicolons, enforce the view allowlist via string matching). This is weaker than an AST parser and should be treated as a last resort. Document the fallback explicitly so it is a deliberate downgrade, not a silent one. The guard module interface (`sqlGuard.ts`) stays the same; only the parser implementation swaps.
