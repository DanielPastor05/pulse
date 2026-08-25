# Pulse

[![CI](https://github.com/DanielPastor05/pulse/actions/workflows/ci.yml/badge.svg)](https://github.com/DanielPastor05/pulse/actions/workflows/ci.yml)

A realtime messaging app — direct messages, group spaces and public communities.
Next.js 15 (App Router), React 19, TypeScript, Prisma, Supabase, Tailwind v4.

**Live:** https://pulse-blond-two.vercel.app

| | |
| --- | --- |
| **Automated checks** | 587 — 146 unit, 44 component, 46 integration against a real Postgres, 10 browser smoke tests, 341 end-to-end against the deployed instance |
| **Latency budgets** | p95 per endpoint over a 15-minute window, alerting to Sentry when a budget is missed ([how](#emitting-signal-is-not-watching-it)) |
| **Coverage** | 36.1% of statements and 74.1% of branches across `src/server` and `src/lib` ([what that gap means](#thirty-six-percent-and-why-branches-are-double-that)) |
| **Row Level Security** | Enabled on all 26 tables; 15 policies grant access on the 14 that need it, the other 12 deny by default — enforced independently of the API |
| **Search latency** | 6035 ms → **343-434 ms p50**, three runs, unchanged by the vector arm ([how](#making-search-nineteen-times-faster)) |
| **Search quality** | recall@5 23% → 74% by adding a vector arm, and 58% → 75% in Spanish by changing the model, both on a hand-labelled set ([how](#the-half-of-search-that-was-missing)) |
| **Database round trip** | 1230 ms → 16 ms, after moving the functions to the database's region |
| **Concurrent sending** | 13.5 s → 1.48 s → **590 ms p50** with ten people writing at once, three runs ([how](#the-hypothesis-that-was-not-wrong-just-hidden)) |
| **Realtime delivery** | 3.8 s p95 end to end at ten concurrent senders, 100% delivered |
| **Where it bends** | Sending stays under 1.2 s p95 at forty concurrent senders; delivery stretches to 10.6 s ([how](#where-it-bends-and-the-number-that-lied)) |
| **API surface** | 71 endpoints across 55 route files; 50 of those files call `requireUser`, the other five authorise themselves ([which](#the-five-endpoints-without-requireuser)) |


![Pulse: a group conversation with unread counts, reactions, a quoted reply and a live poll](docs/screenshots/chat.png)

![The command palette in Spanish, searching for «lo del servidor lento» and returning, as its first result, an English message that begins "Heads up: search p50 was 6 seconds, not 300 ms"](docs/screenshots/search.png)

*Asking for «lo del servidor lento» — Spanish for "the thing about the slow server" — puts "search p50 was 6 seconds, not 300 ms…" **first**. Not one word in common with the query, and not the same language; the message goes on to name Washington and Frankfurt, which is the whole story of [the region fix](#making-search-nineteen-times-faster). Lexical search returns nothing at all for that query — the numbers behind it are [here](#the-half-of-search-that-was-missing).*

*The interface in that shot is in Spanish, and that is the second thing it
demonstrates: the language comes from the account, the browser, or a switch in
settings, and is resolved on the server so the first paint is already right. The
accent colour differs from the screenshot above it for the same reason — it
belongs to the account, not to the app.*

---

## What this is

A chat app that behaves like one: messages arrive without a refresh, presence and
typing indicators are live, attachments and voice notes upload straight to object
storage, and every conversation is protected at the database level rather than by
the API remembering to check.

Voice and video calls — one to one and in groups — run peer to peer over WebRTC,
with no media server. Messages written offline queue up and send themselves when
the connection returns. There are polls, threads, a gallery of everything shared,
link previews, and push notifications that reach a closed tab. You can download
everything you have written and close the account for good — and if you own a
group with people in it, it asks you to hand it over first rather than leaving
them without an owner.

The interface is in English and Spanish, picked from your account, your browser,
or a switch in settings — decided on the server so the first paint is already
right.

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

### Where it bends, and the number that lied

Ten concurrent senders was never a scalability figure, so the benchmark was
ramped until something gave.

| concurrent senders | send p95 | delivery p95 | delivered |
| --- | --- | --- | --- |
| 10 | 1.5 s | 3.8 s | 100% |
| 40 | 1.2 s | 10.6 s | 95% |

Nothing breaks. **Sending stays flat** — the fan-out no longer sits in the
response path, so four times the load costs the sender nothing. What stretches
is delivery: roughly linear in concurrent senders, which is the realtime fan-out
saturating exactly where the earlier profiling said it would.

The first run of that ramp reported **50% delivered** at forty senders, and it
was wrong. The benchmark waited a fixed four seconds after the last send before
counting, and delivery p95 under that load is ten. Half the messages were
arriving after it stopped looking, and being counted as lost.

A benchmark that confuses *late* with *lost* is worse than no benchmark, because
the number looks like data. The wait now scales with the load.

### The half of search that was missing

Search was fast and it was literal. Ask it for «lo del servidor lento» and it
returned nothing, while the message sat right there saying *"p50 was six
seconds… Washington… Frankfurt"*. Not one word in common.

So there is a second retrieval arm now — vector similarity over `pgvector` — and
the two are combined with **Reciprocal Rank Fusion**.

RRF rather than a weighted sum, for a specific reason: `ts_rank` returns
something around 0.06 and cosine distance something around 0.2, and they do not
mean the same thing or live on the same scale. Normalising them into one number
means picking a range, and the right range changes with every query. RRF only
compares **positions**, which is the one thing both arms express identically.

Embeddings come from `bge-m3` on Cloudflare Workers AI. They used to come from
`gte-small` inside a Supabase Edge Function, which needed no third-party API and
no key at all — a genuinely nicer property, and one this gave up on purpose.

What it bought is in [the next section](#the-model-that-was-sorting-by-language).

#### What the measurements actually said

`npm run bench:quality` seeds a corpus with hand-labelled ground truth — each
query knows which message it should find — surrounds it with 175 distractors on
neighbouring topics, and scores all three configurations:

| | recall@1 | recall@5 | MRR |
| --- | --- | --- | --- |
| lexical only | 23% | 23% | 0.226 |
| vector only | 68% | 74% | 0.711 |
| **hybrid** | **68%** | **74%** | 0.710 |

Measured against the deployed instance, not a local stub.

**The lexical row went down**, from 30% to 23%, and not because anything got
worse: the query set grew from 23 to 31 with eight more Spanish questions, and
lexical scores zero on every one of them. Same arm, harder exam. Comparing a
percentage across a changed denominator is how a table quietly lies, so the
number moved and the reason is written next to it.

The win is real and large. **It does not come from the fusion.** On this corpus
the vector arm alone matches hybrid, and the lexical arm never contributes a
single unique hit — because with two hundred candidates, tokens like `7f3a91c`
and `P2002` are rare enough that the embedding separates them too, semantics or
not. The lexical arm is insurance whose premium is currently unpaid; it should
start earning as the corpus grows and rare tokens stop being rare.

That is worth saying plainly rather than shipping a table that implies the
fusion did the work.

#### What it cost, and the number that did not survive a second run

First answer here was "p50 434 ms, against 314 ms before, and we did not separate
how much is this feature and how much is a corpus that grew by thousands of
messages". That was honest about not knowing and wrong about what there was to
know.

`npm run bench:breakdown` splits the paths on one fresh account, so corpus size
is held constant and only the code path changes:

| condition | p50 | what it is |
| --- | --- | --- |
| short query | 335 ms | under 15 characters, so no vector arm at all |
| warm | 322 ms | vector arm, embedding already cached |
| cold | 544 ms | vector arm, embedding computed on the spot |

**The vector arm costs nothing** — 13 ms under the no-vector path, which is
noise. What costs is the model call on a question nobody has asked before:
**+222 ms**, once, and then the cache answers.

Then the latency benchmark was run three more times: **434, 343, 405 ms p50**.
It swings ninety milliseconds between runs. The 120 ms "regression" published
earlier was one run treated as a measurement.

And the thing that settles it was in the code all along: that benchmark queries
`quasar` — six characters, under the fifteen-character floor — so it never
touches the vector arm. It could not have measured this feature even in
principle.

Fourth time in this project that the instrument was the problem, and the first
where the instrument was me publishing a single sample.

#### Where it fails, measured

Broken out by query type, recall@5:

| | lexical | vector | hybrid |
| --- | --- | --- | --- |
| paraphrase (en) | 0% | 58% | 58% |
| exact terms | 100% | 100% | 100% |
| opaque ids | 100% | 100% | 100% |
| Spanish query, English corpus | 0% | 75% | 75% |

The lexical arm is at **zero** on both paraphrase rows, in either language, and
that is the honest shape of the thing: `to_tsquery` matches words, and a
paraphrase shares none. Everything the search does for a question asked in
different words than the answer, the vector arm does alone.

That Spanish row read **50%** until the embedding model changed. What moved it
is [the next section](#the-model-that-was-sorting-by-language).

### The model that was sorting by language

Once the interface shipped in two languages, "search does not work in Spanish"
stopped being a footnote. The obvious move is a multilingual embedding model.
The unobvious part is proving it is worth it, because the current one is free
and needs no credentials, and giving that up should cost more than a hunch.

So: `npm run bench:models`. It compares two models against the same labelled
corpus with **no database and no application in the way** — plain cosine over an
in-memory haystack. Putting the HNSW index, the RRF fusion and the lexical arm
in between would blend four variables into one number. If the new model does not
win under clean conditions, it will not win with more machinery on top.

| | dims | overall | en | **es** | exact | opaque |
| --- | --- | --- | --- | --- | --- | --- |
| `gte-small` | 384 | 68% | 58% | **58%** | 100% | 100% |
| `bge-m3` | 1024 | 74% | 58% | **75%** | 100% | 100% |

MRR 0.590 → 0.702. **English does not move at all.** Only Spanish does, which is
exactly what a multilingual model should do and the reason the change is
defensible. A model that improved everything by the same amount would be a
suspicious result, not a better one.

Running the full pipeline against the deployed instance afterwards returned
**74% overall and 75% in Spanish** — the isolated measurement predicted the
integrated one to the point. That agreement is the argument for measuring the
model on its own first: had the numbers diverged, the difference would have been
the index, the fusion or the lexical arm, and it would have been findable.

The mechanism is visible in a single triple. For the query *«lo del servidor
lento»*, `gte-small` scores an **unrelated** Spanish message (*«quién trae las
cervezas el viernes»*) at 0.837 — above both correct answers. It is not merely
weak at Spanish; given Spanish input it clusters by language before meaning, so
its vector arm actively works against a Spanish query. `bge-m3` puts the same
unrelated message last, at 0.361.

**Two things worth not glossing over.** The first run of this benchmark measured
against only the 28 labelled messages and handed `gte-small` 100% on opaque
identifiers — impossible for an embedding, which by construction cannot
represent `7f3a91c`. With 28 candidates the top-5 is 18% of the pile and almost
anything lands in it. That is the exact mistake `search-quality.mjs` already
documents having made, made again; the fix was the same 175 distractors. And the
Spanish bucket is 12 queries, so 75% against 58% is nine hits against seven. The
MRR shift is the sturdier of the two numbers.

The cost: 1075 neurons per million input tokens against a free allowance of
10,000 a day. Re-embedding this project's entire corpus — 1,828 messages — came
to 22 neurons. The price is not money, it is a third-party dependency and one
more credential to rotate.

The old Edge Function stays deployed on purpose. `bench:models` needs it to
reproduce that table, and a measurement you can no longer re-run stops being a
measurement.

### 95% of the production database was debris

Re-embedding the corpus meant counting it, and the count was wrong: 4,787
messages in an app with four demo conversations. Of 639 conversations, **616 had
zero members** — 4,549 messages and 441 attachments in groups nobody could
reach, some dating back nine days.

The first guess was that the test suites were not cleaning up after themselves.
That guess was wrong, and worth recording as wrong: `cleanup()` ran fine and
deleted every account it created. The debris is what deleting an account
*leaves behind*. Removing a user drops their `conversation_members` row but not
the conversation, so when the last member goes the group becomes unreachable
garbage that no query in the application will ever return — because every query
filters by membership. The bug hid inside the same rule that makes the app
secure.

Two fixes, because there were two problems:

- `cleanup()` now records which conversations the test accounts belonged to
  **before** deleting them — afterwards the membership rows are gone and with
  them the only trace — and deletes the ones left with nobody in them. It will
  not sweep orphans generally: these suites run against production, and a test
  harness has no business deleting anything it did not create.
- Separately, the harness now hooks `uncaughtException` and `unhandledRejection`
  to run cleanup on the way out. These files are top-level-`await` scripts
  rather than functions, so there is no body to wrap in `try/finally`; a throw
  halfway through used to take the process down with the accounts still live.
  That was a second, real leak — just not this one.

Both were verified by positive control: create the thing, confirm it exists,
trigger the failure, confirm it is gone. Then `bench:quality` was run against
production and left the database at exactly 5 users, 4 conversations, 0 orphans.

The uncomfortable part is how long it took to notice. Nothing was broken.
Nothing was slow enough to complain about. The only symptom was a number in a
`count(*)` that nobody had reason to run until an unrelated migration forced
it — and 1,770 of the 1,828 embeddings paid for in that migration were spent on
messages that should not have existed.

#### The threshold that does not exist

The lexical arm has a hard filter: `@@` either matches or it does not. The
vector arm has none — it returns the nearest N however far away they are. The
obvious fix is a distance cutoff, and it cannot be built honestly here.

Measured on this corpus, best-candidate cosine distance:

| distance | query |
| --- | --- |
| 0.161 | screen reader accessibility |
| **0.178** | **qwerty asdfgh zxcvbn** |
| **0.187** | **xkcd blorptastic wibblefrump** |
| 0.191 | the thing about the server being slow |

Gibberish lands *closer* than a good question. Any cutoff that rejects one
rejects the other. So there is no threshold; instead the vector arm contributes
few candidates (25 against the lexical arm's 200) to bound how much noise a
query with no real answer can produce. The asymmetry is deliberate and this is
why.

#### Three times the instrument was the thing that was wrong

The first version measured 25 messages with no distractors and reported hybrid
and vector as identical — which was true, and meaningless, because top-5 of 25
lets almost anything through. The second added distractors but still had no
query a model genuinely cannot represent, so the lexical arm looked useless. The
third reported **recall@1 higher than recall@5**, which is arithmetically
impossible, and that impossible number is what exposed the real bug: the send
rate limiter had rejected the last three seeded messages, so their ids were
`undefined`, and `undefined` matched the first element of every empty result
list. The benchmark had been quietly scoring itself right.

### A race the schema had already admitted to

`PollVote` carried a comment explaining that "one vote per *poll*" lived in the
service, because the votes table only knew about options. That was true, and it
was not enough: read-then-write inside a transaction guarantees nothing under
`read committed`. Two taps on different options of a single-answer poll both
read the same state, both delete, both insert — and the poll silently counts two
answers where one belongs. No error anywhere.

Message sending had the identical problem and it was closed with a unique index.
The pattern was solved in one place and left open in the other.

The table *can* know the poll: `singleChoicePollId` is written only when the poll
takes one answer, and a unique index on `(userId, singleChoicePollId)` does the
rest. Multiple-answer polls leave it null, and Postgres treats two nulls as
distinct, so the same constraint does not touch them.

Losing the race retries once, so the most recent tap wins instead of a double
click returning an error. Verified against production: both requests answer 200,
and the poll ends with exactly one vote.

### Two bugs the tests could not reach

Closing the file-retention hole added two code paths that touch object storage:
a sweep that deletes everything a leaving account uploaded, and a scheduled job
that clears what nothing points at any more. Both shipped. Both were wrong, and
neither had a test — for the same structural reason.

The integration layer runs against a disposable Postgres with **no Supabase at
all**, so anything touching storage sat outside what the suite could reach. The
newest code was the only code with no net under it.

**The sweep could hang.** It lists a page of a hundred objects, deletes them,
and continues while a page comes back full. It deliberately does not advance an
offset, because deleted objects leave the listing — so the next page is the first
page again. That makes the loop depend on the delete taking effect, and Supabase's
`remove` returns *without an error* when a policy denies it. One full page that
refuses to go, and the loop runs forever inside the request that deletes an
account.

Not a slow loop — a stuck one. It awaits nothing real, so it chains microtasks
without ever yielding, and the event loop never runs another timer. Removing the
fix and running the test proves it: the test's own five-second timeout never
fires either.

**The scheduled job cleaned one bucket of two.** It swept attachments and never
touched avatars, and said nothing about it. Every profile picture anyone ever
replaced was still public at its URL — the exact problem the job was written to
solve, one bucket over. Account deletion *did* clear both, so the code already
knew there were two.

Fixing that one had a trap worth recording. The live set for avatars cannot come
from `User.avatarUrl` alone: the same picker sets a group's icon, and those live
in the same bucket. Deriving the set from users only would have deleted every
group icon twenty-four hours after it was set — turning a leak into data loss.

The fix that matters is neither of the two. Storage now sits behind a five-line
interface with an in-memory double, so both paths are inside the suite. The
double imitates the two behaviours that caused the bugs: `list('')` returns
folders rather than paths, and `remove` can report success without deleting.
A double without that second behaviour could not have caught the hang at all.

### Emitting signal is not watching it

There was a line per request in the logs with route, method, status and
duration. That is not observability — it is having the signal and not looking at
it, which in practice resembles not having it. "Is it slow right now?" still had
no answer without reading logs at the exact moment it mattered.

Now a sample per request lands in `request_samples`, percentiles come from
`percentile_cont`, seven days are kept and the daily job prunes the rest, and a
p95 over budget raises a warning in Sentry — where errors are already looked at,
rather than in a channel invented for the purpose.

Four decisions worth more than the code:

**Raw samples, not bucketed histograms.** Histograms are what real metrics
systems use: they aggregate, they cost nothing to store and they merge across
windows. At a few thousand requests a day, `percentile_cont` gives the exact
percentile instead of an approximation. Past that volume this table becomes
buckets, and that is the stated ceiling rather than a surprise.

**The check rides the traffic, not a timer.** Scheduled jobs on this plan run
once a day, and a latency alert that notices tomorrow is not an alert. Riding
the traffic also has a property a cron does not: with no requests, there is
nothing to watch. Only one request per five-minute window actually evaluates —
an upsert whose `ON CONFLICT ... WHERE` acts as a lock with an expiry, the same
mechanism the rate limiter uses.

**A budget per endpoint, not one global number.** Search fans out across every
conversation a person belongs to and will always cost more than reading one row.
With a single threshold the alert would mean "this is search" instead of "this
is worse than it should be".

**Twenty samples before believing a p95.** A percentile over three requests is
the slowest of three. Without that floor the first person of the day on bad wifi
fires an alert that means nothing — and a few alerts that mean nothing is exactly
how a dashboard stops being read.

Measuring costs the measured nothing: both the write and the check run in
`after()`, and neither throws. `/api/health` and `/api/cron` are not sampled — a
probe would fill the table with the latency of `select 1`, and the cron takes
half a minute by design.

Read them at `GET /api/metrics` behind the same shared secret as the cron. On
one production sample:

| route | n | p50 | p95 |
| --- | --- | --- | --- |
| `/api/search` | 50 | 139 ms | 211 ms |
| `/api/conversations` | 50 | 119 ms | 168 ms |

Those are lower than the 340 ms the benchmark reports for search, and both are
right: this measures what the server spends, the benchmark measures the round
trip from a machine an ocean away.

### Thirty-six percent, and why branches are double that

`npm run coverage` runs the unit and integration suites under one counter — in
CI, because the integration tests need the throwaway Postgres that only exists
there. Scope is `src/server` and `src/lib`, the code those suites aim at:

| | |
| --- | --- |
| Statements | **36.1%** |
| Branches | **74.1%** |
| Functions | 44.6% |

The two headline numbers differ by a factor of two, and that is the useful part.
Statement coverage measures how much of the code is reached; branch coverage
measures how thoroughly the reached parts are exercised. **Where these tests go,
they go into the corners** — the SSRF address rules including the `172.16/12`
boundary, pagination under a twelve-way timestamp collision, the unique index
refusing a second send. They just do not go many places.

By directory:

| | statements | branches |
| --- | --- | --- |
| `server/repositories` | 65.9% | 78.0% |
| `server/services` | 26.9% | 67.6% |
| `lib` | 40.7% | 66.7% |

One confound worth stating rather than tuning away: `src/lib` mixes browser and
server code, so modules like `navigate.ts` and `api-client.ts` sit at 0% by
construction under a server-side suite. Excluding them would raise the number
without changing anything true, so they stay in.

### The five endpoints without requireUser

Fifty of fifty-five route files call `requireUser()`. The other five are
each a deliberate answer to "who is calling this?":

| endpoint | who calls it | how it authorises |
| --- | --- | --- |
| `/api/health` | uptime probes, orchestrators | nobody — a health check that needs a session cannot report that auth is down |
| `/api/cron/cleanup` | Vercel's scheduler | shared secret in the `Authorization` header |
| `/api/metrics` | whoever is asking how it performs | the same shared secret |
| `/api/me/onboarding` | a signed-in account with no profile row yet | `getAuthUser()` and its own 401 — `requireUser` resolves the profile row, which is precisely what this endpoint creates |
| `/api/uploads` | the same account, picking an avatar mid-signup | `getAuthUser()`, then `getSessionUser()` for anything that is not an avatar |

The last one was the fifth by accident, and the accident was a bug: `requireUser`
resolves the profile row, so choosing a picture during sign-up answered **"you
need to sign in to do that"** to somebody in the middle of signing up. The first
person who registered hit it. Relaxing it to `getAuthUser()` is correct, and the
relaxation stops at the avatar bucket — an attachment still needs a finished
account, and somebody without one is in no conversation to put it in.

Only the first is genuinely open. The middleware exempts the other three from
its session check, which is a thing worth getting right in both directions:
`/api/metrics` was added without that exemption and returned 401 to everything,
including the correct secret. The 401 body was identical to the one the endpoint
itself returns, so the authorisation test passed on all three negative cases
while never once reaching the code it was testing.

### The hypothesis that was not wrong, just hidden

With latency percentiles finally in place, the obvious next question was whether
the rate limiter — a Postgres write on every mutating request, and the suspect
named in three reviews — deserved to move to Redis. `pg_stat_statements` gave a
different answer:

| query | total | share of all DB time | calls | mean |
| --- | --- | --- | --- | --- |
| `UPDATE conversations SET lastMessageAt` | 841 s | **57%** | 1,944 | **433 ms** |
| rate limiter upsert | 375 s | 25% | 8,118 | 46 ms |

The single largest consumer of database time in this application was a one-row
update nobody was looking at. Every message into a conversation writes the same
row, so concurrent sends serialise on its lock — group size charged to whoever
is typing, which is the exact shape of the fan-out problem, in a different
place.

**And this project had already tested that hypothesis and dismissed it.** The
table further up says so: *"Row lock on the conversation → move `lastMessageAt`
out of the transaction → p50 unchanged"*. That measurement was correct. It was
also taken while the fan-out cost thirteen seconds, and half a second does not
show up next to thirteen. The hypothesis was not wrong; it was **masked by a
larger one**, and it only became visible after the larger one was fixed.

That is an argument for re-measuring after every fix rather than only before the
first one.

The update moved into `after()`, ahead of the broadcasts — anyone receiving
`inbox.updated` refetches the conversation list, and a mark not yet written
would hand them the old ordering.

**1.48 s → 590 ms p50** at ten concurrent senders, delivery still 100%. Measured
three times — 613, 558 and 607 ms — because a single run is a sample, not a
measurement, and this README already has one entry that learned that the hard
way.

### Measuring the half the server cannot see

The server times its own work. It cannot time how long a screen takes to paint,
how long it takes to answer the first tap, or whether content shifts under a
finger mid-read. A p50 of 139 ms on an endpoint says nothing about any of it.

`useReportWebVitals` now beacons LCP, INP, CLS, FCP and TTFB to `/api/vitals`,
and they surface in the same `/api/metrics` as the server percentiles.

Three decisions worth the words:

- **Their own table, not `request_samples`.** The shapes look alike and the
  units are not: CLS is a unitless score between 0 and 1, and in a millisecond
  integer column it would round to zero. Storing it there would mean scaling by
  a thousand and remembering the factor at every read — which is how a number
  that does not mean what it says ends up published.
- **`sendBeacon`, not `fetch`.** These arrive as the tab is being hidden or
  closed, exactly where a normal fetch is cancelled.
- **A closed list of metric names.** The browser is the caller, so anyone can
  send anything; without the list an arbitrary string becomes its own series and
  the dashboard fills with invented metrics until the real ones are buried.

Reported at p75, not p95 — that is the percentile Google defines for Core Web
Vitals, so the number can be compared against a published threshold instead of
only against itself.

### A performance gate that counts queries, not milliseconds

A wall-clock budget on a shared CI runner is flaky, and a flaky gate gets
disabled — at which point it protects nothing. Query counts are deterministic,
and they are the exact shape of the failure this project already paid for: a
page of twenty results issuing forty sequential round trips.

Four checks assert that cost **does not grow with page size** — message history,
conversation summaries and threads — plus one that the GIN search index still
exists, since `migrate diff` has already tried to drop it once.

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

### The language picker did nothing, and everything said it worked

The app ships in English and Spanish. The dictionaries are plain typed objects —
`es.ts` is declared `satisfies Messages`, so a missing or misspelled translation
is a **compile error** rather than a screen that quietly shows a key name. That
is the entire reason they are not JSON: a JSON bundle cannot tell you at build
time that a translation is missing. 540 entries per language across 11 groups,
consumed by 72 files.

Getting to *all* of them took four passes, and each pass was a regex that had
been tuned to catch the previous miss. `Add` slipped through for being three
letters. `Public` slipped through for sitting in the same ternary as a key that
had already been translated. `(you)` slipped through for being lowercase and in
brackets. Every scan came back clean and the interface was still half English.

What found the rest was parsing with the TypeScript compiler instead of guessing
with patterns — it already knows a JSX text node from a generic, a comment or an
identifier. That turned up thirteen more, all of the same shape: text *wrapping*
an interpolation, like `Step {n} of {m}`, which no line-based pattern can see.
And a grep for template literals in user-facing attributes turned up nine
`aria-label`s that are invisible on screen and read aloud by a screen reader,
which in an app that bothers with `role="log"` and `aria-live` is the same
inconsistency, just not one you can photograph.

That is where this section used to end, and it ended one pass too early.

The first time a component was mounted in a test — months later, closing an
unrelated gap — the typing indicator rendered **"Marta is typing" with the
interface in Spanish**. Pulling that thread found fifteen more strings, in three
shapes the AST scan never looked at, because it walked `JsxText` nodes and none
of these is one:

| shape | example |
| --- | --- |
| literal inside `{…}` | `{muted ? 'Unmute' : t.conversation.mute}` |
| attribute value | `emptyDescription="Messages you send here…"` |
| literal returned from a helper | `return \`${name} is typing\`` |

Five of them already had a translated key sitting unused in the dictionary. The
translator had done the work and the component never called it.

The lesson is not that a fourth shape existed. It is that **a detector that
finds nothing and a codebase that is fully translated look identical from the
outside**, and the only difference between them is a test you can run against a
case you know is broken. The scan now lives in `tests/unit/untranslated.test.ts`
with a positive control that feeds it three known-bad snippets and fails if it
stays quiet.

### The typing indicator was two seconds late, and the network was not to blame

Using the app, the "X is typing" bubble felt slow to appear. The obvious suspect
was the realtime round trip, so that got measured first — two real clients, the
same private channel, the same broadcast the browser sends:

| leg | measured |
| --- | ---: |
| typing event, client → client | **47 ms p50**, 168 ms max over 12 rounds |
| channel subscription after opening a conversation | 341–399 ms |

47 ms is not a delay anybody can feel, which meant the answer was in the code.
The sender throttles to one packet every two seconds, and it stamped the
throttle clock *before* checking that the channel existed:

```ts
if (now - lastTypingSentAt.current < THROTTLE) return;
lastTypingSentAt.current = now;        // the turn is spent here
void channelRef.current?.send(…);      // and there may be no channel here
```

Type within the ~350 ms the subscription takes and the packet is dropped **and**
the two-second wait starts, so the other side sees nothing until two seconds
after you began. Nothing failed, nothing logged, and the only symptom was
"feels a bit slow" — which is exactly the kind of bug that never gets chased.

The fix is the ordering, and it lives in `src/lib/typing-throttle.ts` because the
ordering is the whole bug.

That made it appear sooner. It still lingered on the way out, and that half was
arithmetic nobody had added up:

| | before | after |
| --- | ---: | ---: |
| sender throttle | 2 s | 1 s |
| entry lifetime | 4 s | 2.5 s |
| sweep interval | 1 s | 0.25 s |
| **tail after the last keystroke** | **4–7 s** | **1.5–3.75 s** |

The three are not independent, which is why they now live in one file with the
tests that pin their relationship. **The lifetime must exceed the throttle plus
the trip time**, or nothing refreshes the entry between packets and the bubble
blinks off and on every second — so lowering one number alone introduces a
different bug than the one it fixes. One test asserts that relationship using the
measured worst-case trip (168 ms) rather than a guessed constant; another caps
the tail.

Doubling the packet rate is the cost, and it is small: one packet per second per
person actually typing, against a channel that carried 200 events per second in
the flood test without shedding any.

Reproduce the measurement with `npm run bench:typing`.

The locale resolves server-side — cookie, then `Accept-Language`, then English —
so the first paint is already in the right language rather than flashing English
at somebody who does not read it.

Then the picker itself did nothing.

`LOCALE_COOKIE` was exported from the provider, which carries `'use client'`. A
client module does not hand values to the server; it hands it *references* the
client will resolve later. So `cookies().get(LOCALE_COOKIE)` was not looking for
`"pulse-locale"`, it was looking for an object, finding nothing, and falling back
to `Accept-Language` in silence. On a Spanish browser that produces Spanish —
which looks exactly like success.

Typecheck, lint and build all passed. They had to: the code is well typed on both
sides of a boundary the type system does not model. Moving the constant to a
module with no directive fixes it, and the fix is one line.

What earns its place here is the check, not the fix. `tests/smoke/locale.spec.ts`
drives a real browser through four cases — cookie against browser language,
browser language alone, an unsupported language, and the tab title, which is
resolved separately from the page body and can lag it. It asserts the `lang`
attribute rather than any particular sentence, so rewording a screen does not
break it. Verified with a positive control: reintroducing the bug fails exactly
the cookie test and leaves the other three green.

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

577 checks, in five layers.

```bash
npm test                  # 146 unit tests — pure logic, no I/O
npm run test:component    # 44 component tests in a DOM
npm run test:integration  # 46 tests against a real Postgres, four of them a perf gate
npm run test:smoke        # 10 browser checks against the production build
npm run test:e2e          # 341 checks against a running server + real Supabase
```

The end-to-end count understates the work in one place: the fuzzing suite throws
545 requests at all 67 methods and collapses them into a handful of assertions,
because the useful claim is "none of these produced a 5xx or leaked an internal
detail" rather than 545 separate lines saying so.

One of them is worth singling out: it boots the real Sentry SDK with a
transport that captures the envelope instead of sending it, then asserts a
message body cannot be found anywhere in the bytes that would have left the
process — with a positive control proving the assertion can fail. Testing the
scrubbing function alone would have proved it scrubs, not that it is wired in.

The component layer exists now too: six tests over `MessageBubble`, the piece
that decides what a person sees of every message and the one rendered hundreds
of times per screen. No snapshots — a snapshot fails when a CSS class changes
and passes when the "message deleted" notice disappears, which protects the
appearance instead of the promise. The one that earns its place asserts that a
soft-deleted message never ships its original text to the browser.

Five of the unit tests point at this file. An audit found **seven** figures here
that had drifted — the check total, the coverage, the RLS description, and three
endpoint counts that contradicted each other: 46 in one place, 51 in another,
and "the two routes without a session" when there were four. None broke at once.
Each fell behind on the day somebody added a route and did not reread the front
page.

In a document whose entire argument is *here is the number, measured*, a stale
figure does not read as an oversight. It reads as evidence that none of the
others were checked either. So `tests/unit/readme-claims.test.ts` now reads the
README and fails when the check total stops equalling its own parts, when the
route-file and endpoint counts stop matching `src/app/api`, or when it tells you
to run a script that does not exist.

It only covers what can be known by **reading files**. Coverage percentages and
latencies come from running things, so they are still maintained by hand — which
is worth stating, so nobody reads the test as a wider guarantee than it gives.

One trap it had to be built around: counting *mentions* of `requireUser` says
`/api/metrics` uses it, because the phrase appears in a comment explaining why it
does not. It counts calls.

The smoke layer answers a question no other layer can: does this come alive in a
browser? Four of its ten checks are there because of the language bug above —
that class of failure is invisible to a type system by construction, since the
mistake is on a boundary the type system does not model.

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

They also cover the file-storage paths, through an in-memory double that
imitates two behaviours of the real thing that matter: `list('')` returns
*folders* rather than full paths, and `remove` can report success without
deleting anything. Both are load-bearing — see the note below.

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
required; GIPHY (GIFs and stickers), VAPID (web push) and Sentry (error
reporting) are optional and the app runs without them.

Optional means the feature is off, not that it degrades: with no `GIPHY_API_KEY`
the picker renders an empty state saying so, and every other endpoint reports it
as `configured: false` rather than failing. That is deliberate, and it is also
the current state of the deployed instance — the GIF and sticker tabs are wired
and dormant until a key is set.

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
npm run test:component   npm run test:integration npm run test:smoke
npm run test:e2e
npm run bench:quality   # recall@k of each retrieval arm, end to end
npm run bench:models    # the two embedding models, no database in the way
npm run bench:rate      # the real burst ceiling of the rate limiter
npm run bench:sustained # three minutes of load: does it degrade over time?
npm run bench:breakdown # where search latency actually goes
npm run coverage        # unit + component + integration under one counter
npm run bench:search     npm run bench:load
npm run db:migrate       npm run db:deploy        npm run db:studio
```

### API

71 endpoints across 55 route files, all JSON. All of them require a session
except the four that [authorise themselves](#the-five-endpoints-without-requireuser).
Errors share one shape: `{ error, code, details? }`.

| Area | Endpoints |
| --- | --- |
| Session & profile | `GET/PATCH/DELETE /me`, `GET /me/export`, `POST /me/onboarding`, `GET /users/[username]`, `GET /users/search`, `POST /presence` |
| Conversations | `GET/POST /conversations`, `GET/PATCH/DELETE /conversations/[id]`, `POST /conversations/direct`, `GET /discover` |
| Membership | `GET/POST /conversations/[id]/members`, `DELETE /conversations/[id]/members/[userId]`, `PATCH /conversations/[id]/owner`, `POST /conversations/[id]/join`, `GET/POST /conversations/[id]/join-requests` |
| Invites | `POST /conversations/[id]/invites`, `GET/POST /invites/[code]` |
| Messages | `GET/POST /conversations/[id]/messages`, `PATCH/DELETE /messages/[id]`, `POST /messages/[id]/forward`, `GET /messages/[id]/thread`, `POST /messages/[id]/star`, `POST /messages/[id]/pin`, `PUT /messages/[id]/reactions`, `GET /messages/starred` |
| Polls | `POST /conversations/[id]/polls`, `POST /messages/[id]/poll` |
| Media & search | `POST /uploads`, `GET /conversations/[id]/gallery`, `GET /search`, `GET /gifs` |
| Social | `GET/POST /relationships`, `PATCH/DELETE /relationships/[id]`, `POST /blocks` |
| Moderation | `POST /messages/[id]/report`, `GET /conversations/[id]/reports`, `PATCH /reports/[id]`, `GET /conversations/[id]/moderation-log` |
| Notifications | `GET /notifications`, `PATCH /notifications/[id]`, `POST/DELETE /push/subscriptions` |
| Calls | `GET /calls/ice`, `POST /conversations/[id]/calls`, `POST /conversations/[id]/calls/[callId]/reject` |
| Conversation state | `POST /conversations/[id]/read`, `PATCH /conversations/[id]/preferences`, `GET /conversations/[id]/pins` |
| Scheduled | `GET/POST /conversations/[id]/scheduled`, `DELETE /conversations/[id]/scheduled/[scheduledId]` |
| Assistant | `POST /assistant` |
| Operations | `GET /health`, `GET /cron/cleanup`, `GET /metrics`, `POST /vitals` — `/vitals` needs a session; the other three are the ones that do not, and the cron and metrics each check a shared secret |

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
- **Search does not normalise accents.** The `simple` text search config is
  deliberate — the content mixes Spanish and English, and picking one language's
  stemmer degrades the other — but it means «orion» does not find «Orión».
- **Outbound email goes through Gmail SMTP**, capped around 500 messages a day.
  Fine for a beta, and the ceiling to watch first.
- **Voice notes record to WebM**, which older iOS Safari does not produce; the
  recorder falls back to whatever `MediaRecorder` offers.
- **Deleting your account removes your files, but a CDN copy can outlive it.**
  The objects are deleted from storage — verified end to end — and the URL
  returns 400 from origin. Measured caveat: for a short window the exact
  original URL can still be served from an edge cache to somebody who already
  had it. Revoking that instantly would mean serving media through the app
  instead of a public bucket, which costs a request per image.
- **Scheduled cleanup scans up to 1000 accounts per bucket per run.** It walks
  storage a folder at a time, and a run that hits that ceiling logs a warning
  rather than reporting a clean sweep — a cap that truncates silently reads
  exactly like "nothing left to do". Past that volume it needs to page by owner,
  or mark an object as claimed when it is attached and search on that instead.
- **Realtime delivery is best effort.** The server broadcasts over HTTP and does
  not retry: if that call fails, the message is safely in the database but does
  not appear live until the recipient refocuses the tab. Structured logging makes
  the failure visible; nothing yet makes it recoverable.
- **Metrics are raw samples, not histograms, and there are no traces.** Exact
  percentiles are affordable at a few thousand requests a day; past that the
  table becomes bucketed counters. There is still no distributed trace, so a
  slow request tells you *which* endpoint and not *which part of it* — the next
  thing worth adding, and it needs a real reason before it earns its cost.
- **The latency alert has no error budget behind it.** A p95 over budget raises
  a warning; nothing counts how long it stayed there or decides what that should
  cost.
- **Server-side messages are still English.** Everything rendered in the browser
  is translated; the validation and error strings the API returns are not. They
  reach the user through a toast, so this is visible, not theoretical. Fixing it
  means resolving a locale per request inside the API layer rather than per page,
  which is a different piece of plumbing from the one that is built.
- **Translating the sign-in pages cost their static prerendering.** Reading the
  locale means reading a cookie, and a page that reads a cookie is rendered on
  demand. The four auth screens used to be static. That is the price of the login
  form appearing in the visitor's language, and it is the right trade here — but
  it is a real one, not a free win.
- **Search quality is still not equal in both languages.** Moving to `bge-m3`
  took Spanish recall@5 from 58% to 75% against an unchanged 58% in English, so
  Spanish is now the better-served of the two on the vector arm — but the
  `simple` text search config still stems neither language, so the lexical arm
  helps both equally little. The Spanish figure rests on twelve labelled
  queries; it is a direction, not a decimal.
- **The embedding model is now a third-party dependency.** It used to run inside
  a Supabase Edge Function with no key at all. It now needs a Cloudflare account
  and a token to rotate, and if that token is missing the vector arm returns
  nothing and search silently falls back to lexical-only. That fallback is
  logged, and it is degradation rather than failure — but it is a new way for
  the feature to get quietly worse.

---

## License

[MIT](LICENSE) — Daniel Pastor, 2026.
