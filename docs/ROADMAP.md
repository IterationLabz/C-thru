# ROADMAP.md — C-thru Build Roadmap

> Build in this order. Each version must be usable on its own. Do not build ahead.
> When a version's "Definition of Done" is met, it ships — then move to the next.

## v0.1 — Core Tracker  ← CURRENT TARGET
**Goal:** capture data (all 3 channels) and show a founder the companies using their product.

Build:
- [ ] Postgres schema (events + users + companies) — see docs/EVENTS.md
- [ ] Ingestion API (one endpoint, all 3 sources)
- [ ] The snippet (auto-capture + identify + track)
- [ ] Node server SDK (trackServer)
- [ ] Company derivation from email domain
- [ ] Basic chart dashboard: active users, signups, top events, live count
- [ ] Companies view: list of companies using the product, ranked by activity
- [ ] Settings: founder marks "key events"
- [ ] Docker Compose + README quickstart (5-minute deploy)

**Definition of Done:** the 6 checks in CLAUDE.md §10 all pass.

## v0.2 — Vibe Analytics
**Goal:** ask questions in English, get verifiable answers.

Build:
- [ ] Settings: founder pastes their own LLM API key (OpenAI/Anthropic/Groq)
- [ ] English question → send question + schema to LLM → get SQL
- [ ] SHOW the generated SQL to the founder (trust)
- [ ] Run SQL with a READ-ONLY db role; block non-SELECT
- [ ] Render the answer, then a short trend explanation below
- [ ] "Pin to Dashboard" → saves the query as a permanent chart

**Definition of Done:** founder asks "how many signups last week," sees the SQL, gets the right
number + a trend line, and can pin it.

## v0.3 — Readiness Engine
**Goal:** tell the founder who is about to pay.

Build:
- [ ] Rule builder (visible rules: e.g. "3+ active users AND on free plan AND 5+ sessions/week")
- [ ] Company-level scoring from rules over events
- [ ] "Accounts ranked by readiness" view
- [ ] Morning brief: plain-English summary of the top ready accounts and why
- [ ] Funnels (visited → signed up → activated → converted)
- [ ] Single-user journey view (step-by-step of one user)

**Definition of Done:** founder sees a ranked list of accounts ready to pay, each with a plain-English "why."

## v0.4 — Act Loop
**Goal:** turn a signal into a sent message.

Build:
- [ ] Draft outreach (email/Slack) per ready account, in the founder's voice (uses their LLM key)
- [ ] Editable draft + ONE-CLICK send (NEVER auto-send)
- [ ] Set-once rules ("when an account hits this readiness, draft this")
- [ ] Log of what was sent to whom

**Definition of Done:** founder sees a ready account, a drafted email, edits it, clicks send.

## v0.5 — Session Replay
**Goal:** watch what a user did.

Build:
- [ ] DOM/event recording in the snippet (sampled, with retention limits)
- [ ] Replay player in the dashboard
- [ ] MASK passwords + sensitive fields by default
- [ ] Storage controls (sampling, retention window)

**Definition of Done:** founder replays a session with sensitive fields masked.

## v0.6 — Legal Enrichment (opt-in, off by default)
**Goal:** enrich the founder's OWN users' companies, legally.

Build:
- [ ] Plugin toggle (off by default)
- [ ] Company-from-domain enrichment: name, logo, rough size/industry from FREE/public sources
- [ ] Cache per domain (enrich once, reuse)
- [ ] Consent/disclosure helper (generated privacy-policy clause)
- [ ] Tier sources by risk; person-level external lookup requires founder's own paid key + confirmation

**Definition of Done:** with the plugin on, companies show name/logo/size, all from free sources, disclosed.

## v1.0 — Hosted Cloud
**Goal:** the revenue version.

Build:
- [ ] Same codebase, multi-tenant, hosted by us
- [ ] Signup + project creation + billing
- [ ] Paid tiers (open-core: self-host free, cloud + advanced features paid)

**Definition of Done:** someone signs up on the cloud, pastes the snippet, sees data — no self-hosting.

---

## Build-in-public rhythm (run alongside every version)
- Daily: 1 short Twitter/X post about what you built (must map to a real commit).
- Weekly: 1 reflective LinkedIn post (the week's recap + a lesson).
- Per version: a demo video + GitHub release + cross-post (Show HN, Indie Hackers, r/SideProject;
  Product Hunt for v0.2 and v1.0).
- Rule: no post without a commit behind it. Building in public means there must be building.
