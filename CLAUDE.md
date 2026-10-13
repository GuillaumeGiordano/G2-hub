# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**G2 Hub** — a reusable, multi-tenant backend service (identity + file storage + back-office) that
any number of client applications plug into over an HTTP API, instead of each project re-building
its own login and storage.

- A **client** (an organization, billed monthly) owns one or more **applications**: a static
  landing page, a site with a gallery, a portal with its own users…
- An application talks to the hub with **API keys** (publishable for browser reads, secret for
  server-to-server writes), restricted to its allowed origins.
- The **console** is the back-office: the operator (superadmin) manages every client; a client's
  admins manage their own applications and files (e.g. CRUD the photos of their gallery) without
  the client site needing a back-office of its own.

Scope: **files only** (images, videos, PDF in client-created folders, "like Supabase Storage but
simple") — no content management. Billing is done outside the hub (future G2 WebDev portal); the
hub measures usage and enforces quotas.

**One codebase, two distributions**: the shared instance hosted by G2 WebDev (many organizations),
and a delivered copy installed on a client's own server (one organization, which they customize).
Nothing specific to G2 WebDev is hard-coded — instance name, domain, S3, mail come from `.env`.

Status: **step 2 done** (organizations, members & roles, applications; folders and files on S3 with
quota, image / video processing and a background media worker). Every
validated choice is logged in `DECISIONS.md` (read it first; it is the source of truth for scope,
architecture and the step-by-step roadmap).

## Commands

```bash
pnpm install        # also generates the Prisma client (packages/db postinstall)
pnpm db:up          # Postgres (:5433) + MinIO (API :9100, console :9101) + Mailpit (SMTP :1125,
                    # inbox http://localhost:8125) — do this first
pnpm db:deploy      # apply the migrations
pnpm hub:install    # create the first superadmin (ADMIN_* from .env) — once per instance
pnpm dev            # console on http://localhost:5180
pnpm dev:demo       # demo landing on http://localhost:5190
pnpm dev:portal     # demo portal on http://localhost:5191 (sign-in with G2 Hub)
pnpm check          # type-check every package
pnpm db:studio      # browse the database
pnpm db:down        # stop the Docker services
```

There is no test suite. Verify changes by driving the dev server.

**Media**: `ffmpeg` + `ffprobe` must be installed (PATH, or `FFMPEG_PATH` / `FFPROBE_PATH`). Videos are
transcoded by ONE in-process worker (`lib/server/media/worker.ts`, started in `hooks.server.ts`
`init`) that drains the `MediaJob` table and also removes uploads never confirmed for 1 h.

**After a migration, restart the dev server**: it keeps the previous Prisma client in memory. On
Windows, stopping `pnpm dev` may leave Vite's `node` process alive on port 5180 — kill it too.

**Migrations**: never rewrite an applied migration; a schema change = a NEW migration.
`prisma migrate dev` fails in a non-interactive shell → write the SQL with
`prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` (or
`--from-empty` for the first one) into a new `prisma/migrations/<timestamp>_<name>/` folder, then
`pnpm db:deploy`.

**Local `DATABASE_URL` uses `127.0.0.1`, not `localhost`** — on Windows the `pg` driver may resolve
`localhost` to IPv6 (`::1`) and fail with `ECONNREFUSED`.

## Layout

```
apps/console/       SvelteKit: back-office + API. src/hooks.server.ts = central guard: (app) needs a
                    session, 2FA is forced for superadmin + owners, (app)/(org) needs an active
                    organization; it builds `locals.orgContext` (from the SESSION) for services.
                    Layers: lib/server/{repositories,services,mappers}, lib/viewmodels,
                    lib/records (labels, roles, the `can()` permission table), lib/schemas (Zod,
                    shared with the browser via FieldErrors). scripts/install.ts = first superadmin.
packages/db/        @g2-hub/db — Prisma schema, migrations, generated client (exports the CLASS,
                    the console builds its own singleton in src/lib/server/db.ts).
packages/sdk/       @g2/hub-client — the client sites' SDK (no dependency, browser + server),
                    compiled to dist/ (`pnpm --filter @g2/hub-client build`, also on install).
apps/demo-landing/  Demo client site (port 5190, `pnpm dev:demo`): gallery read server-side with a
                    publishable key (DEMO_HUB_* in .env) — the template for real client sites.
apps/demo-portal/   Demo client PORTAL (port 5191, `pnpm dev:portal`): « Se connecter avec G2 Hub »
                    with openid-client (DEMO_PORTAL_* in .env) — the template for real portals.
docker-compose.yml  Postgres 17 + MinIO with the two buckets (g2hub-public anonymous-read,
                    g2hub-private never public) + Mailpit (catches every e-mail in dev).
```

## Target stack (proposed — see DECISIONS.md for what is validated)

- pnpm monorepo:
  - `apps/console` — SvelteKit 2 + Svelte 5 (runes): the back-office AND the public API (`/api/v1/…`).
  - `packages/db` — Prisma schema, migrations, generated client.
  - `packages/sdk` — small TypeScript client (`@g2/hub-client`) for client applications.
- Better Auth (console accounts only). Portal end users are a separate model (`AppUser`).
- PostgreSQL, S3-compatible object storage (MinIO in dev, Infomaniak Object Storage in prod).
- UI: `@guillaumeg/ui` + TailwindCSS v4 + `@lucide/svelte`.
- Deployment: Docker + `@sveltejs/adapter-node` on an Infomaniak VPS.

Follow the workspace defaults in `C:\Users\guigo\CLAUDE.md` (layered architecture
`repositories → services → mappers → viewmodels`, `records/` for presentation maps, pnpm only,
English code, Conventional Commits).

## Rules specific to this project

- **Tenant isolation is the first invariant**: every query on tenant data is scoped by
  organization (and application). Organization-scoped services take an `OrgContext`
  (`locals.orgContext`, built from the session) — never an organization id from the browser.
  Writes go through `updateMany`/`deleteMany` filtered on `id` AND `organizationId`; an id from
  another organization → **404** (not 403, to reveal nothing).
- **UI = `@guillaumeg/ui` only** (Table, Modal, Input, Select, TagInput, ButtonAction…): read the
  component source before using a prop. Note: `Pagination`'s `total` is the PAGE count.
- **Secrets never reach a browser**: secret API keys are server-to-server only and stored hashed.
- **The API is a contract**: versioned under `/api/v1`; a breaking change = a new version.
  `/api/v1` authenticates by API KEY only (lib/server/api: `authenticate` → `ApiContext`, the
  key alone gives organization + application); the hook skips the session for it. Publishable
  keys read PUBLIC folders only; secret keys are refused when a browser sends them.
  Writes (uploads, file alt / caption, delete) need a SECRET key and reuse the SAME core as the
  console (`fileService.reserveUpload` / `confirmUpload` / `removeFile` / `setFileText`). A file
  sent by a site (`StoredFile.source = API`) is read-only in the console: only the site deletes it.
- **Two kinds of accounts, never mixed** (DECISIONS.md §24): console members are Better Auth
  `user`s; portal end users are `AppUser`s, isolated per APPLICATION (unique application + e-mail),
  with their own scrypt hash (`lib/server/passwords.ts`) — they can never sign in to the console.
  They are invited (console tab « Utilisateurs », or `POST /api/v1/users` with a secret key) and
  choose their password from an e-mailed single-use link (`/mot-de-passe/[token]`, only the token's
  SHA-256 stored); `/mot-de-passe-oublie?app=` never reveals whether an address has an account.
- **« Se connecter avec G2 Hub »** (DECISIONS.md §25): an OpenID Connect provider limited to
  Authorization Code + PKCE S256 for confidential clients (`oidcService`; endpoints
  `/.well-known/openid-configuration`, `/oauth/{authorize,token,userinfo,jwks}`). client_id = the
  application id; return URLs compared EXACTLY; an unknown client / unregistered return URL is shown
  on the hub, never redirected to. Codes, access tokens and client secrets are stored hashed.
- **CSRF is checked in `hooks.server.ts`**, not by SvelteKit (`csrf.trustedOrigins: ['*']` in
  svelte.config.js), so that `/oauth/token` (server-to-server, no Origin) can be exempted. Never
  remove the hook's check; never exempt a route that uses the session cookie.
- **E-mails** go through `lib/server/mail` (SMTP from .env: Mailpit in dev, Infomaniak in prod).
  Every value inserted in an e-mail's HTML is escaped (application names are typed by clients).
- **Never delete tenant data with raw SQL** in dev: it skips the storage purge and leaves orphan
  objects in the buckets — delete through the console (or the services).
- Record every validated decision in `DECISIONS.md` (date + decision + why) before or with the
  code that implements it.
