# v0.5 Issues — Session Replay

Status: **COMPLETE** — all 7 issues + gap-fix committed, PR #27 open against IterationLabz/C-thru, 448 tests passing (332 → 448, +116).

> **v0.5 is architecturally different from v0.1–v0.4.** The Spine principle (deterministic facts, LLM only phrases) does NOT apply here — Session Replay has no LLM and no facts to validate. It is a capture + masking + storage + playback problem. The central safety risk is privacy (masking must fail safe); the central engineering risk is storage volume.

| # | Title | Key files | Tests | Status |
|---|---|---|---|---|
| 1 | Masking foundation — block-by-default + structural safety proof | `src/lib/replay/recorder.ts`, `src/lib/__tests__/replayMasking.test.ts` | 25 | DONE |
| 2 | Buffer-then-commit-on-identify — capture scope + gzip flush | `src/lib/replay/buffer.ts`, `src/app/api/ingest/replay/route.ts`, `src/lib/__tests__/replayCapture.test.ts` | 21 | DONE |
| 3 | Chunked Postgres storage + round-trip reassembly | `migrations/011_session_replay.sql`, `src/lib/replay/storage.ts`, `src/lib/__tests__/replayStorage.test.ts` | 12 | DONE |
| 4 | Retention cleanup background job | `src/lib/replay/cleanup.ts`, `scripts/cleanup.ts`, `docker-compose.yml`, `src/lib/__tests__/replayCleanup.test.ts` | 14 (10 + 4 in actLoopContracts) | DONE |
| 5 | Identity linkage — journey markers + account recording count | `src/lib/replay/identity.ts`, `src/lib/__tests__/replayIdentity.test.ts` | 9 | DONE |
| 6 | Playback player — data-loader, ReplayPlayer, 3 failure states | `src/lib/replay/playerLoader.ts`, `src/app/replay/[sessionId]/page.tsx`, `src/app/replay/[sessionId]/ReplayPlayer.tsx`, `src/lib/__tests__/replayPlayer.test.ts` | 9 | DONE |
| 7 | Consent gate — off-by-default, persisted acknowledgment, settings UI | `src/lib/replay/consentGate.ts`, `src/app/settings/ReplayEnableForm.tsx`, `src/lib/__tests__/replayConsent.test.ts` | 18 | DONE |
| 8 | Gap-fix: HTTP-level ingest gate tests + disable-preserves-recordings | `src/app/api/ingest/__tests__/replayRoute.test.ts` | 8 | DONE |

## Key safety contracts enforced by tests

| Contract | Decision | Test file | Test name |
|---|---|---|---|
| Real input value never in outbound payload | D-32 | replayMasking.test.ts | `returns *** for a plain text input` |
| Permanent-block wins over `data-cthru-record` | D-32 | replayMasking.test.ts | `still blocks input[type=password] even when data-cthru-record is present` |
| `discard()` never calls fetch (no-identify = not transmitted) | D-34 | replayCapture.test.ts | `discard() does not call fetch — nothing transmitted` |
| Anonymous sessions never transmitted | D-34 | replayCapture.test.ts | `flush() with empty userId does not call fetch` |
| Server rejects anonymous (no userId) | D-34 | replayRoute.test.ts | `returns 400 when userId header is missing` |
| Byte-identical chunk round-trip | D-33 | replayStorage.test.ts | `single-chunk round-trip produces byte-identical stream` |
| Gap in sequence → `complete:false` | D-36 | replayStorage.test.ts | `complete:false when a middle chunk is missing` |
| `reassembleStream()` and `getSessionForPlayer()` agree on `complete` | D-36 | replayPlayer.test.ts | `both return complete:false for a session with a gap` |
| Cleanup never imports send/trigger surface | D-31 | actLoopContracts.test.ts | `cleanup module (replay/cleanup.ts) does NOT import send/trigger surface` |
| By-session deletion, no orphaned chunks | D-31 | replayCleanup.test.ts | `deletes all chunks belonging to an expired session` |
| `company_domain` not stored on `session_recordings` | D-35 | replayIdentity.test.ts | `session_recordings has no company_domain column` |
| Blocklist change reflected immediately (no recording deleted) | D-35 | replayIdentity.test.ts | `account recording count drops to 0 when domain is blocked (no deletion)` |
| `enabled=false` by default | D-37 | replayConsent.test.ts | `getReplaySettings() returns enabled=false by default` |
| Cannot enable without clause acknowledgment | D-37 | replayConsent.test.ts | `enableReplay(0) throws — clauseVersion 0 is not a valid acknowledgment` |
| `acknowledged_at` persisted (audit record) | D-37 | replayConsent.test.ts | `acknowledged_at is a Date after enabling` |
| Audit trail preserved after disable | D-37 | replayConsent.test.ts | `acknowledged_at is still set after disabling (audit trail preserved)` |
| Ingest route returns 403 when replay disabled | D-37 | replayRoute.test.ts | `returns 403 when replay is disabled (consent gate blocks recording)` |
| Disable does not delete existing recordings | D-37 | replayRoute.test.ts | `existing session_recordings rows survive disableReplay()` |

## Architecture notes

- **No LLM, no Spine.** v0.5 uses rrweb for DOM capture/playback. C-thru integrates rrweb; it does not reimplement it.
- **First scheduled background job (D-31).** `cleanup` service in `docker-compose`. Does retention only — the D-26 grep test is updated to assert the boundary in both directions.
- **First off-by-default feature (D-37).** `replay_settings.enabled = false` until the founder acknowledges the disclosure clause. The acknowledgment timestamp and clause version are stored for auditability.
- **`company_domain` derived not stored (D-18/D-35 consistency).** `session_recordings` has no `company_domain` column. Every query that needs it joins `users.email → split_part → blocked_domains` — the same pattern as `company_activity_v`. Blocklist changes apply immediately to the replay views without requiring a scan of the recordings table.
- **Shared completeness definition (D-36).** One `isComplete()` function in `storage.ts`, called by both `reassembleStream()` and (via delegation) `getSessionForPlayer()`. The player's incomplete banner and the storage round-trip tests both use it — they cannot diverge.
- **Single-chunk deferral (intentional).** The ingest route stores the flushed buffer as one chunk (seq=1). The buffer flushes once on `identify()` → one gzip payload → one chunk. Multi-chunk streaming uploads are deferred to v0.5.x. The completeness definition handles N=1 correctly (seq=1 present AND 1..1 no gap → complete:true).

## Decisions

See `docs/DECISIONS.md` D-31 through D-37 (committed in `b50108b`).

## PRD

See `docs/PRD-v0.5.md` (committed in `b50108b`).

## Test count

| Milestone | Tests |
|---|---|
| v0.4 complete (PR #26 merged) | 332 |
| v0.5 I1 — masking | +25 → 357 |
| v0.5 I2 — buffer/capture | +21 → 378 |
| v0.5 I3 — storage | +12 → 390 |
| v0.5 I4 — retention cleanup | +14 → 404 |
| v0.5 I5 — identity linkage | +9 → 413 |
| v0.5 I6 — playback player | +9 → 422 |
| v0.5 I7 — consent gate | +18 → 440 |
| v0.5 gap-fix — HTTP ingest gate tests | +8 → 448 |
