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

Status: **step 0 done** (monorepo, console auth with mandatory 2FA, responsive shell). Every
validated choice is logged in `DECISIONS.md` (read it first; it is the source of truth for scope,
architecture and the step-by-step roadmap).

## Commands

```bash
pnpm install        # also generates the Prisma client (packages/db postinstall)
pnpm db:up          # Postgres (localhost:5433) + MinIO (API :9100, console :9101) — do this first
pnpm db:deploy      # apply the migrations
pnpm hub:install    # create the first superadmin (ADMIN_* from .env) — once per instance
pnpm dev            # console on http://localhost:5180
pnpm check          # type-check every package
pnpm db:studio      # browse the database
pnpm db:down        # stop the Docker services
```

There is no test suite. Verify changes by driving the dev server.

**Migrations**: never rewrite an applied migration; a schema change = a NEW migration.
`prisma migrate dev` fails in a non-interactive shell → write the SQL with
`prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` (or
`--from-empty` for the first one) into a new `prisma/migrations/<timestamp>_<name>/` folder, then
`pnpm db:deploy`.

**Local `DATABASE_URL` uses `127.0.0.1`, not `localhost`** — on Windows the `pg` driver may resolve
`localhost` to IPv6 (`::1`) and fail with `ECONNREFUSED`.

## Layout

```
apps/console/       SvelteKit: back-office + API. src/hooks.server.ts = central guard (the (app)
                    group requires a session; superadmin without 2FA → /securite?setup=required).
                    scripts/install.ts = first superadmin.
packages/db/        @g2-hub/db — Prisma schema, migrations, generated client (exports the CLASS,
                    the console builds its own singleton in src/lib/server/db.ts).
packages/sdk/       @g2/hub-client — client applications' SDK (step 3).
docker-compose.yml  Postgres 17 + MinIO with the two buckets (g2hub-public anonymous-read,
                    g2hub-private never public).
```

## Target stack (proposed — see DECISIONS.md for what is validated)

- pnpm monorepo:
  - `apps/console` — SvelteKit 2 + Svelte 5 (runes): the back-office AND the public API (`/api/v1/…`).
  - `packages/db` — Prisma schema, migrations, generated client.
  - `packages/sdk` — small TypeScript client (`@g2/hub-client`) for client applications.
- Better Auth (console accounts; later its OIDC provider plugin for portal SSO).
- PostgreSQL, S3-compatible object storage (MinIO in dev, Infomaniak Object Storage in prod).
- UI: `@guillaumeg/ui` + TailwindCSS v4 + `@lucide/svelte`.
- Deployment: Docker + `@sveltejs/adapter-node` on an Infomaniak VPS.

Follow the workspace defaults in `C:\Users\guigo\CLAUDE.md` (layered architecture
`repositories → services → mappers → viewmodels`, `records/` for presentation maps, pnpm only,
English code, Conventional Commits).

## Rules specific to this project

- **Tenant isolation is the first invariant**: every query on tenant data is scoped by
  organization (and application). Never trust an id coming from a client without checking it
  belongs to the caller's tenant.
- **Secrets never reach a browser**: secret API keys are server-to-server only and stored hashed.
- **The API is a contract**: versioned under `/api/v1`; a breaking change = a new version.
- Record every validated decision in `DECISIONS.md` (date + decision + why) before or with the
  code that implements it.
