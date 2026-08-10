# Pulse

A production-ready realtime messaging app — direct messages, group spaces and
public communities — built with Next.js 15 (App Router), React 19, TypeScript,
Prisma, Supabase and Tailwind CSS v4.

---

## Quick start

The database is **already provisioned** in the Supabase project **AppChat**
(`etdbnovainhpqzvnndng`, eu-central-1): 13 tables, 41 indexes, RLS enabled and
verified on every table, both storage buckets, and the account-deletion trigger.
`.env` already carries the project URL and publishable key.

```bash
npm install
```

Two secrets still have to be pasted into `.env` by hand — they cannot be read
through the management API:

1. **`SUPABASE_SERVICE_ROLE_KEY`** → *Project Settings → API Keys → `service_role`*.
   Without it, server-to-client realtime and file uploads fail.
2. **The database password** → replace `[YOUR-PASSWORD]` in both `DATABASE_URL`
   and `DIRECT_URL`. Percent-encode any special characters (`@` → `%40`,
   `#` → `%23`, `/` → `%2F`). Without it nothing that touches Prisma works,
   which is the whole app.

Both connection strings go through **Supavisor**, the Supabase pooler, not the
direct connection. `db.<ref>.supabase.co` only publishes an AAAA record — it is
IPv6-only unless you buy the IPv4 add-on — so on an IPv4-only network the direct
connection fails with `P1001: Can't reach database server`. The pooler resolves
over IPv4 and is what you want in serverless anyway:

- `DATABASE_URL` → transaction mode, port **6543**, with `?pgbouncer=true` — used
  by the app.
- `DIRECT_URL` → session mode, port **5432** — used by `prisma db push`, which
  needs a real session for DDL.

Then enable the OAuth providers you want under *Authentication → Providers*,
and add `http://localhost:3000/auth/callback` to the redirect allow-list
(*Authentication → URL Configuration*).

```bash
npm run dev
```

Optional: set `TENOR_API_KEY` to switch on the GIF picker. Without it the
picker renders an explanatory empty state instead of failing.

> `NEXT_PUBLIC_SUPABASE_URL` is read at **build** time by `next.config.ts` to
> allow-list the storage host for the image optimiser. Changing it means
> rebuilding.

### Starting from a fresh Supabase project instead

```bash
npx prisma db push
```

…then run `prisma/sql/security.sql` in the SQL editor. It is idempotent and
covers RLS, the helper functions, storage buckets and the deletion trigger.
Both files are the single source of truth; the schema and the live database are
verified to match index-for-index.

---

## Architecture

Feature-first. Each domain owns its components, hooks and validators; shared
primitives live in `components/` and `lib/`; anything that touches the database
lives under `server/` and never reaches the browser bundle.

```
prisma/
  schema.prisma            Postgres schema (13 models)
  sql/security.sql         RLS policies, storage buckets, trigram indexes
src/
  app/
    (auth)/                Sign in, sign up, password reset
    (app)/                 Everything behind the auth wall
      chat/                Conversation list + thread
      discover/            Public group directory
      starred/             Personal shortlist
      settings/            Profile, appearance, notifications, people
      u/[username]/        Public profiles
    api/                   35 route handlers — the only way data moves
    auth/                  OAuth + email callback, sign-out
    invite/[code]/         Invite landing page
  components/
    layout/                App shell, nav rail, aurora backdrop
    providers/             Query, theme, session, toaster
    ui/                    Design-system primitives (button, dialog, menu…)
  features/
    auth/ conversations/ messages/ media/ notifications/ profile/
    realtime/ search/      Each with components/, hooks, validators
  hooks/                   Cross-feature hooks (shortcuts, media query, debounce)
  lib/                     Prisma + Supabase clients, utils, tokens, permissions
  server/
    repositories/          Prisma queries + DTO mapping
    services/              Business rules (messages, conversations, users…)
    auth.ts http.ts …      Session, error normalising, rate limiting, broadcast
  stores/                  Zustand: UI chrome, composer drafts, live presence
  types/dto.ts             The client/server contract
```

**Data flow.** The browser never queries Postgres directly. It calls
`/api/*`, which authenticates via the Supabase session cookie, applies
permission checks, and uses Prisma. Supabase's own client is used for exactly
three things: authentication, realtime and storage uploads. RLS covers the
PostgREST surface that Supabase exposes on the same database.

**Realtime.** After a write, the server broadcasts the finished DTO over a
Supabase Realtime channel (`conversation:<id>` and `user:<id>`). Clients patch
their TanStack Query cache from that payload — no refetch, and the payload
matches the REST shape exactly. Typing indicators and presence are
client-to-client over the same transport.

---

## What is built

### 1 · Foundation

Strict TypeScript, Tailwind v4 with a token layer (layered surfaces, six accent
gradients, light/dark), path aliases, security headers, ESLint.

### 2 · Database

13 Prisma models: users, conversations, members, messages, attachments,
reactions, mentions, stars, relationships, blocks, join requests, invites,
notifications. Cursor-paginated history, one raw SQL query for unread counts
across the whole sidebar.

### 3 · Authentication

Email/password, Google and GitHub OAuth, email verification, password reset,
cookie sessions refreshed in middleware, protected routes, and a three-step
onboarding flow that claims a handle and sets an avatar and accent.

### 4 · UI foundation

Hand-built primitives on Radix: button, input, field, avatar with presence
ring, dialog, dropdown and context menus, popover, tooltip, switch, tabs,
badges, skeletons, empty states. Overlay animation runs on real CSS keyframes
so Radix waits for exit transitions.

### 5 · Messaging

