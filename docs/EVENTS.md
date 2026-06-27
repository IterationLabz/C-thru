# EVENTS.md — Event Schema & SDK Signatures

> The single reference for how events are captured and stored. The whole product runs on this.
> All three channels (auto, custom, server) store into ONE table, distinguished by `source`.

## The unified `events` table (Postgres)

```sql
CREATE TABLE events (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT        NOT NULL,            -- e.g. 'pageview', 'invited_teammate', 'payment_succeeded'
  source       TEXT        NOT NULL,            -- 'auto' | 'custom' | 'server'
  properties   JSONB       NOT NULL DEFAULT '{}',-- flexible per-event data
  user_id      TEXT,                            -- the founder's user id, if identified
  email        TEXT,                            -- if known (from identify)
  company_domain TEXT,                          -- derived from email, e.g. 'razorpay.com'
  session_id   TEXT,
  anonymous_id TEXT        NOT NULL,            -- always present, ties pre-login activity
  url          TEXT,
  referrer     TEXT,
  device       JSONB,                           -- browser, os, screen, etc.
  occurred_at  TIMESTAMPTZ NOT NULL,            -- when it happened (client clock or server)
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_name        ON events (name);
CREATE INDEX idx_events_company     ON events (company_domain);
CREATE INDEX idx_events_user        ON events (user_id);
CREATE INDEX idx_events_occurred    ON events (occurred_at);
CREATE INDEX idx_events_props_gin   ON events USING GIN (properties);
```

## Derived tables (maintained from events)

```sql
CREATE TABLE users (
  user_id        TEXT PRIMARY KEY,
  email          TEXT,
  company_domain TEXT,
  first_seen     TIMESTAMPTZ,
  last_seen      TIMESTAMPTZ,
  traits         JSONB DEFAULT '{}'             -- anything from identify()
);

CREATE TABLE companies (
  domain         TEXT PRIMARY KEY,
  name           TEXT,                          -- enriched later; start = domain
  user_count     INT DEFAULT 0,
  first_seen     TIMESTAMPTZ,
  last_seen      TIMESTAMPTZ,
  meta           JSONB DEFAULT '{}'             -- size/industry/logo when enrichment added
);
```

## Channel 1 — Auto-capture (the snippet, automatic)

Loaded via one script tag. Captures automatically, no per-event code:
- `pageview` — on load + on SPA route change
- `click` — on any click (records element tag, id, text, position)
- `session_start` / `session_end`
- `rage_click` — 3+ rapid clicks same spot
- `form_submit`

Snippet install (the "one line"):
```html
<script src="https://YOUR-CTHRU-HOST/cthru.js" data-project="default"></script>
```

## Channel 2 — Custom events (founder, client-side)

The founder marks meaningful moments. These drive the readiness rules.
```js
// identify who the logged-in user is (unlocks company grouping)
cthru.identify("user_123", { email: "priya@razorpay.com", name: "Priya" });

// track a meaningful action
cthru.track("invited_teammate", { count: 3 });
cthru.track("hit_paywall", { feature: "export" });
cthru.track("started_trial", { plan: "pro" });
```

Signature:
```ts
cthru.identify(userId: string, traits?: Record<string, any>): void
cthru.track(name: string, properties?: Record<string, any>): void
```

## Channel 3 — Real / server-side events (founder backend, ground truth)

For events that must not be faked or blocked — real payments, confirmed conversions.
Install: `npm install @cthru/node` (the server SDK you build).
```js
import { Cthru } from "@cthru/node";
const cthru = new Cthru({ host: process.env.CTHRU_HOST });

// after a payment actually clears on the backend:
await cthru.trackServer("payment_succeeded", {
  userId: "user_123",
  email: "priya@razorpay.com",
  amount: 499,
  currency: "INR"
});
```

Signature:
```ts
cthru.trackServer(
  name: string,
  properties: { userId?: string; email?: string; [k: string]: any }
): Promise<void>
```

## Company derivation rule (in the ingestion API)

```
email = event.email (from identify or server event)
domain = part after '@'
if domain in PERSONAL_DOMAINS (gmail.com, yahoo.com, outlook.com, hotmail.com, icloud.com, ...):
    company_domain = null   // it's an individual, not a company
else:
    company_domain = domain
    upsert into companies(domain)  // name starts = domain, enriched later
```

## Founder-defined key events

The founder must be able to mark which event names are "key" (signup, activated, converted,
invited_teammate, etc.) in a settings screen. The readiness engine (v0.3) keys off these.
Store the list in a small `key_events` config table or project settings.

## Rules for whoever builds this
- All three channels hit ONE ingestion endpoint and ONE insert path.
- `anonymous_id` is ALWAYS set (even before identify) so pre-login activity links to the user later.
- Never trust client `occurred_at` blindly for server events — server events use server time.
- Keep `properties` flexible (JSONB) — founders invent their own events; don't hardcode a schema per event.
