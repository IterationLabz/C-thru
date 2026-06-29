# PRD — C-thru v0.4: Act Loop

> Scope: v0.4 only. Everything v0.5 and later is explicitly out of scope.
> Definition of done: a founder sees a ready account, a drafted message in their voice,
> edits it, and clicks send — one deliberate action, no auto-send, no invented claims.
> Implementation decisions reference docs/DECISIONS.md entries (D-25 through D-30).

---

## The Spine (extended to v0.4)

> **The LLM drafts but never sends, never invents facts.**
> The human-in-the-loop send is the structural backstop — not a courtesy, not a convention.
> Never-auto-send is enforced by code structure (grep-verifiable), not intent.

In v0.2, the LLM authors SQL only — everything the founder sees as truth is validated
deterministically. In v0.3, the brief is a pure deterministic template — no LLM touches it,
because structure makes hallucination impossible on the screen the founder uses to decide
who to email.

v0.4 introduces the one place where the LLM must generate free prose: the outreach draft.
A founder must want to send it, so it must read naturally — a template won't do. This is
the one exception to "remove the LLM from the trust-critical path," and it is only
acceptable because of a coupled structural guarantee: **the founder always reads, edits,
and explicitly sends**. If auto-send were ever allowed, the output-discipline layers would
be insufficient. Never-auto-send is what makes LLM-drafted outreach safe to ship.

The Spine principle is the same across all versions; the mechanism shifts to match the
output requirement:

| Version | LLM role | Hallucination posture |
|---------|----------|-----------------------|
| v0.2 | Authors SQL | Structure makes hallucination impossible (AST validation) |
| v0.3 brief | Not present | Pure template — LLM removed from path entirely |
| v0.4 draft | Authors prose | Structure makes hallucination **visible and catchable before send** |

The v0.4 trust mechanism is three output-discipline layers (see D-25): a narrow generation
brief, a post-generation ungrounded-claims flag, and mandatory visible human review. The
grounding input (deterministic fact block from `scoreCompany()` + `topUsers`) is necessary
but not sufficient — the output discipline is the actual enforcement.

---

## Problem Statement

A PLG founder using C-thru after v0.3 has a ranked list of accounts ready to pay, each
with a full per-rule ✓/✗ breakdown and the names of their most active users. The "who to
act on" question is answered. But two gaps remain:

**Gap 1 — The draft still starts blank.** Every time the founder wants to reach out to a
ready account, they open Gmail or Slack and write from scratch. They know Razorpay is ready
(4/5 rules met, Priya has 63 events this week), but they must translate that into a message
themselves. The intelligence C-thru gathered doesn't carry into the action. The product
surfaces the signal; the founder still does the work.

**Gap 2 — Nothing prevents over-contact.** There is no record of who was contacted, when,
or what was said. A founder with 20 ready accounts can accidentally message the same company
twice in a week, or contact a prospect who asked not to be reached. There is no cooldown,
no suppression, no log. The readiness engine creates a list; the list creates urgency;
urgency without guardrails creates mistakes.

The consequence: v0.3 tells the founder WHO is ready. v0.4 must close the loop — from
"who's ready" to "message drafted, reviewed, and sent" — safely.

---

## Solution

C-thru v0.4 adds the Act Loop on top of the v0.3 Readiness Engine.