Realtime send/edit/delete, replies with jump-to-source, forwarding, pinning,
starring, reactions with optimistic toggling, read receipts, delivery ticks,
typing indicators, message grouping, sticky date separators, markdown with
GFM, sanitised HTML, syntax highlighting and copy-to-clipboard code blocks,
emoji-only jumbo rendering, `@mention` autocomplete, infinite upward scroll
with scroll-position preservation, and drafts that survive a reload.

### 6 · Media

Direct-to-storage uploads via short-lived signed URLs (bytes never touch the
app server), drag & drop, clipboard paste, camera capture, image galleries with
a lightbox, video, documents, and voice notes recorded with a live waveform
that replays on the bubble.

### 7 · Groups

Create public or private groups, invite links with expiry and use limits, join
requests with moderation, four roles (owner / admin / moderator / member) whose
rules live in one isomorphic table used by both the API and the UI, member
management, and an admin panel inside the details drawer.

### 8 · Notifications

Persistent notification centre, browser notifications, a synthesised chime (no
audio asset), unread badges, per-kind preferences and per-conversation mute.

### 9 · Search

One endpoint returning people, conversations, messages and files, scoped to
what you are allowed to see, wired into ⌘K and an in-conversation panel.

### 10 · Polish

Empty, loading, and error states on every surface; skeletons shaped like the
content they replace; route-level error boundaries; toasts; page transitions;
a shortcuts dialog.

---

## Performance

- **Code splitting** — the emoji picker (~200 KB) and GIF picker load on first
  open, not on page load.
- **Browser-native windowing** — `content-visibility: auto` with
  `contain-intrinsic-size` lets the browser skip layout and paint for
  off-screen messages. It costs one CSS class instead of a virtualiser, and
  keeps native find-in-page, scroll anchoring and copy-paste working.
- **Optimistic updates** for sending, reactions, stars and preferences.
- **Debounced search** (220 ms) with `keepPreviousData` so results never flash.
- **Memoised** message bubbles and conversation rows; `layout="position"` only,
  so the springs never animate width.
- **Cursor pagination** — 40 messages per page.

## Accessibility

WCAG AA targets: full keyboard paths, visible focus rings, labelled controls,
`aria-live` on the message log and typing indicator, semantic landmarks, and
reduced motion honoured both from the OS and from the in-app preference.

## Security

- Row Level Security on all 13 tables (default deny, read-only policies),
  verified by querying as a member, as a signed-in outsider and as `anon`:
  outsiders and anonymous callers see zero rows.
- RLS helper functions live in a `private` schema, so PostgREST does not publish
  them as `SECURITY DEFINER` RPC endpoints. `auth.uid()` is wrapped in a
  subselect so it is evaluated once per query rather than once per row.
- Deleting an account in Supabase Auth cascades to the profile via a trigger,
  so no orphan row keeps holding the username.
- Zod validation on every request body and query string.
- Token-bucket rate limiting per user and action.
- Markdown sanitised with `rehype-sanitize` before highlighting.
- Origin checks on every mutating route on top of `SameSite=Lax` cookies.
- Uploads: MIME allow-list, 50 MB cap, paths namespaced by uploader id.
- Permission checks in services, not just in the UI.

---

## Scripts

```bash
npm run dev         # Development server
npm run build       # Production build (runs prisma generate first)
npm run start       # Serve the production build
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint
npm test            # Unit tests (pure functions, no I/O)
npm run test:e2e    # End-to-end suites — needs `npm run dev` running
npm run db:push     # Push the Prisma schema to Postgres
npm run db:studio   # Browse the database
```

`test:e2e` talks to the real dev server and the real Supabase project, because
what it checks — block enforcement, rate limiting, storage MIME rules,
notification preferences — only exists once a request has been through
middleware, the route handler, Prisma and Postgres. It creates throwaway
accounts and deletes them on the way out.

## Deployment

The app is a stock Next.js 15 App Router build, so any Node host works; Vercel
needs no configuration file.

Four things break in production if they are missed, and none of them fail
loudly:

1. **`NEXT_PUBLIC_APP_URL`** must be the deployed origin. Invite links are built
   from it. It is `required()` precisely so a missing value fails at once
   instead of quietly minting links to `localhost`.
2. **Supabase Auth → URL Configuration** needs the production origin in the
   redirect allow-list, or password recovery and any future OAuth will fail on
   the way back.
3. **Outbound email.** Supabase's built-in SMTP is capped at a handful of
   messages per hour and is not meant for real users. Email confirmation is
   currently off, so sign-up works without it — but *password recovery does
   not*. Wire up your own SMTP before relying on that flow.
4. **`DATABASE_URL` pool size.** `connection_limit=10` with `pool_timeout=20`
   suits a persistent server. Revisit it if the platform runs many short-lived
   instances: too high multiplied by many instances exhausts the pooler, too low
   serialises every request behind one connection.

Every variable in `.env.example` has to exist in the host's environment.
`SUPABASE_SERVICE_ROLE_KEY` is server-only — it must never be given a
`NEXT_PUBLIC_` name.

## Known limits

- **Rate limiting is a fixed window, not a token bucket.** Counters live in
  Postgres (`rate_limits`), so a limit holds across instances, and one statement
  does the whole read-modify-write. The trade-off is the window boundary: a
  caller can spend the tail of one window and the head of the next back to back,
  so the real burst ceiling is 2×the limit.
- **Search uses trigram `ILIKE`.** Fast into the millions of rows with the
  indexes in `security.sql`; swap for `tsvector` if you need ranking.
- **Voice notes record to WebM**, which Safari on older iOS does not produce.
  The recorder falls back to whatever `MediaRecorder` offers.
