# PRODUCT.md — C-thru Product Vision & Reasoning

> Read this when you need the "why" behind a decision. CLAUDE.md has the rules;
> this file has the reasoning so you make good judgment calls on ambiguous things.

## The problem we solve

A PLG founder has hundreds of people using their product but is flying blind:
- They don't know WHICH companies are using them.
- They don't know WHO is about to convert from free to paid.
- They waste time guessing who to email, and write outreach from scratch.
- Existing tools that solve this are closed and cost $549–$1,299/month.

## The C-thru promise

> "Paste C-thru into your app, and the first-party data you already own becomes a daily list
> of who's about to pay — with the outreach drafted and ready to send. Open-source, your server, free."

## The user journey (a founder named Aarav)

1. Aarav runs `docker compose up` on his server and adds the snippet + identify call to his app.
2. C-thru auto-captures all behavior and ties it to logged-in users.
3. C-thru groups users by email domain into companies: "4 people from Razorpay are using you."
   → This is the instant wow in the first 10 minutes, using data he ALREADY has.
4. C-thru scores accounts by readiness using rules Aarav set: "3+ active users, 5+ sessions/week, free plan."
5. Every morning Aarav sees a brief: "Razorpay is ready — here's why, here's who to contact (Priya)."
6. Next to it, a drafted email in Aarav's voice. He tweaks, clicks send. (He always clicks.)
7. When Aarav has a specific question, he types it in English; C-thru shows the SQL, gives the
   exact answer + trend, and lets him pin it to his dashboard.

## Why each design choice was made

- **Postgres not Mongo:** analytics is count/filter/group-by over time + the vibe layer needs SQL.
  Mongo fights both. Postgres wins.
- **Founder brings own LLM key:** keeps C-thru free, keeps data on the founder's side, no cost to us.
- **Show the SQL:** the whole product dies if a number is wrong once. Verifiability = trust.
- **Rules before AI scoring:** we have no training data at launch and AI scoring would be an
  untrustable black box. Visible rules are correct and trustable from day one.
- **Never auto-send:** legal (anti-spam) + trust. A human-in-the-loop is a feature, not a limitation.
- **First-party only:** legal safety (GDPR/CCPA) AND it's the wedge — incumbents' third-party IP
  databases are decaying as work goes remote; first-party data is where the market is fleeing.
- **Both dashboard + vibe:** dashboard for "I know what I want to see," vibe for "I have a question."
  Vibe-only feels like a toy; dashboard-only is just another Mixpanel. Both = the product.

## Competitive landscape (know your enemy)

- **Correlated** — closest competitor. PLG signals, ready-to-convert detection, Slack/CRM actions. CLOSED.
- **Gainsight PX, 6sense, HockeyStack, Warmly, RB2B** — all closed, all paid, all do versions of this.
- **PostHog** — open-source analytics, but deliberately stays horizontal; does NOT do the PQL-to-action layer.
- **Our gap:** the open-source, self-hosted PQL engine. Nobody owns it.

## The moat

Not the code (forkable), not features (copyable). **The open-source developer community.**
Build in public, obsess over 5-minute deploy, grow GitHub stars + contributors. This is also
free distribution. Optimize for it in every decision (deploy ease, docs quality, honest README).

## What "top 1%" requires that we don't have yet

The founder's OWN insight — the specific pain discovered when real PLG founders use C-thru.
This plan is the skeleton (top 10%). The 1% comes from folding in what real founders ask for.
Therefore: ship early, ship public, talk to founders, listen.