When an account is ready, C-thru drafts a short outreach message in the founder's voice,
grounded strictly in the account's readiness breakdown and most active users. The founder
reads it, edits it, and chooses to send — always a deliberate action, never automatic. The
send goes via a Slack webhook (for instant team notification or self-ping) or to the
clipboard (for email via the founder's own Gmail, with their own deliverability identity).

The founder can define trigger rules: when an account first crosses a readiness threshold,
C-thru creates a draft automatically and surfaces it in the outreach queue. The trigger
creates a draft — it never sends. A cooldown prevents re-drafting for accounts contacted
recently; a suppression list hard-blocks any domain or recipient who asked not to be
contacted.

Every action the founder takes — copy, send to Slack, dismiss — is recorded in the outreach
log with the exact text that went out (not the generated text; the founder's edited version),
the channel, the recipient, and whether the draft was triggered automatically or opened
manually.

---

## User Stories

### Draft Generation (D-25)

1. As a founder, I want to generate a draft outreach message for a ready account from the
   account's detail page (`/accounts/[domain]`), so that I can move directly from "this
   account is ready" to "message ready to send" without opening another tool.

2. As a founder, I want the draft to be grounded in a deterministic fact block built from
   the account's readiness breakdown and top active users — specifically `scoreCompany()`
   output and `topUsers` (max 3, from `active_users_v`) — so that every claim in the draft
   corresponds to a real data point I can verify in the breakdown.

3. As a founder, I want the fact block sent to the LLM to include: company domain, rules
   met fraction (e.g. "4/5"), each rule with its ✓/✗ result and computed value ("7 users",
   "last active today", "payment_intent fired"), and the top users' email addresses and event
   counts — nothing more — so that the LLM has exactly what it needs and no freeform data
   that could introduce invented claims.

4. As a founder, I want the LLM given a deliberately narrow generation brief ("write a
   brief, friendly note stating that this team is actively using the product, and offer help")
   rather than a broad one ("write a compelling outreach email"), so that the surface for
   hallucination is as small as possible.

5. As a founder, I want the draft to be scanned after generation for phrases that imply
   observed behaviour not in the fact block — patterns like "I saw you", "I noticed", "you've
   been exploring", or specific feature names absent from my readiness rules — and to see any
   such phrases flagged inline with a ⚠ warning ("this line claims behaviour not in your
   data — verify before sending"), so that the highest-risk hallucination class is surfaced
   at the exact moment I'm deciding to send.

6. As a founder, I want the generated draft presented in full, editable, before any send
   action is reachable — with send as a second deliberate step after reading — so that the
   structural separation between "generate" and "send" makes hallucination catchable by me
   before it goes anywhere.

7. As a founder, I want to be shown clearly whether the draft was written in my voice or
   in generic professional tone ("Drafted in your voice" / "Generic tone — add a voice
   sample in Settings to personalise"), so that I know what register I'm about to send.

8. As a founder, I want to edit the draft freely before sending — changing the text, the
   recipient, or the subject — so that the draft is a starting point I control, not a
   fixed output I accept or reject wholesale.

9. As a founder, I want the draft generation to use my existing LLM key and provider
   configuration from Settings (the same key and provider as `/ask`), so that I don't need
   to configure a second key and the cost comes from my existing quota.

### Slack Webhook Channel (D-26)

10. As a founder, I want to configure a Slack incoming webhook URL in Settings (one URL,
    no other credentials), so that C-thru can post outreach messages to a Slack channel I
    control without me granting it access to my workspace beyond that one hook.

11. As a founder, I want to click an explicit "Send to Slack" button on a draft to POST
    the draft text to my configured webhook, so that the send is a deliberate action I take,
    not something that happens automatically.

12. As a founder, I want the send to Slack to be recorded in the outreach log with the
    label "Sent to Slack" and a distinct visual indicator (different icon from clipboard
    entries), so that I can tell at a glance which outreach was actually delivered to Slack.

13. As a founder, I want the Slack webhook URL to be stored server-side (same security
    posture as `CTHRU_LLM_KEY`) and never exposed in the browser or in API responses, so
    that the URL is not accessible to anyone who can read the page source.

### Copy-to-Clipboard Channel (D-26)

14. As a founder, I want to click an explicit "Copy to clipboard" button on a draft to
    copy the full draft text, so that I can paste it into my own Gmail or email client and
    send it from my own address with my own deliverability identity (SPF/DKIM/signature).

15. As a founder, I want the copy action to be recorded in the outreach log with the label
    "Copied" — not "Sent" — and a visually distinct indicator from Slack entries, so that
    the log honestly reflects that C-thru copied text to my clipboard and cannot verify
    whether I actually sent anything.

16. As a founder, I want the recipient field (pre-filled from the account's most active
    user's email, editable before I copy) to be prominently shown and confirmed before the
    copy action, so that I consciously choose who this draft is for rather than
    accidentally copying a draft intended for the wrong person.

### Structural Never-Auto-Send (D-26)

17. As a founder, I want the guarantee that C-thru will never send a message on my behalf
    without my explicit action — not by intent, but by code structure — so that I can trust
    the system will not auto-contact my prospects regardless of any edge case or bug.

18. As a system, I want the send route to accept a single `draftId` parameter and perform
    one action (Slack POST or clipboard record) for that draft only — no batch endpoint —
    so that triggering a send for one account cannot cascade to others.

19. As a system, I want the send route to check `sent_at IS NULL` before acting and return
    a 409 if the draft was already sent, so that double-clicking the send button or
    replaying the request sends exactly once.

20. As a system, I want the send route to be reachable only from an explicit form submit in
    a logged-in session (Server Action or POST-only API route) — never from a cron job,
    background queue, event listener, or polling loop — so that the structural constraint is
    grep-verifiable: `grep -r "sendDraft\|sendSlack\|evaluateTriggers" src/` returns only
    server actions and the page-load evaluation path, nothing in a scheduler.

### Trigger Rules (D-27)

21. As a founder, I want to define a trigger rule that says "when an account's readiness
    score first crosses N/M rules met, create a draft for that account", so that I am
    notified when accounts cross a threshold I care about without having to check the
    accounts list manually every day.

22. As a founder, I want a trigger rule to create a draft record — and only a draft record
    — when the threshold is crossed: no Slack message is automatically sent, no email goes
    out, no action is taken on my behalf, so that the trigger feeds the same human-review
    queue as manual drafts and the never-auto-send guarantee is not circumvented.

23. As a founder, I want trigger evaluation to happen synchronously when I load `/accounts`
    or `/outreach` — not in a background job, cron, or queue — so that the no-background-
    caller structural guarantee from D-26 is preserved and the grep test continues to pass.

24. As a founder, I want the trigger to create at most one pending draft per
    `(trigger_rule_id, domain)` pair at a time — if a pending draft already exists for that
    pair, no second draft is created — so that a score that fluctuates around the threshold
    does not generate a cascade of duplicate drafts.

25. As a founder, I want to understand the trigger re-arm lifecycle: after I send or dismiss
    a draft, the trigger can re-fire for the same domain only after its score has genuinely
    dipped below the threshold and crossed back up — not just because the account remains
    above the threshold — so that I am not re-drafted for accounts I've already acted on
    that simply stay warm, while re-heated accounts (went cold, came back) do generate a
    new draft.

26. As a founder, I want to see my defined trigger rules listed in Settings with their
    threshold condition and which readiness rule(s) they watch, so that I can understand and
    manage what is being monitored without re-reading documentation.

27. As a founder, I want to delete a trigger rule and have all associated pending drafts
    remain visible (not silently deleted), so that I do not lose context on drafts that
    were created before I removed the rule.

### Outreach Queue and Draft Management (D-27, D-28)

28. As a founder, I want an `/outreach` page that shows all pending drafts — triggered and
    manually created — sorted by account readiness score, so that I have one place to see
    "what does C-thru think I should act on today."

29. As a founder, I want each pending draft in the queue to show the account name, readiness
    score, whether the draft was triggered automatically or I opened it manually (`created_by`),
    and a link to review and send, so that I can triage without opening each draft.

30. As a founder, I want to dismiss a draft without sending, so that I can remove it from
    the queue when I decide not to act on an account without sending anything.

31. As a founder, I want dismissed and sent drafts to be accessible in a "history" view
    (not the active queue), so that I can refer back to past decisions without the history
    cluttering the active queue.

### Outreach Log (D-28)

32. As a founder, I want every send or copy action recorded in the outreach log with:
    domain, channel (`slack` | `clipboard_copied`), recipient (exactly what I edited it to,
    or null if I cleared it), `draft_text_snapshot` (the text I actually sent — my edited
    version, frozen at action time, not the generated text), `created_by` (`trigger` |
    `manual`), `trigger_rule_id` if applicable, and `actioned_at` timestamp.

33. As a founder, I want `draft_text_snapshot` to capture the text at the moment I click
    send/copy — after my edits, not the generated version — so that the log records what
    actually went out, not what C-thru generated, honoring the same integrity principle
    ("the log must reflect reality") as the rest of the system.

34. As a founder, I want to see in the outreach log whether each entry was created by a
    trigger rule (and which one) or opened manually, so that I can learn which trigger rules
    actually lead to sent outreach — a signal of which readiness rules predict real action.

35. As a founder, I want clipboard entries and Slack entries to be visually distinct in the
    log — different icon, different label ("Copied" vs "Sent to Slack") — so that I can
    instantly tell which outreach was confirmed delivered (Slack) versus unverifiably copied
    (clipboard), without reading the detail row.

36. As a founder, I want the outreach log to be an outbound audit trail only — no reply
    tracking, no thread history — so that the log tells me "what did I send/copy, to whom,
    when, what text" without requiring inbox access or SMTP threading, which are out of scope.

### Per-Domain Send Cooldown (D-29)

37. As a founder, I want a per-domain send cooldown (default 21 days, configurable in
    Settings) that checks the outreach log before any draft is created, so that I am
    protected from accidentally contacting the same company twice in rapid succession.

38. As a founder, I want triggered drafts to be **silently suppressed** within the cooldown
    window — no draft created, no notification — so that automated paths fail safe and
    quiet without nagging me about accounts I've already acted on.

39. As a founder, I want manual draft creation within the cooldown window to show a visible
    warning ("You last contacted razorpay.com 8 days ago") but not hard-block me, so that
    I can exercise my own judgment when I have a legitimate reason to reach out sooner.

40. As a founder, I want the cooldown to be configurable in Settings so that I can tune it
    to my own outreach rhythm (some founders run weekly sequences; others go quarterly).

### Suppression List (D-29)

41. As a founder, I want to add a domain or email address to the suppression list — via the
    outreach log (quick-suppress from a past entry) or directly in Settings — so that I can
    honor opt-out requests immediately.

42. As a system, I want suppression to be checked and hard-blocked at **two points**: before
    any draft is created (triggered or manual) and again at the moment of send/copy action,
    so that (a) no new draft is created for a suppressed domain, and (b) a draft created
    before a domain was suppressed cannot slip through at send time.

43. As a founder, I want suppression to be a hard block with no override UI — no "proceed
    anyway" button — so that an explicit opt-out cannot be circumvented by clicking past a
    warning, unlike the cooldown (which is overridable because over-contact is a judgment
    call, not a compliance violation).

44. As a founder, I want suppression removal to require an explicit confirmation modal
    ("This person asked not to be contacted. Removing them allows C-thru to draft outreach
    to them again. Are you sure?"), so that the default path for suppression entries is to
    leave them in place, and removal requires a deliberate choice.

45. As a system, I want suppression entries to be soft-deleted on removal (`removed_at`
    timestamp set, row retained), so that the opt-out history is preserved as a compliance
    audit artifact even after the founder removes the active suppression — distinct from the
    voice sample, which is hard-deleted because it has no legal retention justification.

46. As a founder, I want to see the full suppression list in Settings with the entry date
    and `removed_at` date (if removed), so that I have a clear record of who asked not to
    be contacted and when, without needing to query the database.

### Contextual Compliance Reminder (D-29)

47. As a founder, I want a compliance reminder to surface contextually — when my usage
    pattern looks bulk-like (≥ 3 sends/copies to different domains within a 7-day window)
    — rather than appearing on every draft, so that the reminder gets read when it is
    relevant and does not become wallpaper I tune out.

48. As a founder, I want the reminder to read: "Personal 1:1 outreach only. For bulk email,
    add an unsubscribe mechanism and physical address" — a truthful statement of what C-thru
    can and cannot verify post-clipboard — without technical enforcement that would be both
    impossible and patronising given that C-thru has no visibility into what I do with the
    clipboard after copying.

### Founder Voice Sample (D-30)

49. As a founder, I want to provide a plain-text voice sample (2–5 sentences of my own
    writing — an email I've sent, a Slack message I liked the tone of) in Settings, so that
    C-thru can instruct the LLM to match my tone without any form of automatic style
    analysis.

50. As a founder, I want the voice sample to be stored as a plain text string that I can
    read verbatim in Settings and delete completely at any time, so that I know exactly what
    is stored and can exercise complete control over it — the privacy test that any voice-
    capture approach must pass.

51. As a founder, I want hard-delete on voice sample removal — the row is gone entirely, no
    `removed_at`, no archive — because this is personal data (my own writing) with no
    retention justification after I delete it, distinct from the suppression list which is
    a compliance artifact worth keeping.

52. As a founder, I want the voice sample to be optional — if I haven't set one, drafts
    fall back to generic professional tone — so that the feature works without voice
    configuration and personalization is an enhancement, not a gate.

53. As a founder, I want the draft UI to show clearly which mode was used ("Drafted in your
    voice" vs "Generic tone — add a voice sample in Settings to personalise"), so that I am
    not surprised by the register of the message I'm about to send.

54. As a system, I want the voice instruction in the LLM system prompt to sit alongside —
    not replace — the fact grounding constraint, so that a casual voice in the sample does
    not relax the requirement to use only the facts in the fact block; the ungrounded-claims
    flag runs regardless of voice mode.

---

## Implementation Decisions

### The Spine (v0.4 extension)

The never-auto-send guarantee is structural, not intentional. The send route is the seam
that enforces it: a single Server Action callable only from a logged-in form submit, taking
a single `draftId`, idempotent on `sent_at`. No batch endpoint exists. No background job or
cron job calls it. The guarantee is grep-verifiable at any point in the codebase's
evolution.

### Major Modules

**`lib/draftGenerator.ts` — the draft generation deep module (D-25)**

The primary new module. Public interface:

- `buildFactBlock(domain: string): Promise<DraftFactBlock>` — deterministic; calls
  `scoreCompany()` (already in production) and queries `active_users_v` for topUsers.
  Returns a structured object, not a string. The string rendering for the LLM prompt is
  internal to this module.
- `generateDraft(factBlock: DraftFactBlock, voiceSample: string | null): Promise<string>`
  — calls `lib/llm.ts` (`generateText`, same abstraction as `/ask`). System prompt layers:
  fact block rendering + grounding constraint + narrow brief + optional voice instruction.
- `flagUngroundedClaims(draft: string, factBlock: DraftFactBlock): FlagResult[]` — pure
  function. Scans the draft for patterns implying observed behaviour not in the fact block
  (regex patterns for `I saw you`, `I noticed`, `you've been exploring`, specific feature
  names). Returns an array of flagged ranges/lines; empty array if none found.

This module is a deep module: small public interface, complex internal implementation. Tests
use the public interface only. The fact block contract (only `scoreCompany()` + topUsers)
is enforced by what `buildFactBlock` queries — there is no other data access path.

**`lib/triggerEvaluator.ts` — trigger evaluation (D-27)**

- `evaluateTriggers(): Promise<void>` — called synchronously on `/accounts` and `/outreach`
  page load. Reads all trigger rules, scores all companies (reuses `scoreAllCompanies()`),
  checks `trigger_domain_state` for re-arm eligibility, creates `pending` draft rows for
  new crossings, updates `re_arm_eligible` for accounts that dipped below threshold.
  No return value — side effects on the DB only. No background job calls this function.
- `TriggerRule` type, `TriggerDomainState` type.

**`lib/guardrails.ts` — cooldown + suppression checks (D-29)**

- `checkCooldown(domain: string): Promise<CooldownResult>` — queries `outreach_log` for
  the domain. Returns `{ withinCooldown: boolean, daysSinceLast: number | null }`.
- `checkSuppression(domain: string, recipient: string | null): Promise<boolean>` — queries
  suppression list. Returns `true` if suppressed (hard block).
- `addSuppression(entry: SuppressionEntry): Promise<void>`
- `removeSuppression(id: number): Promise<void>` — soft-delete (`removed_at = now()`).

These two checks are the guardrail layer. They are called at two points: pre-creation (in
the draft creation server action) and pre-send (in the send server action). Suppression
returns a hard block; cooldown returns data that the caller uses to decide behavior
(silent suppress for triggers, warn-but-allow for manual).

**Send Server Action — the never-auto-send seam (D-26)**

- Accepts: `draftId` (single account only, no array).
- Guards: checks `sent_at IS NULL` → 409 if already actioned. Checks suppression → hard
  block. Performs Slack POST or records clipboard action.
- Writes: `outreach_log` row with `draft_text_snapshot` (the current draft text, not the
  generated original), `channel`, `recipient`, `created_by`, `trigger_rule_id`, `actioned_at`.
- Updates: `drafts.status = 'sent'`, `drafts.sent_at = now()`.
- This Server Action is the only code path that reaches the Slack webhook or records a
  clipboard action. The grep test is the mechanical proof.

**`lib/llm.ts` — unchanged, reused**

`generateDraft` calls `generateText` from `lib/llm.ts` — the same Vercel AI SDK abstraction
used by `/ask`. No new LLM dependency. Provider, model, and key come from the same
environment configuration.

### Schema Changes

**`drafts` table:**

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PRIMARY KEY | |
| `domain` | TEXT NOT NULL | target company domain |
| `generated_text` | TEXT NOT NULL | the LLM output, immutable after creation |
| `edited_text` | TEXT | the founder's current edits (nullable until first edit) |
| `status` | TEXT NOT NULL | `pending` \| `sent` \| `dismissed` |
| `created_by` | TEXT NOT NULL | `trigger` \| `manual` |
| `trigger_rule_id` | INT | FK to `trigger_rules`, nullable |
| `recipient` | TEXT | pre-filled from topUsers[0].email, founder-editable |
| `flags` | JSONB | array of ungrounded-claims flag results from generation |
| `created_at` | TIMESTAMPTZ NOT NULL | |
| `sent_at` | TIMESTAMPTZ | set on send/copy; idempotency guard |

**`trigger_rules` table:**

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PRIMARY KEY | |
| `label` | TEXT NOT NULL | human-readable name |
| `threshold_met` | INT NOT NULL | minimum rules_met count to trigger |
| `created_at` | TIMESTAMPTZ NOT NULL | |

**`trigger_domain_state` table:**

| Column | Type | Notes |
|--------|------|-------|
| `trigger_rule_id` | INT NOT NULL | FK to `trigger_rules` |
| `domain` | TEXT NOT NULL | |
| `re_arm_eligible` | BOOLEAN NOT NULL DEFAULT false | set true when score dips below threshold |
| UNIQUE | `(trigger_rule_id, domain)` | one state row per pair |

**`outreach_log` table:**

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PRIMARY KEY | |
| `draft_id` | INT NOT NULL | FK to `drafts` |
| `domain` | TEXT NOT NULL | |
| `channel` | TEXT NOT NULL | `slack` \| `clipboard_copied` |
| `recipient` | TEXT | exactly what the founder left; null if cleared |
| `draft_text_snapshot` | TEXT NOT NULL | frozen copy of edited_text at action time |
| `created_by` | TEXT NOT NULL | `trigger` \| `manual` |
| `trigger_rule_id` | INT | nullable |
| `actioned_at` | TIMESTAMPTZ NOT NULL | |

**`suppression_list` table:**

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PRIMARY KEY | |
| `type` | TEXT NOT NULL | `domain` \| `email` |
| `value` | TEXT NOT NULL | the domain or email address |
| `created_at` | TIMESTAMPTZ NOT NULL | |
| `removed_at` | TIMESTAMPTZ | soft-delete; active if null |

**`founder_voice` table (or single-row config):**

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PRIMARY KEY | |
| `sample_text` | TEXT NOT NULL | plain text, 2–5 sentences |
| `created_at` | TIMESTAMPTZ NOT NULL | |

Hard-deleted on removal (no `removed_at`). At most one active row.

### API / Route Contracts

- `POST /api/drafts` — create a draft manually for a domain. Runs cooldown + suppression
  pre-creation checks. Returns `{ draftId }` or `{ error, cooldownDaysRemaining }`.
- `POST /api/drafts/[draftId]/send` — the send route. Single-account, idempotent on
  `sent_at`, writes `outreach_log`. Returns 200 or 409.
- `POST /api/drafts/[draftId]/dismiss` — flip status to `dismissed`.
- `GET /api/outreach` — return pending drafts for the queue, sorted by account readiness.
- `GET /api/outreach/log` — return the outreach log.

### Seam Design

The clean seams for testing, in order of preference:

1. **`lib/draftGenerator.ts` public interface** — `buildFactBlock`, `generateDraft`,
   `flagUngroundedClaims`. All testable without UI or DB (mock `lib/llm.ts` for generation
   tests; hand-craft `DraftFactBlock` for flag tests). This is the primary seam.
2. **`lib/guardrails.ts` public interface** — `checkCooldown`, `checkSuppression`. DB
   integration tests with seeded `outreach_log` and `suppression_list` data.
3. **`lib/triggerEvaluator.ts` — `evaluateTriggers()`** — DB integration test with seeded
   `trigger_rules`, `trigger_domain_state`, and event data. Verifies draft creation,
   de-dup, and re-arm state transitions.
4. **Send Server Action** — integration test for the idempotency and suppression hard-block
   behaviors.

---

## Testing Decisions

### What makes a good test here

The same principle as v0.1–v0.3: test external behavior through public interfaces, not
implementation details. The `flagUngroundedClaims` function is testable as a pure function
(string in, flag array out) with no DB or LLM. The `evaluateTriggers` function is testable
by seeding the DB state and asserting on the resulting `drafts` and `trigger_domain_state`
rows. The send route is testable by calling it twice with the same `draftId` and asserting
the second call returns 409.

Mock `lib/llm.ts` for all draft generation tests — the same pattern as `lib/llm.test.ts`
in v0.2, which mocks the provider to avoid real API calls while testing the prompt
construction and parsing logic.

### Critical test behaviors

**Never-auto-send — grep test (structural):**
A test (or CI lint step) that runs `grep -r "sendDraft\|sendSlack\|evaluateTriggers" src/`
and asserts that every match is in a server action file or a page-load evaluation path —
nothing in a scheduler, cron, or background task file. This is the mechanical proof of the
structural guarantee. Prior art: the source-level no-LLM-import test in
`briefGenerator.test.ts` uses the same pattern (read source file, assert absence of
forbidden imports).

**Send route idempotency:**
Call the send server action twice with the same `draftId`. Assert the second call returns
409 and that exactly one row exists in `outreach_log` for that draft. Assert `drafts.sent_at`
is set after the first call.

**Single-account-only (no batch path):**
Assert that the send server action's input type does not accept an array of `draftId` values.
If the type accepts a single scalar, the batch path does not exist structurally.

**Suppression — two-point hard block:**
- Seed a suppression entry for `blocked.io`.
- Attempt to create a draft for `blocked.io` → assert no draft is created (pre-creation check).
- Seed a draft for `blocked2.io` with status `pending`, then add `blocked2.io` to the suppression list.
- Attempt to send the existing draft → assert 403 / hard block (send-time check).
Both checks must pass independently — neither alone is sufficient.

**Cooldown asymmetry:**
- Seed an `outreach_log` entry for `recentco.com` with `actioned_at = NOW() - 5 days`.
- Trigger evaluation for `recentco.com` crossing the threshold → assert no draft created (silent suppress).
- Manual draft creation for `recentco.com` → assert draft created but `CooldownResult.withinCooldown = true` returned to caller (warn-but-allow).

**Trigger re-arm — genuine dip-and-recross only:**
- Seed a trigger rule with threshold 3.
- Score `testco.io` at 4/5 → draft created, status `pending`.
- Dismiss the draft → `re_arm_eligible = false`.
- Score still 4/5 on next evaluation → assert no new draft (still warm, re-arm not triggered).
- Score drops to 2/5 → assert `re_arm_eligible = true`.
- Score rises to 4/5 again → assert new draft created.

**`draft_text_snapshot` freezes at action time:**
- Create a draft with `generated_text = "Hello world"`.
- Update `edited_text = "Hello Priya"` (founder's edit).
- Send the draft.
- Assert `outreach_log.draft_text_snapshot = "Hello Priya"` (the edited version, not the generated one).

**Ungrounded-claims flag — catches invented behavioral language:**
`flagUngroundedClaims` is a pure function; test with hand-crafted inputs:
- Input containing "I noticed you've been exploring our billing page" → assert flag returned.
- Input containing "I see your team has been quite active recently" → assert flag returned.
- Input containing "Your team at Razorpay has been active — 7 users in the last 30 days" → assert no flag (grounded in fact block).

**Voice instruction does not relax fact grounding:**
Mock `lib/llm.ts` to return a draft containing "I noticed you tried our onboarding" (invented).
Run `flagUngroundedClaims` on this output → assert flag returned regardless of whether a
voice sample was provided. The flag is a post-generation scan; it runs on the output, not
the prompt.

**Voice hard-delete removes the row entirely:**
- Create a voice sample row.
- Delete it via the settings action.
- Query the `founder_voice` table → assert zero rows (not soft-deleted, not archived).

**`buildFactBlock` uses only `scoreCompany()` + `topUsers`:**
Source-level test (similar to the briefGenerator no-LLM-import test): read
`lib/draftGenerator.ts` source and assert that the only DB query paths are
`scoreCompany()` (which itself uses the existing 5-query pipeline) and a query on
`active_users_v`. No raw `events` table access, no freeform query.

---

## Out of Scope

**v0.5 and later:** session replay, legal enrichment, hosted cloud.

**Explicitly excluded from v0.4:**

- **SMTP email sending.** Credential storage (SMTP password), SPF/DKIM deliverability
  (server IP won't be on founder's SPF record), and CAN-SPAM surface (physical address,
  unsubscribe mechanism) belong in a dedicated later version with careful deliverability
  design. v0.4 channels are Slack webhook and clipboard only.
- **Reply and thread tracking.** Requires either inbox access (refused throughout this
  project) or SMTP integration (deferred). The log is outbound-only.
- **Inbox analysis for voice.** Reading the founder's sent emails to derive style requires
  inbox access — the same privacy surface refused at every other turn.
- **Learned-from-edits style model.** An implicit model derived from how the founder edits
  drafts over time is uninspectable, undeletable, and persistent without consent. Rejected
  as a privacy principle, not a v0.4 shortcut.
- **Embeddings for voice.** Opaque, not human-readable, cannot be cleanly deleted. Fails
  the "founder can see exactly what is stored and delete it completely" test.
- **Daily send caps.** The per-domain cooldown is the precise instrument. A cap across all
  domains would punish a founder with 20 genuinely ready accounts at once.
- **Auto-send of any kind.** Including: trigger-to-send (no intermediate review),
  scheduled send, "send when I'm offline," send queues that drain automatically. All are
  prohibited structurally and by the CLAUDE.md §8 guardrail. This is not a v0.4 scope
  limitation — it is a permanent product constraint.
- **Batch send endpoints.** The send route accepts a single `draftId`. No endpoint or UI
  path sends to multiple accounts in one action.

---

## Further Notes

**Why never-auto-send is a feature, not a limitation.** The product CLAUDE.md §8 is
explicit: "C-thru drafts; the founder always clicks send." This is not a legal checkbox.
It is the product's trust model. The founder's name goes on every message sent; C-thru
must never put words in their mouth without their explicit review. The structural enforcement
(single-account route, idempotent, UI-only, grep-verifiable) is what makes "the human is
in the loop" a hard guarantee rather than a hope. Future versions will not weaken this;
they may add more channels (SMTP) but the review-then-send discipline applies to all of
them.

**The v0.4 draft and the v0.3 brief are complementary, not competing.** The brief (D-20)
is a pure deterministic template — no LLM — because on the screen that tells the founder
who to email, robotic-but-true is the only acceptable register. The draft is LLM-generated
because the founder must want to send it and the brief's sentence format is not enough for
that. They serve different moments: the brief is "here is why this account is ready"; the
draft is "here is what to say to them." The Spine applies to both; the mechanism differs
by necessity.

**The grounding fact block is the same data the founder already reviewed.** `buildFactBlock`
calls `scoreCompany()` — the same function that renders the per-rule ✓/✗ breakdown on
`/accounts/[domain]`. The LLM is given exactly the data the founder just read on the screen
above the draft. If the LLM generates a claim the founder knows is wrong, they will catch
it because they just saw the breakdown. This is the last defense layer before send and the
one most likely to catch residual hallucination: the founder is already primed with the
ground truth.

**Trigger evaluation on page load is a deliberate design choice, not a shortcut.** Running
`evaluateTriggers()` synchronously on `/accounts` or `/outreach` load means there is no
background process, no cron job, no queue — and therefore the grep test for no-background-
caller continues to pass without modification. The trade-off is that drafts are created only
when the founder visits those pages, not instantly when a threshold is crossed. For a PLG
founder checking their dashboard daily, this is the right trade-off: the latency is at most
one day, and the structural simplicity is worth it. If real-time trigger evaluation becomes
necessary in a future version (e.g. via a webhook from the ingestion pipeline), that is a
deliberate decision documented in DECISIONS.md, not drift.

**Suppression and the voice sample have different deletion semantics for a reason.** The
suppression list uses soft-delete because an opt-out is a legal artifact — preserving the
history of "this person asked not to be contacted on this date" has potential legal value
even after the active suppression is lifted. The voice sample uses hard-delete because it
is personal data (the founder's own writing) with no legal retention justification — the
GDPR right to erasure applies cleanly and the founder's expectation of "delete means gone"
should be honored. The distinction is not inconsistency; it reflects the different nature
of what is being retained and why.
