# CLAUDE.md — Master Context for C-thru

> This file is read automatically by Claude Code on every session.
> It is the single source of truth for what C-thru is, how it's built, and the rules to follow.
> When in doubt, follow this file over assumptions.

---

## 1. What we are building (the one-liner)

**C-thru: the open-source, self-hosted PQL engine for product-led startups.**

A founder installs C-thru on their own server and adds it to their app. C-thru turns the
first-party data they already own into a daily answer to: *"Which accounts are about to pay me,
and what do I do about it?"* — it detects the signal, explains it in plain English, and drafts
the outreach to close them.

PQL = Product Qualified Lead = an account *behaving* like it is about to pay.

Open-source, self-hosted, free. The founder owns all their data on their own server.

## 2. Who it's for

Product-led-growth (PLG) startup founders with self-serve signups. NOT "everyone." NOT enterprise.
The narrow motion is: **trial-to-paid conversion and expansion.**

## 3. Why it exists (the wedge — do not lose this)

The "find accounts ready to pay" function exists in many CLOSED, PAID tools (Correlated, Gainsight,
6sense, Warmly — $549–$1,299/mo). There is NO credible open-source version. That empty chair is
the entire reason C-thru exists. Every decision must protect: **open-source, self-hosted, the
founder owns their data.** If a feature requires sending the founder's data to our servers, it is
wrong by default.

## 4. The product, in plain terms

C-thru does six things:
1. **Captures** everything users do (three channels — see docs/EVENTS.md), tied to the logged-in person.
2. **Groups users into companies** (email domain → company name/size/industry). The instant "wow".
3. **Scores readiness-to-pay** using TRANSPARENT RULES the founder sets and can see (NOT a black box).
4. **Writes a morning brief** in plain English: who is ready and why.
5. **Drafts the outreach** (email/Slack) in the founder's voice — one click to send, NEVER auto-sends.
6. **Two front doors to the data:** a visual chart dashboard AND a vibe-analytics box (ask in English).

## 5. Tech stack (do not deviate without asking)

- **Frontend + dashboard:** Next.js (App Router) + TypeScript + Tailwind
- **Backend / ingestion API:** Node.js (the same Next.js app's API routes are fine for v0.1)
- **Database:** PostgreSQL  ← NOT MongoDB. Analytics needs SQL + columnar-friendly querying.
- **Client SDK:** a small browser script (the snippet) + `cthru.track()`
- **Server SDK:** a small Node package exposing `cthru.trackServer()`
- **AI / vibe analytics:** the FOUNDER brings their own LLM API key (OpenAI / Anthropic / Groq).
  C-thru never ships a key and never calls an LLM on its own servers.
- **Deploy:** Docker Compose — goal is `docker compose up` → working in 5 minutes.

## 6. Event capture — three channels, ALL on by default, ALL available together

| Channel        | Created by                | Purpose                         | Example |
|----------------|---------------------------|---------------------------------|---------|
| Auto-capture   | the snippet, automatically| broad coverage instantly        | page views, clicks, sessions, rage-clicks |
| Custom events  | founder, `cthru.track()`  | the *meaning* — drives rules    | `invited_teammate`, `hit_paywall` |
| Real / server  | founder backend, `trackServer()` | *ground truth*, can't be faked | `payment_succeeded`, `subscription_renewed` |

All three are stored in ONE unified `events` table, distinguished by a `source` column.
See docs/EVENTS.md for the exact schema and SDK signatures.

## 7. The two interfaces (build BOTH, they share one engine)

- **Chart dashboard:** pre-built visual overview (active users, signups, top events, funnels,
  retention, accounts ranked by readiness). For the everyday glance.
- **Vibe analytics:** founder types a question in English → C-thru generates SQL →
  **SHOWS THE SQL** (trust) → runs it → returns the exact answer → then explains the trend below.
- **The bridge:** any vibe answer has a "Pin to Dashboard" button that turns it into a saved chart.
  The founder grows their own dashboard by asking questions.

## 8. Non-negotiable guardrails (NEVER violate these)

1. **Correctness over cleverness.** A wrong number destroys trust forever. The AI must ALWAYS show
   the generated SQL before/with the answer so the founder can verify. Never present an unverifiable number.
2. **Intent = visible rules first.** v1 scoring is founder-defined rules they can read, NOT a black-box
   AI prediction. Predictive scoring comes much later, once there is data.
3. **Never auto-send outreach.** C-thru drafts; the founder always clicks send. (Anti-spam: CAN-SPAM, GDPR.)
4. **First-party data only (for now).** No third-party scraping. No LinkedIn scraping. Enrichment is a
   later, opt-in, off-by-default plugin using only public/free sources + the founder's own data.
5. **Self-hosted = the founder is the data controller.** Data never leaves their server. Protect this.
6. **Honest positioning.** "One line to auto-capture; a few `track()`/`trackServer()` calls to unlock
   the engine." Never pretend raw clicks become meaning by themselves.
7. **Privacy by default in session replay** (later versions): mask passwords and sensitive fields.

## 9. Build order (each version must be usable on its own)

- **v0.1 — Core Tracker:** snippet + 3 event channels + unified schema + founder-named events +
  group-by-company view + basic chart dashboard.  ← START HERE
- **v0.2 — Vibe Analytics:** English → shows SQL → answer + trend + Pin to Dashboard.
- **v0.3 — Readiness Engine:** company-level rule scoring + morning brief + funnels + user journeys.
- **v0.4 — Act Loop:** drafted outreach + one-click send + set-once rules.
- **v0.5 — Session Replay:** per-user replay, sensitive fields masked.
- **v0.6 — Legal Enrichment:** opt-in, off by default, company-from-domain + free sources + consent flow.
- **v1.0 — Hosted Cloud:** same codebase, paid tiers. The revenue version.

DO NOT build ahead of the current version. Resist adding v0.3 features while v0.1 is unfinished.

## 10. Definition of done for v0.1 (current target)

A founder can:
1. Run `docker compose up` and reach a working dashboard.
2. Paste the snippet into a test site and see auto-captured events arrive.
3. Call `cthru.track("custom_event", {...})` and see it stored.
4. Call `cthru.trackServer("payment_succeeded", {...})` from a Node backend and see it stored.
5. See users grouped by company (email domain → company name).
6. See a basic chart dashboard: active users, signups, top events, live count, companies ranked by activity.

If all six work, v0.1 ships.

## 11. Code conventions

- TypeScript everywhere. Strict mode on.
- Keep the snippet TINY and dependency-free (it loads on other people's sites — performance matters).
- Every event, auto/custom/server, goes through ONE ingestion endpoint and ONE storage path.
- Comment the "why," not the "what."
- Write it so a stranger can deploy it in 5 minutes. Deploy ease is a feature.

## 12. What NOT to do

- Do NOT swap Postgres for Mongo.
- Do NOT call any LLM from C-thru's own server or ship an API key.
- Do NOT build session replay, enrichment, or predictive AI before v0.1 core works.
- Do NOT auto-send any outreach.
- Do NOT add third-party data scraping.
- Do NOT over-format the dashboard with fake data — wow the founder with THEIR real existing data.

---

When starting a task, read this file, then the relevant file in /docs, then proceed.
