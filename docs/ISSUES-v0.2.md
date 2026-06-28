# v0.2 Issues — Vibe Analytics

Status: **COMPLETE** — all 11 issues merged to main, 215 tests passing.

| # | Title | Branch | Key files | Status |
|---|---|---|---|---|
| 1 | Curated semantic views + cthru_readonly role | feat/curated-views | migrations/005_curated_views.sql, src/lib/__tests__/curatedViews.test.ts | DONE |
| 2 | lib/llm.ts — provider abstraction | feat/llm-provider | src/lib/llm.ts, src/lib/__tests__/llm.test.ts | DONE |
| 3 | Settings — LLM key setup, model selection, verify-key | feat/llm-settings | src/lib/llmSettings.ts, src/app/settings/ | DONE |
| 4 | lib/sqlGuard.ts — AST validation (pure, no DB) | feat/sql-guard-ast | src/lib/sqlGuard.ts (validateSql), src/lib/__tests__/sqlGuard.test.ts | DONE |
| 5 | lib/sqlGuard.ts — safe execution (read-only role, timeout, LIMIT) | feat/sql-guard-ast | src/lib/sqlGuard.ts (validateAndRun), src/lib/__tests__/validateAndRun.test.ts | DONE |
| 6 | lib/schemaContext.ts — hybrid auto-generated+annotated schema | feat/schema-context | src/lib/schemaContext.ts, src/lib/__tests__/schemaContext.test.ts | DONE |
| 7 | lib/trendComputer.ts — deterministic trend math | feat/schema-context | src/lib/trendComputer.ts, src/lib/__tests__/trendComputer.test.ts | DONE |
| 8 | /api/ask route — wires schema, LLM, guard, trend | feat/api-ask | src/lib/ask.ts, src/app/api/ask/route.ts, src/lib/__tests__/ask.test.ts | DONE |
| 9 | /ask page UI — question input, SQL reveal, answer, trend badge | feat/ask-page | src/app/ask/page.tsx, src/app/ask/AskForm.tsx | DONE |
| 10 | Pin to Dashboard — storage, validated re-run, dashboard render | feat/pin-to-dashboard | migrations/006_pinned_queries.sql, src/lib/pinnedQueries.ts, src/lib/__tests__/pinnedQueries.test.ts | DONE |
| 11 | lib/interpretationLabel.ts — AST-derived query label, no LLM | feat/interpretation-label | src/lib/interpretationLabel.ts, src/lib/__tests__/interpretationLabel.test.ts | DONE |

## Post-release fix

**company_activity_v blocklist consistency** (D-18): after v0.2 issues were merged, a classification-timing inconsistency was identified and fixed. `signups_v` and `active_users_v` classify `company_domain` at query time (via `LEFT JOIN blocked_domains`), but `company_activity_v` used ingestion-time values — causing contradictory LLM answers after a blocklist change. Fixed by adding `LEFT JOIN blocked_domains bd ON bd.domain = COALESCE(e.company_domain, a.company_domain)` to `company_activity_v`. See D-18 in docs/DECISIONS.md.

Branch: `feat/fix-company-activity-blocklist` | New tests: 2 (blocklist-change agreement + retroactive attribution)

## Test count

| Milestone | Tests |
|---|---|
| v0.1 complete | 55 |
| v0.2 issues 1–11 merged | 213 |
| + blocklist consistency fix | 215 |
