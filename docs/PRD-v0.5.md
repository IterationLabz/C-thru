# PRD — C-thru v0.5: Session Replay

> Scope: v0.5 only. Everything v0.6 and later is explicitly out of scope.
> Definition of done: a founder watches a real user session, with sensitive fields masked,
> accessed from context they already have (journey view or account view). Sensitive values
> never appear in the recording. The player shows what the user actually saw and did.
> Implementation decisions reference docs/DECISIONS.md entries D-31 through D-37.

---

## Architectural note — v0.5 departs from the Spine

v0.1–v0.4 share a common Spine: deterministic facts, LLM phrases, structure makes
hallucination impossible or catchable. v0.5 has no LLM and no facts to validate. It is
a **capture + masking + storage + playback problem**. The Spine principle does not apply
and must not be forced onto this version.

v0.5 also introduces two deliberate firsts:

1. **C-thru's first scheduled background job** (D-31): the retention cleanup service.
   This is consistent with D-26, which banned auto-send from schedulers for safety —
   not all background work. Retention is maintenance with no human-action substitute.

2. **C-thru's first off-by-default feature** (D-37): Session Replay must be explicitly
   enabled by the founder with a persisted acknowledgment. Every prior feature activated
   with the snippet. Replay does not.

---

## Problem Statement

After v0.4, a PLG founder using C-thru has a ranked list of accounts ready to pay, a
morning brief telling them who to contact, trigger rules that surface ready accounts
automatically, and drafted outreach in their voice. The "who to act on" and "what to
say" questions are answered.

What v0.1–v0.4 cannot answer is **why a user hesitated, where they got stuck, or what
they actually did during a session.** Event metadata shows that a user opened the billing
page 3 times but never converted. It cannot show what they saw there, whether the UI was
confusing, whether they tabbed away, or whether something broke. Event counts and
readiness scores are signals; only a replay is evidence.

The founder already knows which users to watch — they're the ones flagged in the morning
brief, the ones with active sessions in the journey view, the ones at accounts that are
close to ready. The missing piece is the ability to watch what those specific users
actually did. Not a general-purpose "watch all your traffic" tool — a focused capability
to understand the sessions that already matter.

---

## Solution

C-thru v0.5 integrates rrweb (open-source DOM capture/playback library) into the
existing snippet to record sessions for identified users. Sessions are captured with
block-by-default masking — sensitive field values are replaced before they leave the
browser; the real value never transmits. Recordings are stored as gzip-compressed chunks
in a dedicated Postgres table. A nightly cleanup service enforces the retention window.
Recordings surface contextually from the journey view and account view the founder
already uses, with the player at `/replay/[sessionId]`.

v0.5 does not change how events are captured, stored, or queried. It adds a parallel
recording pipeline that attaches to sessions the existing identity model already tracks.

---

## User Stories

### Enabling replay

1. As a founder, I want Session Replay to be disabled by default when I install C-thru,
   so that I do not accidentally record user sessions before I have disclosed this to
   my users.

2. As a founder, I want to enable Session Replay in Settings, so that I can start
   recording sessions for identified users.

3. As a founder enabling Session Replay for the first time, I want to see a short
   template privacy-policy clause I can adapt for my site, so that I know what to
   disclose to my users before recording starts.

4. As a founder, I want to check a checkbox confirming "I have disclosed session
   recording to my users" before replay activates, so that the system records that I
   understood my disclosure obligation before enabling the feature.

5. As a founder, I want my acknowledgment of the disclosure requirement to be persisted
   with a timestamp and the version of the template clause I was shown, so that I have
   a record of when I enabled recording and what language I was presented with.

