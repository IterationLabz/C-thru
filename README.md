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

## What it does

- **Captures everything** — auto-capture + custom events + server-side ground-truth events
- **Groups users into companies** — "4 people from razorpay.com are using you"
- **Scores readiness-to-pay** — with transparent rules you set and can see
- **Morning brief** — who's ready, and why, in plain English
- **Drafts the outreach** — in your voice, one click to send (never auto-sends)
- **Dashboard + Vibe Analytics** — visual charts, or ask in plain English (always shows the SQL)

## Quickstart

> Requires [Docker](https://docs.docker.com/get-docker/)

```bash
git clone https://github.com/bhavishyaone/C-thru
cd C-thru
cp .env.example .env.local   # fill in your keys
docker compose up
```

Open [http://localhost:3000](http://localhost:3000).

## Add the snippet to your app

```html
<script src="http://your-cthru-host/cthru.js" data-project="default"></script>
```

```js
// identify logged-in users (unlocks company grouping)
cthru.identify("user_123", { email: "priya@razorpay.com" });

// track meaningful moments
cthru.track("invited_teammate", { count: 3 });
cthru.track("hit_paywall", { feature: "export" });
```

```js
// server-side ground-truth events (from your Node backend)
import { Cthru } from "@cthru/node";
const cthru = new Cthru({ host: process.env.CTHRU_HOST });
await cthru.trackServer("payment_succeeded", { userId: "user_123", amount: 499 });
```

## Status

Building in public — v0.1 (Core Tracker) in progress.

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full build order.

## Stack

Next.js · TypeScript · PostgreSQL · Docker · your own LLM key (v0.2+)

## License

MIT
