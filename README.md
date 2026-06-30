# Voyager — Agentic AI Travel Planner

A real agentic travel assistant: a LangGraph workflow with a tool-calling ReAct
agent at its core, backed by live flight, hotel, weather, maps, and currency
data — and the ability to actually execute bookings, not just describe them.

## What changed in this version (agentic rewrite)

The previous version generated itineraries from a single LLM call with mock
data. This version is a real multi-step agent:

- **Real tools, real data** — `search_flights`, `search_hotels`, `search_map`,
  `weather_tool`, `currency_exchanger`, and `web_search` all call live APIs
  (SerpApi / Weatherstack / ExchangeRate-API) via LangChain's `tool()` /
  `createReactAgent`. If a key isn't configured, the tool tells the agent
  exactly what's missing instead of fabricating data.
- **Real booking tools** — `book_flight`, `book_hotel`, `book_activity` are
  tools the agent itself can decide to call once the user confirms a choice.
  Each one writes a real `Booking` row through a PENDING → CONFIRMED/FAILED
  state machine (`src/lib/agent/booking.ts`) — it can genuinely fail (bad
  price, simulated unavailability) rather than always "succeeding" as text.
- **Multi-turn conversation** — trips are now a conversation thread. Each
  trip stores its message history (`Message` table) and extracted state
  (`Trip.agentState`) so the agent remembers context across turns, exactly
  like the reference Python implementation's `MemorySaver`-backed graph.
- **4-node graph**: `extract → validate → brain → final`, matching the
  reference design — extraction, business-rule validation (date logic,
  budget sanity), a tool-calling brain that drives the conversation, and a
  final node that produces a full itinerary using the same toolset.

## Architecture

```
User message
     │
     ▼
POST /api/agent/run  (loads/creates Trip, loads message history)
     │
     ▼
LangGraph workflow (src/lib/agent/graph.ts)
  ├─ [extract]   — Groq (via @langchain/groq) pulls structured trip fields
  │                 from the conversation (location, dates, budget, travelers)
  ├─ [validate]  — pure logic: date ordering, past-date check, budget sanity
  ├─ [brain]     — createReactAgent + 6 data tools (+3 booking tools bound to
  │                 this trip). Decides whether to search, ask a question, or
  │                 say FINALIZE
  └─ [final]     — same agent, runs a multi-tool research pass (weather, hotels,
                    attractions, restaurants, tips) and writes a complete
                    itinerary grounded in real tool output
     │
     ▼
Message + Trip.agentState + Itinerary persisted to PostgreSQL
     │
     ▼
Client renders the conversation + itinerary, can keep chatting
("book the cheapest flight") → agent calls book_flight → real Booking row
```

## Quick Start

```bash
cp .env.example .env    # fill in your values — see below
npm install
npm run setup           # prisma generate + db push + seed
npm run dev
```

### A note on Prisma 7

This project uses Prisma 7, which removed the old `prisma-client-js` generator
(and its bundled Rust query engine) entirely. The client is now plain
TypeScript, generated into `src/generated/prisma` (via the `output` path in
`prisma/schema.prisma`), and talking to Postgres requires an explicit driver
adapter (`@prisma/adapter-pg` + `pg`) instead of an auto-bundled engine binary.

Practical effect: you must run `npx prisma generate` (or `npm run setup`)
before the app will build — `src/generated/prisma` doesn't exist until then,
and `npm run build` already does this for you via `prisma generate && next build`.
This generated folder is gitignored since it's machine/schema-specific.

## Required & Optional Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` / `DIRECT_URL` | ✅ | Postgres (Neon recommended) |
| `GROQ_API_KEY` | ✅ | Powers every LLM call (extraction, brain, itinerary) |
| `GROQ_MODEL` | optional | Default `llama-3.3-70b-versatile` |
| `NEXTAUTH_SECRET` / `NEXTAUTH_URL` | ✅ | Auth |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Google sign-in |
| `CLOUDINARY_*` | optional | Trip cover photo uploads |
| `SERP_API_KEY` | recommended | Powers `search_flights`, `search_hotels`, `search_map`, `web_search` — get a free-tier key at serpapi.com |
| `WEATHER_API_KEY` | recommended | Powers `weather_tool` — free tier at weatherstack.com |
| `EXCHANGE_RATE_API_KEY` | recommended | Powers `currency_exchanger` — free tier at exchangerate-api.com |
| `GUEST_FREE_RUNS` | optional | Free agent turns before sign-in gate, default 3 |

If a tool's key is missing, the agent will say so in conversation rather
than inventing numbers — this is intentional so demo/interview reviewers see
honest behaviour, not silent mock data.

## Project Structure (agent-relevant files)

```
src/lib/agent/
├── graph.ts     — LangGraph StateGraph: extract/validate/brain/final nodes
├── tools.ts     — 6 real-data tools + makeBookingTools() factory
└── booking.ts   — Booking state machine (PENDING → CONFIRMED/FAILED)

src/app/api/agent/run/route.ts  — conversation endpoint: loads/creates Trip,
                                   loads message history, runs the graph,
                                   persists everything
src/app/api/trips/[id]/route.ts — trip detail + manual "book this trip" button
                                   (calls the same booking.ts state machine)
```

## Demo user (after seed)

Email: demo@voyager.ai / Password: voyager123
