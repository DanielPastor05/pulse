# Pulse

[![CI](https://github.com/DanielPastor05/pulse/actions/workflows/ci.yml/badge.svg)](https://github.com/DanielPastor05/pulse/actions/workflows/ci.yml)

A realtime messaging app — direct messages, group spaces and public communities.
Next.js 15 (App Router), React 19, TypeScript, Prisma, Supabase, Tailwind v4.

**Live:** https://pulse-blond-two.vercel.app

| | |
| --- | --- |
| **Automated checks** | 153 — 35 unit, 18 integration against a real Postgres, 6 browser smoke tests, 94 end-to-end against the deployed instance |
| **Row Level Security** | 20 policies, one per table, enforced independently of the API |
| **Search latency** | 6035 ms → 314 ms p50, measured before and after ([how](#making-search-nineteen-times-faster)) |
| **Database round trip** | 1230 ms → 16 ms, after moving the functions to the database's region |
| **Concurrent sending** | 13.5 s → 1.48 s p50 with ten people writing at once ([how](#the-send-response-was-waiting-for-the-fan-out)) |
| **Realtime delivery** | 2.4 s p95 end to end under that load, 100% delivered |
| **API surface** | 46 endpoints, 45 of them behind `requireUser`; the exception runs before a profile exists |

---

## What this is

A chat app that behaves like one: messages arrive without a refresh, presence and
typing indicators are live, attachments and voice notes upload straight to object
storage, and every conversation is protected at the database level rather than by
the API remembering to check.

Voice and video calls — one to one and in groups — run peer to peer over WebRTC,
with no media server. Messages written offline queue up and send themselves when
the connection returns. There are polls, threads, a gallery of everything shared,
link previews, and push notifications that reach a closed tab.

It is deployed, and the guarantees below are verified against the deployed
instance, not against mocks.

---

## Engineering notes

The interesting part of this project is not the feature list. It is a handful of
problems that were wrong in a way that still looked right, and what was done
about them. Each of these is a real commit.

### Making search nineteen times faster

Search took **6035 ms** at p50 for an account in twenty conversations. The
obvious culprit was an N+1: the endpoint resolved each matching conversation
with a helper that issues two queries, so a page of twenty results meant forty
sequential round trips. Batching them into two queries — the same aggregate the
conversation list already used — brought it to **4869 ms**.

A 19% win for removing 95% of the queries is not a win, it is a hint that the
diagnosis was wrong. So the next step was to stop guessing and measure the parts
separately, by benchmarking each search scope on its own:

| scope | p50 | of which network |
| --- | --- | --- |
| `users` | 1816 ms | 130 ms |
| `files` | 1737 ms | 130 ms |
| `messages` | 2940 ms | 130 ms |
| `conversations` | 3687 ms | 130 ms |

Every branch was slow, including the ones doing almost nothing. That pattern —
uniform slowness proportional to query *count* rather than query *cost* — points
at latency per round trip, not at any single query. A `/api/health` endpoint
reporting the time of a bare `select 1` confirmed it: **1230 ms**, from region
`iad1`.

The functions were running in Washington. The database is in Frankfurt. Vercel
defaults new projects to `iad1` and nothing had ever changed it, so every query
in the application had been crossing the Atlantic, and any request issuing ten
of them paid a second in travel alone.

The fix is three lines of `vercel.json`. The bare `select 1` went from 1230 ms
to **16 ms**, and search to **314 ms** p50 — of which 130 ms is the benchmark
machine's own distance to the edge.

The N+1 was real and worth fixing. It was also 6% of the problem, and would have
stayed the accepted explanation without a measurement that disagreed.

Reproduce with `npm run bench:search`.

### The send response was waiting for the fan-out

Ten people typing in the same room at once: the `201` took **13.5 s**. The same
ten senders spread across rooms of one took 1.25 s. Something about a *busy*
conversation was making sending slow — the exact opposite of what a group chat
should do.

The number that gave it away was the delivery latency measured beside it. The
message reached the recipient's channel at **1.8 s** while the sender waited
until 13.5 s, so the request spent eleven seconds after the broadcast had
already gone out.

Two plausible explanations were tested and both were wrong:

| hypothesis | test | result |
| --- | --- | --- |
| Row lock on the conversation | move `lastMessageAt` out of the transaction | p50 unchanged |
| Too many queries per send | stop loading nine relations on a fresh message | p50 unchanged |

The third fit the data. Ordered by how many realtime messages a send provokes,
the latency is almost a straight line:

| realtime messages | p50 |
| --- | --- |
| ~20 (room of one) | 1254 ms |
| ~120 (muted room of eleven) | 7314 ms |
| ~220 (room of eleven) | 13373 ms |

Telling everyone costs one message per recipient plus the notification ones, and
the response was waiting for all of them. Group size was being charged to the
person typing.

The message is already durable before that point, so the fan-out moved to
`after()`. Only *who gets told* is deferred, and the guarantee is unchanged: if
it fails, the log says so and the client recovers on refocus — which was already
true, just no longer paid for in latency.

**13.5 s → 1.48 s p50**, with delivery still at 100% and 2.4 s. Reproduce with
`npm run bench:load`.

### Realtime channels were public

Supabase Realtime channels default to public. The app subscribed to
`conversation:<uuid>`, so **anyone holding the publishable key — which ships in
every browser bundle — could subscribe to a conversation id and read the
messages as they were sent.** The REST API was locked down; the live socket
beside it was not.

Fixed with private channels plus RLS policies on `realtime.messages`, so the
database decides who may join a topic. Verified with a six-case authorisation
matrix: member joins, non-member rejected, in both directions.

### Blocking someone was cosmetic

The block check ran on direct conversations only. Creating a group and adding
the person who blocked you defeated it entirely — you were back in a room with
them.

The fix filters blocks in both directions on group creation *and* on adding
members, and it excludes people **silently**: an error saying "that person
blocked you" hands the information straight back to the person being avoided.

### A retry button exposed that sending was not idempotent

Failed messages used to die with a red icon, so a flaky connection meant
retyping. Adding a retry seemed trivial — the send already carried a `clientId`.

Writing the test first showed the premise was false: `clientId` travelled in the
realtime broadcast so the sender could reconcile its optimistic bubble, but it
was **never stored and never checked**. A retry would have posted the message
twice.

That cannot be fixed on the client — the retry exists precisely for when you do
not know whether the message arrived. So the key is now persisted with a unique
index on `(authorId, clientId)`, with a fast-path lookup for the common case and
constraint-violation handling for the real one: two taps racing each other. Four
concurrent sends with the same key produce exactly one message.

### Rate limiting lived in process memory

A `Map` in the Node process. Correct on one instance, useless on serverless:
every cold start resets it and every instance keeps its own count.

Moved to Postgres as a fixed window, one atomic statement doing the whole
read-modify-write. **The trade-off, stated plainly:** at a window boundary a
caller can spend the tail of one window and the head of the next, so the real
burst ceiling is 2×the limit. That is fine for blunting abuse and costs one
round trip instead of the read-modify-write a token bucket needs.

### Link previews are SSRF by construction

Unfurling a link means the server fetches a URL a user typed. The defence is not
one check but several, in `src/server/link-preview.ts`:

- the hostname is **resolved** and every resulting address checked — a name can
  point at `127.0.0.1` and the string tells you nothing;
- every redirect hop is resolved and checked again, since only the first URL is
  under your nose;
- private, loopback, link-local and cloud-metadata ranges are rejected, in IPv4,
  IPv6, and IPv4-mapped-IPv6 form;
- the read is capped in time and in bytes.

The end-to-end tests include a **positive control**. Without one, four "no
preview was created" assertions would pass just as happily if the whole feature
were dead — which is exactly what happened on the first run.

### Calls, with no signalling server and no media server

Offers, answers and ICE candidates ride the conversation's private Realtime
channel — the one RLS already restricts to members. There was no reason to build
a second authorised transport when the app had one.

The part worth knowing about is **perfect negotiation**. If both people press
call at the same moment, each receives an offer while holding one of its own,
both throw `InvalidStateError`, and the call dies with nothing in the logs to
say why. It is rare enough never to happen while developing and common enough to
happen to real users. The W3C pattern fixes it by making exactly one side yield,
and the roles are derived from the two user ids because both ends have to reach
the same answer *without talking to each other* — which is precisely the
situation during a collision.

Group calls are a **mesh**: every participant holds a connection to every other
one. That keeps infrastructure at zero, and it has a real ceiling, so it is
stated rather than discovered — each person uploads their camera N-1 times, so
four people is 1.5 Mbps up each. Capped at 4 for video and 6 for audio, with the
reason shown in the UI. Past that the answer is an SFU, which is a media server
and a different project.

TURN is the one piece that cannot be avoided: without a relay these calls fail
on most mobile networks, where symmetric NAT blocks a direct path. It is
configuration, and the UI says so when it is missing, because "it never
connects" does not point at its own cause.

### Monitoring, measured before adopting

Server-side error reporting, with the browser SDK deliberately left out: wiring
it was measured at **+96 kB of first-load JavaScript on every visit**
(`@sentry/core` alone is ~106 kB parsed). Poor trade for a chat app — the errors
you cannot otherwise see are the server ones.

What reaches Sentry is filtered deny-by-default: message bodies, search terms,
drafts and file names are redacted, query strings are dropped whole rather than
filtered key by key, and only the user id survives. Session Replay is off — it
records the DOM, which here is somebody's private conversation.

---

## Architecture

```mermaid
flowchart LR
    B["Browser<br/>React 19 · TanStack Query · Zustand"]

    subgraph V["Next.js 15 on Vercel"]
      MW["Middleware<br/>session refresh · route gating"]
      RH["Route handlers<br/>Zod · rate limit · same-origin"]
      SV["Services<br/>authorisation · business rules"]
    end

    subgraph S["Supabase"]
      PG[("Postgres<br/>RLS on every table")]
      AU["Auth"]
      RT["Realtime<br/>private channels"]
      ST["Storage<br/>MIME allow-list"]
    end

    B -->|"fetch /api"| MW
    MW --> RH
    RH --> SV
    SV -->|"Prisma"| PG
    B <-->|"WebSocket"| RT
    B -->|"signed upload"| ST
    B <-->|"cookies"| AU
    SV -->|"broadcast"| RT
    RT -.->|"authorises via RLS"| PG
    AU -.-> PG
    ST -.->|"storage policies"| PG
```

Two things worth pointing at:

**Authorisation lives in the database.** RLS is enabled on all 17 tables, and
the realtime topics are gated by the same policies. If a route handler forgets a
check, Postgres still refuses. Membership helpers are `SECURITY DEFINER`
functions in a `private` schema so PostgREST never exposes them as RPC.

**Broadcasts carry enriched DTOs, not raw rows.** The payload pushed over the
socket is byte-for-byte what the REST endpoint would return, so the client needs
no second round trip to render a new message.

---

## Testing

153 checks, in four layers.

```bash
npm test                  # 35 unit tests — pure logic, no I/O
npm run test:integration  # 18 tests against a real Postgres
npm run test:smoke        # 6 browser checks against the production build
npm run test:e2e          # 94 checks against a running server + real Supabase
```

The unit tests cover the things where an edge case is the whole point: URL
protocol validation, the SSRF address rules including the `172.16/12` boundary
and IPv4-mapped IPv6, Open Graph parsing, the Sentry scrubbing, the offline
queue against corrupt and full storage, and the invariant that keeps calls
connecting — that of any two peers, exactly one yields on a collision.

The integration tests exercise the repository layer — where the query logic
lives — against a disposable Postgres, so they can assert things no unit test
can reach: that unread counts exclude your own messages and drop deleted ones,
that pagination neither skips nor repeats when twelve messages share a
millisecond, that replying does not hide a message from the main view, and that
the unique index really does refuse a second send with the same `clientId`
while still allowing a different author to reuse it. They refuse to run if
`DATABASE_URL` looks like the deployed database.

The end-to-end suites talk to a **real** server, database, auth and object
storage. That is deliberate: what they check — block enforcement, rate limiting,
storage MIME rules, realtime authorisation — only exists once a request has been
through middleware, a route handler, Prisma and Postgres. A mock of any of those
would be testing the mock. They create throwaway accounts and delete them on the
way out.

```bash
E2E_APP_URL=https://pulse-blond-two.vercel.app npm run test:e2e
```

**CI runs typecheck, lint, unit tests, integration tests, the production build
and the browser smoke tests on every push**, against a throwaway Postgres it starts for the run. Applying the
migrations to that empty database is itself a test: it caught that the baseline
migration declared five trigram indexes without creating the `pg_trgm`
extension they need, which had never surfaced because Supabase ships it
installed.

The end-to-end suites are excluded on purpose: they need a live server and real
credentials, and they create real accounts — running them on every push would
fill the production database with test data.

---

## Setup

```bash
npm install
cp .env.example .env   # then fill it in
npm run db:deploy      # applies prisma/migrations
npm run dev
```

For the database alone — enough to run the integration tests, not the app:

```bash
docker compose up -d
DATABASE_URL=postgresql://pulse:pulse@localhost:5432/pulse npm run db:deploy
DATABASE_URL=postgresql://pulse:pulse@localhost:5432/pulse npm run test:integration
```

There is also a `Dockerfile` that builds a production image. Be aware of what it
cannot do: auth, realtime and object storage are Supabase, so a container still
needs a project. What Docker buys here is a reproducible build and a local
database, not a self-contained stack.

`.env.example` documents every variable and which are optional. The short
version: Supabase URL and keys plus two Postgres connection strings are
required; Tenor (GIF picker), VAPID (web push) and Sentry (error reporting) are
optional and the app runs without them.

Both connection strings go through Supavisor, the Supabase pooler. `DATABASE_URL`
uses transaction mode on port 6543 with `connection_limit=10`; `DIRECT_URL` uses
session mode on 5432, which migrations need because the pooler does not support
the protocol they speak.

Schema changes ship as migrations under `prisma/migrations`, applied with
`npm run db:deploy`. The initial one was generated from the schema and baselined
against the deployed database after `migrate diff` confirmed there was no drift,
so no data was ever touched to introduce it.

`prisma/sql/security.sql` is the reproducible source of truth for everything
Prisma cannot express: RLS policies, the realtime authorisation rules, storage
buckets and their MIME allow-lists, trigram indexes, and the account-deletion
trigger.

### Scripts

```bash
npm run dev              npm run build            npm run start
npm run typecheck        npm run lint             npm test
npm run test:integration npm run test:e2e         npm run test:smoke
npm run bench:search     npm run bench:load
npm run db:migrate       npm run db:deploy        npm run db:studio
```

### API

46 endpoints, all JSON, all but `/api/health` requiring a session. Errors share
one shape: `{ error, code, details? }`.

| Area | Endpoints |
| --- | --- |
| Session & profile | `GET/PATCH /me`, `POST /me/onboarding`, `GET /users/[username]`, `GET /users/search`, `POST /presence` |
| Conversations | `GET/POST /conversations`, `GET/PATCH/DELETE /conversations/[id]`, `POST /conversations/direct`, `GET /discover` |
| Membership | `GET/POST /conversations/[id]/members`, `DELETE /conversations/[id]/members/[userId]`, `PATCH /conversations/[id]/owner`, `POST /conversations/[id]/join`, `GET/POST /conversations/[id]/join-requests` |
| Invites | `POST /conversations/[id]/invites`, `GET/POST /invites/[code]` |
| Messages | `GET/POST /conversations/[id]/messages`, `PATCH/DELETE /messages/[id]`, `POST /messages/[id]/forward`, `GET /messages/[id]/thread`, `POST /messages/[id]/star`, `POST /messages/[id]/pin`, `PUT /messages/[id]/reactions`, `GET /messages/starred` |
| Polls | `POST /conversations/[id]/polls`, `POST /messages/[id]/poll` |
| Media & search | `POST /uploads`, `GET /conversations/[id]/gallery`, `GET /search`, `GET /gifs` |
| Social | `GET/POST /relationships`, `PATCH/DELETE /relationships/[id]`, `POST /blocks` |
| Moderation | `POST /messages/[id]/report`, `GET /conversations/[id]/reports`, `PATCH /reports/[id]` |
| Notifications | `GET /notifications`, `PATCH /notifications/[id]`, `POST/DELETE /push/subscriptions` |
| Calls | `GET /calls/ice`, `POST /conversations/[id]/calls`, `POST /conversations/[id]/calls/[callId]/reject` |
| Operations | `GET /health` — the only unauthenticated route |

---

## Known limits

Written down rather than glossed over:

- **Group calls are capped at 4 video / 6 audio**, because mesh makes every
  participant upload their own camera N-1 times. An SFU lifts it; that is a
  media server and a separate project.
- **Calls need a TURN relay** to work on mobile networks. Without one they fail
  where symmetric NAT blocks a direct path, which is most of them.
- **Threads are one level deep.** Replying to a reply lands in the same thread
  rather than nesting.
- **Rate limiting is a fixed window**, so the real burst ceiling is 2×the limit
  at a window boundary.
- **The CSP allows `'unsafe-inline'` for scripts.** Removing it needs
  per-request nonces, which would opt every static page into dynamic rendering.
  The directives that cost nothing — `object-src 'none'`, `base-uri`,
  `frame-ancestors`, `form-action` — are all set.
- **Search uses trigram `ILIKE`.** Fast into the millions of rows with the
  indexes in `security.sql`; swap for `tsvector` if you need ranking.
- **Outbound email goes through Gmail SMTP**, capped around 500 messages a day.
  Fine for a beta, and the ceiling to watch first.
- **Voice notes record to WebM**, which older iOS Safari does not produce; the
  recorder falls back to whatever `MediaRecorder` offers.
- **Realtime delivery is best effort.** The server broadcasts over HTTP and does
  not retry: if that call fails, the message is safely in the database but does
  not appear live until the recipient refocuses the tab. Structured logging makes
  the failure visible; nothing yet makes it recoverable.
- **There are logs but no metrics.** No latency histograms, no traces, no error
  budget. `/api/health` reports one database round trip and that is the whole of
  the instrumentation.
- **Search results are not paginated** and rank by recency, not relevance.