6. As a founder, I want to see the retention window ("recordings auto-delete after N
   days") on the same Settings screen where I enable replay, so that I understand the
   data lifecycle before I turn the feature on.

7. As a founder, I want to change the retention window in Settings, so that I can
   shorten or extend how long recordings are kept in line with my privacy posture.

8. As a founder, I want to disable Session Replay in Settings at any time, which stops
   new sessions from being recorded (existing recordings remain until the retention
   window expires), so that I can turn off capture without losing evidence of sessions
   already recorded.

### Masking

9. As a user of the founder's product, I want my password never to be captured in a
   session recording, so that my credentials are not stored anywhere in the recording
   infrastructure.

10. As a user of the founder's product, I want all input field values to be masked
    by default in any recording, so that my personal data is not captured unless the
    founder has made a deliberate decision to record a specific safe field.

11. As a founder, I want to mark specific fields as safe to record using a
    `data-cthru-record` attribute, so that I can capture interactions on non-sensitive
    fields (e.g. a search box, a filter dropdown) for diagnostic purposes.

12. As a founder, I want the `data-cthru-record` allow-list to have no effect on
    password fields, credit card fields, and fields with `autocomplete=cc-*`, so that
    permanent-block fields cannot be accidentally unmasked by a misconfigured attribute.

13. As a founder, I want masking to fail safe — a missing, misspelled, or misconfigured
    `data-cthru-record` attribute leaves the field masked, never leaked — so that
    configuration mistakes protect my users' privacy rather than expose it.

14. As a founder, I want masking to happen in the snippet before any data is
    transmitted, so that real sensitive values never travel over the network and never
    reach my C-thru server.

15. As a founder, I want element-level blanking for permanent-block fields (the element
    structure appears in the recording but its contents are replaced), so that the
    recording preserves page layout for diagnostic value while the data is unreachable.

16. As a founder, I want value-masking for ordinary default-blocked fields (element
    structure visible, value replaced with a placeholder), so that field layout is
    preserved while input content is protected.

### Capture scope

17. As a founder, I want C-thru to only record sessions where `cthru.identify()` fires,
    so that I am not storing recordings for anonymous users I cannot connect to a known
    account.

18. As a founder, I want recording to buffer from the start of the session, even before
    `cthru.identify()` fires, so that I can see what the user did before they logged in
    — the path that led to identification is often the most revealing part.

19. As a founder, I want the pre-identify buffer to be committed as part of the session
    when `identify()` fires, so that the full session (pre- and post-login) is captured
    in one recording.

20. As a founder, I want the pre-identify buffer to be silently discarded if
    `identify()` never fires in that browser session, so that sessions for users who
    never log in are not transmitted or stored.

21. As a founder, I want the browser buffer to be capped by duration and size (oldest
    events evicted when the cap is reached), so that a very long pre-login session does
    not consume excessive browser memory.

22. As a founder, I want masking to apply before events enter the buffer, so that raw
    sensitive values are never held in browser memory even transiently.

23. As a founder, I want to configure a sample rate for session recording, so that on
    high-traffic apps I can record a fraction of sessions instead of all of them and
    control storage growth.

24. As a founder, I want sampling to be decided per-session at flush time (when
    `identify()` fires), so that every recorded session is either fully recorded or not
    recorded at all — never a partial session.

### Storage

25. As a founder, I want session recordings stored in my existing Postgres database, so
    that I do not need to set up a separate object store or blob service to use replay.

26. As a founder, I want recordings stored as gzip-compressed BYTEA chunks, so that
    storage footprint is small enough for single-Postgres at the scale C-thru targets.

27. As a founder, I want compression to happen client-side before transmission, so that
    the wire payload is already compressed and the server does not spend CPU
    recompressing it.

28. As a founder, I want chunk ordering to use sequence numbers (not timestamps), so
    that chunks are ordered deterministically regardless of clock skew between the
    browser and server.

29. As a founder, I want each session to record how many chunks it expects
    (`chunk_count`), so that the system can detect incomplete recordings without
    scanning all chunk rows.

30. As a founder, I want to see an honest storage ceiling in the C-thru documentation:
    at approximately N sessions per day with a 30-day window, recordings will approach
    the limit that's practical on single-Postgres, so that I know when I have outgrown
    the default setup.

### Retention cleanup job (D-31)

31. As a founder, I want recordings to be automatically deleted when they exceed the
    configured retention window, so that I do not need to remember to clean up old
    recordings manually and my storage does not grow without bound.

32. As a founder, I want the retention cleanup to run as a nightly background job
    without any page visit or manual trigger on my part, so that the privacy guarantee
    does not depend on my activity.

33. As a founder, I want the cleanup job to delete all chunks belonging to an expired
    session together (never orphaned chunks), so that partial recordings are not left
    behind after a session is deleted.

34. As a founder, I want retention cleanup to be idempotent — running it twice produces
    the same result as running it once — so that a crash or restart does not leave the
    database in a bad state.

35. As a founder, I want each nightly cleanup run to log the number of sessions deleted
    and the approximate bytes freed, so that I can verify the retention policy is
    actually being enforced.

36. As a founder, I want shortening the retention window to apply retroactively at the
    next nightly cleanup run, so that tightening my privacy posture takes effect
    promptly without requiring me to manually delete old recordings.

37. As a founder, I want the cleanup service to run inside my existing `docker compose
    up` deployment with no additional infrastructure, so that replay does not change my
    deployment model.

### Identity linkage

38. As a founder, I want each recorded session to be stamped with the user's
    `anonymous_id` and `user_id` at flush time, so that I can look up recordings for a
    specific user or company using the same identity model I already have.

39. As a founder, I want company domain to be derived at query time (not stamped on
    the session row), so that if I update my blocked-domain list, recordings for
    suppressed companies disappear from account views immediately rather than remaining
    visible because their domain was stamped at capture time.

40. As a founder, I want the existing alias model to be reused unchanged for session
    identity, so that there is no parallel identity system to maintain.

### Journey view integration

41. As a founder viewing a user's journey timeline, I want to see an inline "recording
    available" marker at the point in the timeline where a session starts, so that I
    can spot sessions with recordings while reviewing the event sequence.

42. As a founder, I want the recording marker in the journey to appear at the session's
    start time (before the identification seam), so that the marker correctly shows the
    pre-identify portion of the recording is available, not just post-login activity.

43. As a founder, I want clicking the recording marker in the journey to open the
    player at `/replay/[sessionId]` with a back-link to the journey, so that I can
    watch the session and return to the event timeline.

### Account view integration

44. As a founder viewing an account detail page for a company (e.g. `razorpay.com`),
    I want to see a count of available recordings for that account, so that I know
    session replay data exists for users I already care about.

45. As a founder, I want the recording count on the account page to link to the
    player for the most recent session (or a list if multiple exist), so that one click
    gets me to the relevant recording.

### Player

46. As a founder, I want the session player at `/replay/[sessionId]` to play back the
    rrweb-reconstructed DOM exactly as the user saw it, so that I can watch what they
    experienced rather than reading event names.

47. As a founder, I want play/pause controls in the player, so that I can stop and
    examine a specific moment.

48. As a founder, I want a scrubber in the player, so that I can jump to any point in
    the session without watching it linearly.

49. As a founder, I want a 2× speed option in the player, so that I can watch long
    sessions without spending the full session duration.

50. As a founder, I want a metadata panel alongside the player showing user email,
    company domain, session duration, and started_at timestamp, so that I know whose
    session I am watching without having to navigate away.

51. As a founder, I want a masking notice in the player that says "C-thru masks input
    values by default", so that I understand why input fields appear blanked and have
    confidence the real values were never captured.

52. As a founder watching an incomplete recording (some chunks missing), I want a
    banner at the top of the player saying the recording is incomplete, so that I know
    I am not seeing the full session, and playback continues with what is available
    rather than crashing.

53. As a founder opening a recording that is too large to play immediately, I want
    playback to begin progressively (snapshot + first N seconds displayed immediately,
    remaining chunks streamed behind), so that I see something right away rather than
    waiting for the full session to load.

54. As a founder trying to open a recording that has been deleted by the retention
    policy, I want a clear message "deleted per retention policy" rather than a 404
    error, so that I understand why the recording is gone.

55. As a founder, I want incompleteness to be determined before playback starts (a
    pre-playback integrity check), so that the "incomplete" banner appears up front
    rather than being discovered mid-play.

---

## Implementation Decisions

### v0.5 architecture note

v0.5 has no LLM component. The Spine ("deterministic facts, LLM only phrases") does not
apply. This is a capture → mask → compress → transmit → store → decompress → reassemble
→ play pipeline. Correctness guarantees come from structural tests (mask-before-transmit
assertion, round-trip reassembly test), not from grounding or output-discipline layers.

### Two deliberate firsts

**First background job (D-31):** The retention cleanup service is a dedicated process in
`docker-compose.yml`, joining the existing `db`, `adminer`, and `web` services. It runs
nightly, does retention deletion only, and must not import or call the send/trigger
surface (`sendSlack`, `recordCopy`, `evaluateTriggers`, `createTriggeredDraft`). The
D-26 grep test is updated to assert this boundary in both directions: send/trigger
identifiers remain confined to the allowed set AND the cleanup service never touches
them.

**First off-by-default feature (D-37):** The snippet loads and events capture from the
moment it is installed, but rrweb does not initialize until Session Replay is explicitly
enabled in Settings. The enabling flow requires a checkbox acknowledgment that is
persisted (timestamp + clause version) as an audit record before replay activates.

### Schema additions (migration 011+)

**`session_recordings` table:**
- `session_id` — primary key (UUID)
- `anonymous_id` — stamped at flush
- `user_id` — stamped at flush (never null for a stored recording)
- `started_at` — session start time (beginning of buffer)
- `ended_at` — set when the session ends or tab closes
- `expires_at` — set at write time from current retention window; used by cleanup job
- `chunk_count` — expected number of chunks; used for completeness check
- No `company_domain` column — derived at query time (D-18/D-35)

**`session_recording_chunks` table:**
- `session_id` — FK to `session_recordings`
- `seq` — integer sequence number, starting at 1, assigned at write
- `data` — BYTEA, gzip-compressed rrweb event stream for this chunk
- Primary key: `(session_id, seq)`

**`replay_settings` table (singleton, id=1):**
- `enabled` — boolean, default false
- `retention_days` — integer, default 30
- `sample_rate` — float 0–1, default 1.0 (100%)
- `acknowledged_at` — timestamptz, set when founder checks the disclosure checkbox
- `acknowledged_clause_version` — integer, identifies which version of the template
  clause was shown (increment when clause text changes)

### Module: snippet recorder + masker + buffer (deep-module)

A single `initialize(config)` call in the snippet wires up rrweb with the masking
configuration and the buffer. The caller (snippet init code) passes config; all rrweb
options, masking rule logic, buffer management, and flush-on-identify wiring are
internal. No caller touches rrweb APIs directly.

Masking config produced internally:
- All `input`, `textarea`, `select` values masked by default (rrweb `maskAllInputs`)
- Permanent-block selector list (`input[type=password]`, `input[autocomplete^=cc-]`,
  etc.) receives element-level blocking regardless of any `data-cthru-record` attribute
- `data-cthru-record` allow-list applies only to non-permanent-block fields

Buffer management internal:
- Ring buffer with duration cap and size cap; oldest events evicted
- Flush triggered when `cthru.identify()` fires (hook into existing identify call)
- Discard triggered at tab-close/session-end if identify never fired

Sampling decision at flush time: compare `Math.random()` to `sample_rate` from settings
response; if outside sample, discard buffer rather than transmitting.

### Module: chunked storage writer + reassembler (deep-module)

Two functions behind a single module interface:
- `writeSession(sessionId, anonymousId, userId, startedAt, chunks[])` — writes the
  session row and all chunk rows in a transaction; sets `expires_at` from current
  `retention_days`; returns the session record
- `reassembleStream(sessionId)` — fetches all chunk rows ordered by `seq`, decompresses
  each, returns the concatenated rrweb event stream; also returns `{complete, metadata}`
  where `complete` is the result of the integrity check

Integrity check (one shared definition used by both the reassembler and the player):
snapshot chunk present (seq=1 or a designated snapshot chunk marker) AND chunks
1..chunk_count all present with no sequence gap.

### Module: retention cleanup service (narrow, single-purpose)

One exported function: `runRetentionCleanup()` — selects all `session_id` values where
`expires_at < NOW()`, deletes all chunk rows for each expired session then the session
row itself, logs `{sessionsDeleted, bytesFreed, ranAt}`. Idempotent: a session already
deleted simply matches no rows.

Called on a nightly schedule from the cleanup Docker service. The cleanup service
process does nothing except import this function and call it on the schedule.

The cleanup service image can be a simple Node script or a tiny Alpine cron container
sharing the same codebase — the key constraint is that it imports only the retention
module and the DB client, never the send/trigger surface.

### Module: player data-loader (deep-module)

One async function `getSessionForPlayer(sessionId)` returns one of:
- `{status: 'ok', stream, metadata, complete}` — reassembled stream, metadata panel
  data, completeness flag
- `{status: 'expired'}` — session row exists but chunks deleted (or session deleted)
- `{status: 'not_found'}` — session_id unknown

The player component calls only this function and renders based on the result. It never
queries the DB directly, never calls the storage module, never decompresses chunks. The
fetch → decompress → reassemble → integrity-check pipeline is entirely internal to this
module.

### Capture scope

The rrweb recorder starts immediately when `initialize()` is called (session start,
before identify). Masking is configured at recorder initialization, so it applies to
all events from the first frame — there is no window during which raw values exist in
the buffer.

When `identify()` fires:
1. Sampling decision made (random vs `sample_rate`)
2. If not sampled: discard buffer, no transmission
3. If sampled: flush buffer as chunk(s) + metadata to the ingestion endpoint
4. Session continues recording until tab-close or browser navigation away

If `identify()` never fires before tab-close: buffer discarded client-side, nothing
transmitted, nothing stored.

### Identity linkage

`anonymous_id` and `user_id` are stamped on the session row at flush (both are known at
`identify()` time). The existing alias model is unchanged. `company_domain` is never
stored; it is derived at query time by joining `user_id → users.email → domain →
blocked_domains` exactly as `company_activity_v` does (D-18 consistency guarantee).

### Routes

- `POST /api/ingest/replay` — accepts the gzip-compressed recording payload from the
  snippet; validates write key; writes session + chunks; requires `user_id` present
  (never stores anonymous-only recordings)
- `GET /replay/[sessionId]` — player page; calls `getSessionForPlayer()`; renders
  player or the appropriate failure state
- Journey view — adds "recording available" marker to the timeline query for sessions
  where a `session_recordings` row exists for the user's `anonymous_id`/`user_id`
- Account detail page — adds recording count query (sessions for any user_id whose
  email domain matches the account domain, after blocklist join)

### Retention consistency

`expires_at` is set at write time. Shortening the retention window does not retroactively
update existing `expires_at` values — instead, the cleanup job selects
`WHERE expires_at < NOW()`, so any session whose `expires_at` is in the past (whether
set at the old or new window) is deleted at the next nightly run. This makes window
shortening take effect at most 24 hours after the change, which is acceptable for
privacy and storage purposes without requiring an UPDATE sweep on every existing row.

---

## Testing Decisions

### What makes a good test here

Tests should assert external behaviour — what the module guarantees to its callers —
not internal implementation details like which rrweb option was set or how the buffer
ring is implemented. The goal is tests that would catch a real failure (a value leaking,
a chunk being orphaned, a corrupted reassembly) without breaking when the implementation
is refactored.

Prior art: the v0.4 D-26 grep test (structural source-code assertion), the suppression
CRUD tests (database round-trip), and the trigger lifecycle tests (state machine
verification) are all good models. The masking structural proof is the v0.5 analogue of
the D-26 grep test: it asserts a structural guarantee rather than a runtime outcome.

### Masking structural proof (highest priority)

The most important test in v0.5. Analogous to the D-26 grep test in v0.4.

Install the snippet recorder in a test environment with a synthetic DOM containing a
password field, a credit card field, and a `data-cthru-record` marked field. Fire
events that include the real values of each field. Capture the outbound payload. Assert:

- The real password value does not appear anywhere in the payload
- The real credit card value does not appear anywhere in the payload
- A `data-cthru-record` field's value appears in the payload (allow-list works)
- A `data-cthru-record` attribute on a password field does NOT make the value appear
  (permanent-block wins over allow-list)

This test can never pass accidentally — if the masking module breaks, the real value
appears in the payload and the assertion fails.

### Chunk reassembly round-trip

Generate a synthetic rrweb event stream of N bytes. Compress it client-side. Write it
as M chunks to the test DB via the storage writer. Reassemble via the reassembler.
Assert the decompressed reassembled bytes are byte-identical to the original stream.

Also test: introduce a sequence gap (omit chunk seq=3 of 5). Assert the reassembler
returns `complete: false` and the stream contains what is available up to the gap.

### Completeness definition consistency

The "complete" definition used in the reassembler module must match the definition used
in the player data-loader. One way to assert this: write a test that creates an
incomplete session (missing chunk), calls `getSessionForPlayer()`, and asserts
`complete: false` — the same test that validates the reassembler returns `complete: false`
for the same input. If the two modules diverge on the definition, one of the tests will
catch it.

### Buffer discard on no-identify

Initialize the recorder in a test harness without calling `identify()`. Simulate
session end (tab-close event). Assert no network request was made and nothing was
written to the DB.

### Anonymous session not stored

Call `identify()` with a `user_id` of `null` (or do not call it). Assert that no
`session_recordings` row is created.

### Retention DELETE by-session / idempotent / logged

Insert two sessions: one expired (`expires_at` in the past), one current. Run
`runRetentionCleanup()`. Assert the expired session and all its chunks are deleted; the
current session and its chunks are intact. Run cleanup again. Assert still only one
session deleted (idempotent). Assert the return value includes `{sessionsDeleted: 1}`
and `bytesFreed > 0`.

### Orphaned chunk prevention

Insert a session with 3 chunks. Expire it. Run cleanup. Assert zero rows remain in
`session_recording_chunks` for that `session_id` — no orphaned chunks.

### Updated D-26 grep test

The existing grep test (send/trigger identifiers only in allowed files) is extended:
a new assertion walks the cleanup service entry point file(s) and asserts none of
`sendSlack`, `recordCopy`, `evaluateTriggers`, or `createTriggeredDraft` appear. The
cleanup service may import the retention module and the DB client only.

### company_domain not stored (D-18 consistency)

Assert the `session_recordings` table has no `company_domain` column. Assert the account
detail page recording count query derives domain via `user_id → users.email → domain`
rather than querying a `company_domain` column on `session_recordings`.

### Acknowledgment persisted with timestamp + clause version

Enable replay in a test harness by submitting the acknowledgment form. Assert a row
exists in `replay_settings` with `acknowledged_at` set (not null) and
`acknowledged_clause_version` matching the current clause version constant.

Attempt to enable replay without checking the acknowledgment checkbox. Assert replay is
not activated and no `acknowledged_at` is written.

### Player failure states

- **Expired session:** create a session, delete its chunks (simulate retention), call
  `getSessionForPlayer()`, assert `{status: 'expired'}`.
- **Not found:** call `getSessionForPlayer('nonexistent-id')`, assert
  `{status: 'not_found'}`.
- **Incomplete:** create a session with `chunk_count=3`, write only 2 chunks, call
  `getSessionForPlayer()`, assert `{status: 'ok', complete: false}`.

---

## Out of Scope

### Explicitly out of scope for v0.5

- **All-traffic / anonymous capture.** Only identified sessions (where `identify()` fires)
  are recorded. Anonymous-only sessions are never stored.

- **Standalone `/replay` firehose index.** There is no page listing all recordings.
  Entry is always from context (journey marker, account recording count). A general
  replay browser is not v0.5.

- **EU IP blocking.** C-thru does not make jurisdictional compliance decisions. Blocking
  recording by IP geography would create false assurance (GDPR is data-subject based,
  not IP based) while silently gapping recordings. The correct instrument is the
  founder's disclosure obligation, made easy by D-37.

- **Skip-inactivity, annotations, network tab, console tab.** These are advanced player
  features found in full-featured replay tools. v0.5 player is play/pause + scrubber +
  2x + metadata + masking notice.

- **Object store / blob storage.** Recordings stay in Postgres. A separate store (S3,
  MinIO, etc.) changes the deployment model and is explicitly out of scope.

- **Readiness-linked capture.** Recording only sessions for accounts that meet readiness
  thresholds is a natural v0.5.x follow-on. v0.5 records all identified sessions (subject
  to sample rate).

- **Reply tracking or inbox integration.** The outbound audit trail from v0.4 is not
  extended to cover replies.

- **v0.6+ features:** enrichment, hosted cloud, multi-tenant.

---

## Further Notes

### Storage ceiling (to document honestly in README / Settings)

At the default settings (100% sample rate, 30-day retention, average session ~2 MB
compressed), approximately 150 recorded sessions/day produces ~9 GB of recording data
at steady state. Founders with higher traffic or longer sessions should consider lowering
the sample rate. This ceiling assumes D-31 retention is running; if the cleanup service
is disabled, storage grows unboundedly. The coupling is deliberate and documented.

### rrweb integration scope

v0.5 integrates rrweb — it does not reimplement DOM capture or playback. The rrweb
`record()` API handles capture; `@rrweb/player` handles playback. C-thru owns the
masking configuration, the buffer-then-commit lifecycle, the compression/chunking, the
identity stamping, and the player data-loading. Keeping rrweb as a dependency (not
vendored) means security patches and performance improvements in rrweb are available via
normal package updates.

### The cleanup service is not the same restriction as D-26

D-26 banned auto-send from a scheduler because outreach is a human action with a
human-in-the-loop requirement — automating it would break the structural guarantee
that makes LLM-drafted outreach safe. Retention deletion is the opposite: it is
maintenance work with no meaningful human variant (a retention window that only enforces
when the founder remembers to visit a page is not a retention window). The presence of
a scheduler in v0.5 does not weaken D-26; it sharpens it, because the updated grep test
makes the scope of the scheduler's authority machine-verifiable.
