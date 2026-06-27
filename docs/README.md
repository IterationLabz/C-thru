# C-thru

**The open-source, self-hostable PQL engine for product-led startups.**

C-thru turns the user data you already own into a daily list of *who's about to pay* —
with the outreach drafted and ready to send. Your data, your server, free.

> PQL = Product Qualified Lead — the account *behaving* like it's about to pay.

---

## Why C-thru?

Tools that tell you which accounts are ready to convert (Correlated, Gainsight, 6sense, Warmly)
are powerful — and closed, and cost $549–$1,299/month, and want you to hand over your users' data.

C-thru is the open-source alternative. Self-host it in 5 minutes. The data never leaves your server.

## What it does

- 📥 **Captures everything** — auto-capture + custom events + server-side "real" events
- 🏢 **Groups users into companies** — "4 people from Razorpay are using you"
- 🎯 **Scores readiness-to-pay** — with transparent rules you set and can see
- 📋 **Morning brief** — who's ready, and why, in plain English
- ✉️ **Drafts the outreach** — in your voice, one click to send (never auto-sends)
- 📊 **Dashboard + Vibe Analytics** — click through charts, OR just ask in plain English
  (it shows you the SQL so you can trust the answer)

## Quickstart

```bash
git clone https://github.com/YOUR_USERNAME/cthru
cd cthru
cp .env.example .env
docker compose up
```

Then add to your app:

```html
<script src="https://your-cthru-host/cthru.js" data-project="default"></script>
```

```js
cthru.identify("user_123", { email: "priya@razorpay.com" });
cthru.track("invited_teammate", { count: 3 });
```

## Status

🚧 Building in public, version by version. Follow the journey:
- Twitter/X: [@yourhandle]
- LinkedIn: [your profile]
- Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)

## Built with

Next.js · Node · PostgreSQL · your own LLM key (OpenAI/Anthropic/Groq) · Docker

## License

MIT — open source, forever.
