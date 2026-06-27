# C-thru

**The open-source, self-hosted PQL engine for product-led startups.**

C-thru turns the user data you already own into a daily list of *who's about to pay* —
with the outreach drafted and ready to send. Your data, your server, free.

> PQL = Product Qualified Lead — an account *behaving* like it's about to pay.

---

## Why C-thru?

Tools that tell you which accounts are ready to convert (Correlated, Gainsight, 6sense, Warmly)
are closed, cost $549–$1,299/month, and require handing over your users' data.

C-thru is the open-source alternative. Self-host it in 5 minutes. The data never leaves your server.

## What it does (v0.1 — Core Tracker)

- **Captures everything** — auto-capture page views, clicks, and custom events; plus server-side ground-truth events
- **Groups users into companies** — "4 people from razorpay.com are using you" via email-domain inference
- **Dashboard** — active users, new signups, top events, live count, and a ranked companies list
- **Settings** — mark key events that signal readiness-to-pay; manage blocked personal email domains

Coming in v0.2+: PQL scoring, morning brief, AI-drafted outreach, vibe analytics.

---

## Quickstart

> Requires [Docker](https://docs.docker.com/get-docker/) and Node ≥ 18.

```bash
git clone https://github.com/IterationLabz/C-thru
cd C-thru
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Postgres — must match Docker Compose (port 5433, user cthru)
DATABASE_URL=postgres://cthru:cthru@localhost:5433/cthru

# Public key — safe to ship in the browser snippet
CTHRU_WRITE_KEY=your-write-key

# Secret key — backend only, never expose to the browser
CTHRU_SERVER_KEY=your-server-key
```

Start Postgres (migrations run automatically on first boot):

```bash
docker compose up -d db
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll see the dashboard.

---

## Add the browser snippet

Drop this in your `<head>` on every page:

```html
<script
  src="http://your-cthru-host/cthru.js"
  data-write-key="your-write-key"
></script>
```

The snippet auto-captures page views, clicks, session starts, rage clicks, and form submits.

### Identify logged-in users

Call `identify` once after login — this is what unlocks company grouping:

```js
cthru.identify("user_123", { email: "priya@razorpay.com" });
```

### Track custom events

```js
cthru.track("invited_teammate", { count: 3 });
cthru.track("hit_paywall", { feature: "export" });
```

---

## Server-side events (Node SDK)

Use `trackServer` for ground-truth events that happen in your backend (payments, activations):

```js
import { Cthru } from "@cthru/node";

const cthru = new Cthru({
  host: "http://your-cthru-host",
  serverKey: process.env.CTHRU_SERVER_KEY,
});

await cthru.trackServer("payment_succeeded", {
  userId: "user_123",
  email: "priya@razorpay.com",
  amount: 499,
});
```

The server key is required for `source: 'server'` events and must never be sent to the browser.

---

## Settings

Visit [/settings](http://localhost:3000/settings) to:

- **Key events** — mark events that signal readiness-to-pay (e.g. `payment_succeeded`, `invited_teammate`)
- **Blocked domains** — personal email providers (gmail.com, yahoo.com, …) are pre-seeded; add or remove as needed

---

## Running tests

```bash
# Start Postgres first
docker compose up -d db

# Run the full test suite (98 tests across 12 files)
npm test
```

Tests use a separate `cthru_test` database created automatically. The suite covers the ingestion pipeline, timestamp validation, domain classification, rate limiting, dashboard queries, key events CRUD, blocked domains CRUD, and a full end-to-end smoke test.

---

## Stack

Next.js 15 · TypeScript (strict) · PostgreSQL 15 · Docker Compose · Vitest · pg

## License

MIT
